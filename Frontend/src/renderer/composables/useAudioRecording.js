// src/renderer/composables/useAudioRecording.js
import { ref, computed, onUnmounted } from 'vue'
import { useErrorHandler, ERROR_STRATEGIES } from './useErrorHandler.js'

/**
 * 音頻錄製管理 Composable
 * 處理音頻錄製、VAD檢測和權限管理
 * 
 * @param {Object} options 配置選項
 * @returns {Object} 音頻錄製相關的響應式資料和方法
 */
export function useAudioRecording(options = {}) {
  // 錯誤處理
  const { createContextHandler } = useErrorHandler()
  const handleRecordingError = createContextHandler('recording', {
    strategy: ERROR_STRATEGIES.FALLBACK,
    maxRetries: 3
  })

  // ===== 配置選項 =====
  const config = ref({
    sampleRate: 44100,
    silenceThreshold: 30,
    vadTimeout: 1500,
    enableVAD: true,
    enableLogging: true,
    mimeType: 'audio/webm;codecs=opus',
    maxRecordingTime: 30000, // 30秒最大錄製時間
    ...options
  })

  // ===== 核心狀態 =====
  const isRecording = ref(false)
  const isInitialized = ref(false)
  const hasPermission = ref(false)
  const isProcessing = ref(false)

  // ===== VAD 狀態 =====
  const isSpeaking = ref(false)
  const currentVolume = ref(0)
  const audioData = ref(new Uint8Array(0))
  const vadEnabled = ref(true)

  // ===== 錄製數據 =====
  const recordingDuration = ref(0)
  const recordedBlob = ref(null)
  const recordingStartTime = ref(null)

  // ===== 設備狀態 =====
  const mediaStream = ref(null)
  const mediaRecorder = ref(null)
  const audioContext = ref(null)
  const analyserNode = ref(null)

  // ===== 錯誤狀態 =====
  const lastError = ref(null)
  const permissionError = ref(null)

  // ===== 內部變量 =====
  let recordedChunks = []
  let vadMonitoringId = null
  let durationTimer = null
  let silenceStartTime = null
  let maxRecordingTimer = null

  // ===== 計算屬性 =====
  const canStartRecording = computed(() => 
    isInitialized.value && hasPermission.value && !isRecording.value && !isProcessing.value
  )
  
  const canStopRecording = computed(() => isRecording.value)

  const recordingState = computed(() => ({
    isRecording: isRecording.value,
    isSpeaking: isSpeaking.value,
    duration: recordingDuration.value,
    volume: currentVolume.value,
    hasPermission: hasPermission.value,
    vadEnabled: vadEnabled.value
  }))

  /**
   * 初始化音頻錄製系統
   */
  const initialize = async () => {
    try {
      log('Initializing audio recording system...')
      
      // 檢查瀏覽器支援
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support audio recording')
      }

      // 申請麥克風權限
      const permissionResult = await requestPermissions()
      if (!permissionResult.success) {
        throw new Error(`Permission denied: ${permissionResult.error}`)
      }

      isInitialized.value = true
      lastError.value = null
      log('Audio recording system initialized successfully')

      return { success: true }
    } catch (error) {
      console.error('Failed to initialize audio recording system:', error)
      lastError.value = error.message
      isInitialized.value = false
      
      return { success: false, error: error.message }
    }
  }

  /**
   * 申請麥克風權限
   */
  const requestPermissions = async () => {
    try {
      log('Requesting microphone permissions...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: config.value.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      mediaStream.value = stream
      hasPermission.value = true
      permissionError.value = null

      // 設置音頻分析
      await setupAudioAnalysis()
      
      // 設置媒體錄製器
      await setupMediaRecorder()

      log('Microphone permissions granted and audio system setup completed')
      return { success: true }
    } catch (error) {
      console.error('Permission request failed:', error)
      permissionError.value = error.message
      hasPermission.value = false
      
      return { success: false, error: error.message }
    }
  }

  /**
   * 設置音頻分析系統（用於VAD）
   */
  const setupAudioAnalysis = async () => {
    if (!config.value.enableVAD || !mediaStream.value) {
      vadEnabled.value = false
      return
    }

    try {
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: config.value.sampleRate
      })

      const source = audioContext.value.createMediaStreamSource(mediaStream.value)
      analyserNode.value = audioContext.value.createAnalyser()
      
      analyserNode.value.fftSize = 2048
      analyserNode.value.smoothingTimeConstant = 0.8

      source.connect(analyserNode.value)
      vadEnabled.value = true

      log('Audio analysis setup completed for VAD')
    } catch (error) {
      console.error('Failed to setup audio analysis:', error)
      vadEnabled.value = false
    }
  }

  /**
   * 設置媒體錄製器
   */
  const setupMediaRecorder = async () => {
    if (!mediaStream.value) {
      throw new Error('No media stream available')
    }

    try {
      // 檢查支援的MIME類型
      const supportedMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ]

      let selectedMimeType = config.value.mimeType
      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      mediaRecorder.value = new MediaRecorder(mediaStream.value, {
        mimeType: selectedMimeType
      })

      // 設置事件監聽器
      setupMediaRecorderEvents()

      log(`Media recorder setup completed with MIME type: ${selectedMimeType}`)
    } catch (error) {
      console.error('Failed to setup media recorder:', error)
      throw error
    }
  }

  /**
   * 設置媒體錄製器事件監聽器
   */
  const setupMediaRecorderEvents = () => {
    if (!mediaRecorder.value) return

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
        log('Audio chunk recorded:', event.data.size, 'bytes')
      }
    }

    mediaRecorder.value.onstop = () => {
      log('Media recorder stopped')
      createRecordedBlob()
    }

    mediaRecorder.value.onerror = (error) => {
      console.error('Media recorder error:', error)
      handleRecordingError(new Error('Media recorder error: ' + error.message))
      stopRecording()
    }
  }

  /**
   * 開始錄製音頻
   */
  const startRecording = async () => {
    if (!canStartRecording.value) {
      const error = 'Cannot start recording: system not ready or already recording'
      log(error)
      return { success: false, error }
    }

    try {
      log('Starting audio recording...')
      
      // 重置狀態
      recordedChunks = []
      recordingDuration.value = 0
      recordedBlob.value = null
      lastError.value = null
      isSpeaking.value = false
      silenceStartTime = null

      // 開始媒體錄製
      mediaRecorder.value.start()
      
      recordingStartTime.value = Date.now()
      isRecording.value = true

      // 開始計時器
      startTimers()
      
      // 開始VAD監聽
      if (vadEnabled.value) {
        startVADMonitoring()
      }

      log('Audio recording started successfully')
      return { success: true }
    } catch (error) {
      console.error('Failed to start recording:', error)
      lastError.value = error.message
      
      return handleRecordingError(error)
    }
  }

  /**
   * 停止錄製音頻
   */
  const stopRecording = async () => {
    if (!canStopRecording.value) {
      const error = 'Cannot stop recording: not currently recording'
      log(error)
      return { success: false, error }
    }

    try {
      log('Stopping audio recording...')
      isProcessing.value = true

      // 停止媒體錄製器
      if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
        mediaRecorder.value.stop()
      }

      // 停止計時器和監聽
      stopTimers()
      stopVADMonitoring()

      isRecording.value = false
      isSpeaking.value = false

      // 等待錄製數據處理完成
      await new Promise(resolve => setTimeout(resolve, 100))

      if (recordedBlob.value) {
        log('Recording stopped successfully, blob size:', recordedBlob.value.size, 'bytes')
        return { 
          success: true, 
          audioBlob: recordedBlob.value,
          duration: recordingDuration.value
        }
      } else {
        throw new Error('No recorded data available')
      }

    } catch (error) {
      console.error('Failed to stop recording:', error)
      lastError.value = error.message
      
      return handleRecordingError(error)
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * 創建錄製的音頻Blob
   */
  const createRecordedBlob = () => {
    try {
      if (recordedChunks.length === 0) {
        log('Warning: No recorded chunks available')
        return
      }

      const blob = new Blob(recordedChunks, {
        type: mediaRecorder.value.mimeType
      })

      recordedBlob.value = blob
      log('Created audio blob:', blob.size, 'bytes, type:', blob.type)
    } catch (error) {
      console.error('Failed to create audio blob:', error)
      lastError.value = 'Failed to create audio blob'
    }
  }

  /**
   * 開始計時器
   */
  const startTimers = () => {
    // 錄製時長計時器
    durationTimer = setInterval(() => {
      if (recordingStartTime.value) {
        recordingDuration.value = Date.now() - recordingStartTime.value
      }
    }, 100)

    // 最大錄製時間限制
    if (config.value.maxRecordingTime > 0) {
      maxRecordingTimer = setTimeout(() => {
        log('Maximum recording time reached, auto-stopping...')
        stopRecording()
      }, config.value.maxRecordingTime)
    }
  }

  /**
   * 停止計時器
   */
  const stopTimers = () => {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }

    if (maxRecordingTimer) {
      clearTimeout(maxRecordingTimer)
      maxRecordingTimer = null
    }
  }

  /**
   * 開始VAD監聽
   */
  const startVADMonitoring = () => {
    if (!vadEnabled.value || !analyserNode.value) {
      return
    }

    const monitorAudio = () => {
      if (!isRecording.value) return

      const bufferLength = analyserNode.value.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyserNode.value.getByteFrequencyData(dataArray)

      // 計算音量
      const volume = calculateVolume(dataArray)
      currentVolume.value = volume
      audioData.value = dataArray

      // VAD檢測
      const currentTime = Date.now()
      const isSpeakingNow = volume > config.value.silenceThreshold

      if (isSpeakingNow) {
        if (!isSpeaking.value) {
          isSpeaking.value = true
          silenceStartTime = null
          log(`Speech detected (volume: ${volume})`)
        }
      } else {
        if (isSpeaking.value) {
          if (silenceStartTime === null) {
            silenceStartTime = currentTime
          } else if (currentTime - silenceStartTime > config.value.vadTimeout) {
            isSpeaking.value = false
            silenceStartTime = null
            log(`Speech ended (silence timeout: ${config.value.vadTimeout}ms)`)
            
            // 可選：自動停止錄製
            if (config.value.autoStopOnSilence) {
              log('Auto-stopping recording due to VAD silence detection')
              stopRecording()
            }
          }
        }
      }

      vadMonitoringId = requestAnimationFrame(monitorAudio)
    }

    vadMonitoringId = requestAnimationFrame(monitorAudio)
    log('VAD monitoring started')
  }

  /**
   * 停止VAD監聽
   */
  const stopVADMonitoring = () => {
    if (vadMonitoringId) {
      cancelAnimationFrame(vadMonitoringId)
      vadMonitoringId = null
      log('VAD monitoring stopped')
    }
  }

  /**
   * 計算音量
   */
  const calculateVolume = (dataArray) => {
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    return Math.floor(sum / dataArray.length)
  }

  /**
   * 切換錄製狀態
   */
  const toggleRecording = async () => {
    if (isRecording.value) {
      return await stopRecording()
    } else {
      return await startRecording()
    }
  }

  /**
   * 更新配置
   */
  const updateConfig = (newConfig) => {
    config.value = { ...config.value, ...newConfig }
    
    // 更新VAD設定
    if (newConfig.enableVAD !== undefined) {
      vadEnabled.value = newConfig.enableVAD && !!analyserNode.value
    }

    log('Configuration updated:', newConfig)
  }

  /**
   * 獲取音頻設備列表
   */
  const getAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      
      log('Available audio input devices:', audioInputs.length)
      return { success: true, devices: audioInputs }
    } catch (error) {
      console.error('Failed to get audio devices:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 檢查麥克風權限狀態
   */
  const checkPermissionStatus = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' })
        const status = permissionStatus.state // 'granted', 'denied', 'prompt'
        
        log('Microphone permission status:', status)
        return { success: true, status }
      } else {
        return { success: false, error: 'Permission API not supported' }
      }
    } catch (error) {
      console.error('Failed to check permission status:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 重置錄製狀態
   */
  const resetState = () => {
    // 停止所有活動
    if (isRecording.value) {
      stopRecording()
    }
    
    // 重置狀態
    recordingDuration.value = 0
    recordedBlob.value = null
    recordingStartTime.value = null
    isSpeaking.value = false
    currentVolume.value = 0
    lastError.value = null
    
    // 清理數據
    recordedChunks = []
    audioData.value = new Uint8Array(0)
    
    log('Recording state reset')
  }

  /**
   * 釋放資源
   */
  const dispose = () => {
    log('Disposing audio recording system...')
    
    // 停止所有活動
    stopTimers()
    stopVADMonitoring()
    
    // 釋放媒體流
    if (mediaStream.value) {
      mediaStream.value.getTracks().forEach(track => track.stop())
      mediaStream.value = null
    }
    
    // 釋放音頻上下文
    if (audioContext.value) {
      audioContext.value.close()
      audioContext.value = null
    }
    
    // 清理變量
    mediaRecorder.value = null
    analyserNode.value = null
    recordedChunks = []
    
    // 重置狀態
    isInitialized.value = false
    hasPermission.value = false
    resetState()
    
    log('Audio recording system disposed')
  }

  /**
   * 日誌輸出
   */
  const log = (message, ...args) => {
    if (config.value.enableLogging) {
      console.log(`[useAudioRecording] ${message}`, ...args)
    }
  }

  // 組件卸載時清理資源
  onUnmounted(() => {
    dispose()
  })

  return {
    // ===== 響應式狀態 =====
    isRecording,
    isInitialized,
    hasPermission,
    isProcessing,
    isSpeaking,
    currentVolume,
    audioData,
    vadEnabled,
    recordingDuration,
    recordedBlob,
    lastError,
    permissionError,
    
    // ===== 計算屬性 =====
    canStartRecording,
    canStopRecording,
    recordingState,
    
    // ===== 核心方法 =====
    initialize,
    requestPermissions,
    startRecording,
    stopRecording,
    toggleRecording,
    
    // ===== 配置管理 =====
    updateConfig,
    
    // ===== 設備管理 =====
    getAudioDevices,
    checkPermissionStatus,
    
    // ===== 工具方法 =====
    resetState,
    dispose
  }
}

export default useAudioRecording