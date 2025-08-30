// src/renderer/services/VoiceRecordingService.js

/**
 * 語音錄製服務
 * 負責處理音頻錄製、VAD檢測和WebM格式處理
 */
export class VoiceRecordingService {
  constructor(options = {}) {
    this.options = {
      sampleRate: 44100,
      silenceThreshold: 30,
      vadTimeout: 1500,
      enableVAD: true,
      autoStopOnSilence: true,
      enableLogging: true,
      mimeType: 'audio/webm;codecs=opus',
      ...options
    }

    // 錄製相關
    this.mediaRecorder = null
    this.audioStream = null
    this.audioContext = null
    this.analyserNode = null
    this.workletNode = null

    // VAD 相關
    this.vadEnabled = this.options.enableVAD
    this.isRecording = false
    this.isSpeaking = false
    this.silenceStartTime = null
    this.recordingStartTime = null
    this.audioData = new Uint8Array(0)
    this.currentVolume = 0

    // 錄製數據
    this.recordedChunks = []

    // 事件回調
    this.callbacks = {}

    this.log('VoiceRecordingService initialized')
  }

  /**
   * 初始化服務
   */
  async initialize() {
    try {
      this.log('Initializing voice recording service...')

      // 申請麥克風權限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      this.audioStream = stream
      await this.setupAudioAnalysis()
      await this.setupMediaRecorder()

      this.log('Voice recording service initialized successfully')
      return { success: true }
    } catch (error) {
      console.error('Failed to initialize voice recording service:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 設置音頻分析（VAD）
   */
  async setupAudioAnalysis() {
    if (!this.vadEnabled) {
      this.log('VAD disabled, skipping audio analysis setup')
      return
    }

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.options.sampleRate
      })

      const source = this.audioContext.createMediaStreamSource(this.audioStream)
      this.analyserNode = this.audioContext.createAnalyser()
      
      this.analyserNode.fftSize = 2048
      this.analyserNode.smoothingTimeConstant = 0.8

      source.connect(this.analyserNode)

      this.log('Audio analysis setup completed')
    } catch (error) {
      console.error('Failed to setup audio analysis:', error)
      this.vadEnabled = false
    }
  }

  /**
   * 設置媒體錄製器
   */
  async setupMediaRecorder() {
    try {
      // 檢查支援的MIME類型
      const supportedMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ]

      let selectedMimeType = this.options.mimeType
      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: selectedMimeType
      })

      // 設置事件監聽器
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.log('MediaRecorder stopped')
        this.emitCallback('onRecordingStop', {
          chunks: this.recordedChunks,
          mimeType: selectedMimeType
        })
      }

      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error)
        this.emitCallback('onError', { message: 'Recording error: ' + error.message })
      }

      this.log(`MediaRecorder setup completed with MIME type: ${selectedMimeType}`)
    } catch (error) {
      console.error('Failed to setup MediaRecorder:', error)
      throw error
    }
  }

  /**
   * 開始錄製
   */
  async startRecording() {
    if (this.isRecording) {
      this.log('Already recording')
      return { success: false, error: 'Already recording' }
    }

    try {
      this.recordedChunks = []
      this.isRecording = true
      this.isSpeaking = false
      this.silenceStartTime = null

      // 開始媒體錄製
      this.mediaRecorder.start()

      // 開始VAD監聽
      if (this.vadEnabled) {
        this.startVADMonitoring()
      }

      this.log('Recording started')
      this.emitCallback('onRecordingStart')

      return { success: true }
    } catch (error) {
      console.error('Failed to start recording:', error)
      this.isRecording = false
      return { success: false, error: error.message }
    }
  }

  /**
   * 停止錄製
   */
  async stopRecording() {
    if (!this.isRecording) {
      this.log('Not currently recording')
      return { success: false, error: 'Not currently recording' }
    }

    try {
      this.isRecording = false
      this.isSpeaking = false
      this.silenceStartTime = null

      // 停止媒體錄製
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop()
      }

      // 停止VAD監聽
      this.stopVADMonitoring()

      this.log('Recording stopped')

      // 等待一小段時間確保所有數據都被處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 創建音頻Blob
      const audioBlob = await this.createAudioBlob()

      return { success: true, audioBlob }
    } catch (error) {
      console.error('Failed to stop recording:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 創建音頻Blob
   */
  async createAudioBlob() {
    if (this.recordedChunks.length === 0) {
      throw new Error('No recorded data available')
    }

    const blob = new Blob(this.recordedChunks, {
      type: this.mediaRecorder.mimeType
    })

    this.log(`Created audio blob: ${blob.size} bytes, type: ${blob.type}`)
    return blob
  }

  /**
   * 開始VAD監聽
   */
  startVADMonitoring() {
    if (!this.vadEnabled || !this.analyserNode) {
      return
    }

    // 初始化錄製開始時間，用於全局超時檢測
    this.recordingStartTime = Date.now()

    const monitorAudio = () => {
      if (!this.isRecording) return

      const bufferLength = this.analyserNode.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      this.analyserNode.getByteFrequencyData(dataArray)

      // 計算音量
      const volume = this.calculateVolume(dataArray)
      this.currentVolume = volume

      // 更新音頻數據
      this.audioData = dataArray

      // 觸發音量變化回調
      this.emitCallback('onVolumeChange', volume, dataArray)

      // VAD檢測
      const currentTime = Date.now()
      const isSpeakingNow = volume > this.options.silenceThreshold

      if (isSpeakingNow) {
        if (!this.isSpeaking) {
          this.isSpeaking = true
          this.silenceStartTime = null
          this.log(`Speech detected (volume: ${volume})`)
          this.emitCallback('onSpeechStart', { volume })
        }
        // 重置靜音開始時間
        this.silenceStartTime = null
      } else {
        // 處理靜音狀態
        if (this.isSpeaking) {
          // 從說話變為靜音
          if (this.silenceStartTime === null) {
            this.silenceStartTime = currentTime
            this.log(`Silence started after speech (volume: ${volume})`)
          } else if (currentTime - this.silenceStartTime > this.options.vadTimeout) {
            // 說話後靜音超時
            this.isSpeaking = false
            this.silenceStartTime = null
            this.log(`Speech ended (silence timeout: ${this.options.vadTimeout}ms)`)
            this.emitCallback('onSpeechEnd', { volume })
            
            // 觸發自動停止事件
            if (this.isRecording && this.options.autoStopOnSilence) {
              this.log('Auto-stopping recording due to VAD silence detection after speech')
              this.emitCallback('onAutoStop', { volume, reason: 'silence_after_speech' })
            }
          }
        } else {
          // 從未檢測到說話，檢查總錄製時間是否超過 VAD 超時
          if (currentTime - this.recordingStartTime > this.options.vadTimeout) {
            this.log(`Auto-stopping recording due to no speech detected within ${this.options.vadTimeout}ms`)
            if (this.isRecording && this.options.autoStopOnSilence) {
              this.emitCallback('onAutoStop', { volume, reason: 'no_speech_detected' })
            }
          }
        }
      }

      // 繼續監聽
      if (this.isRecording) {
        requestAnimationFrame(monitorAudio)
      }
    }

    requestAnimationFrame(monitorAudio)
    this.log('VAD monitoring started')
  }

  /**
   * 停止VAD監聽
   */
  stopVADMonitoring() {
    this.log('VAD monitoring stopped')
  }

  /**
   * 計算音量
   */
  calculateVolume(dataArray) {
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    return Math.floor(sum / dataArray.length)
  }

  /**
   * 設置事件回調
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * 觸發回調
   */
  emitCallback(eventName, ...args) {
    if (this.callbacks[eventName]) {
      try {
        this.callbacks[eventName](...args)
      } catch (error) {
        console.error(`Error in callback ${eventName}:`, error)
      }
    }
  }

  /**
   * 更新VAD設置
   */
  updateVADSettings(settings) {
    this.options = { ...this.options, ...settings }
    this.vadEnabled = this.options.enableVAD
    this.log('VAD settings updated:', settings)
  }

  /**
   * 獲取錄製狀態
   */
  getRecordingState() {
    return {
      isRecording: this.isRecording,
      isSpeaking: this.isSpeaking,
      currentVolume: this.currentVolume,
      vadEnabled: this.vadEnabled
    }
  }

  /**
   * 釋放資源
   */
  dispose() {
    this.log('Disposing voice recording service...')

    // 停止錄製
    if (this.isRecording) {
      this.stopRecording()
    }

    // 釋放音頻上下文
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    // 釋放媒體流
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
      this.audioStream = null
    }

    // 清理變量
    this.mediaRecorder = null
    this.analyserNode = null
    this.recordedChunks = []
    this.callbacks = {}

    this.log('Voice recording service disposed')
  }

  /**
   * 日誌輸出
   */
  log(message, ...args) {
    if (this.options.enableLogging) {
      console.log(`[VoiceRecordingService] ${message}`, ...args)
    }
  }
}

export default VoiceRecordingService