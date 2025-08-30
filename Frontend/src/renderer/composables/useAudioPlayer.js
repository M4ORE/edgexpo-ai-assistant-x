// src/renderer/composables/useAudioPlayer.js
import { ref, computed, onUnmounted } from 'vue'
import { useErrorHandler, ERROR_STRATEGIES } from './useErrorHandler.js'

/**
 * 音頻播放管理 Composable
 * 處理TTS音頻播放、播放隊列和播放控制
 * 
 * @param {Object} options 配置選項
 * @returns {Object} 音頻播放相關的響應式資料和方法
 */
export function useAudioPlayer(options = {}) {
  // 錯誤處理
  const { createContextHandler } = useErrorHandler()
  const handlePlayerError = createContextHandler('audio_player', {
    strategy: ERROR_STRATEGIES.FALLBACK,
    maxRetries: 3
  })

  // ===== 配置選項 =====
  const config = ref({
    enableLogging: true,
    autoPlay: true,
    volume: 1.0,
    playbackRate: 1.0,
    enableQueue: true,
    maxQueueSize: 10,
    crossOrigin: 'anonymous',
    preload: 'auto',
    ...options
  })

  // ===== 核心狀態 =====
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const isLoading = ref(false)
  const currentAudio = ref(null)
  const duration = ref(0)
  const currentTime = ref(0)
  const volume = ref(config.value.volume)
  const playbackRate = ref(config.value.playbackRate)

  // ===== 播放隊列 =====
  const audioQueue = ref([])
  const currentIndex = ref(-1)
  const isQueueMode = ref(false)

  // ===== 播放狀態 =====
  const canPlay = ref(false)
  const hasEnded = ref(false)
  const bufferProgress = ref(0)

  // ===== 錯誤狀態 =====
  const lastError = ref(null)
  const loadError = ref(null)

  // ===== 內部變量 =====
  let audioElement = null
  let timeUpdateTimer = null
  let bufferUpdateTimer = null

  // ===== 計算屬性 =====
  const isReady = computed(() => canPlay.value && !loadError.value)
  const canResume = computed(() => isPaused.value && isReady.value)
  const canPause = computed(() => isPlaying.value && !isPaused.value)
  const progress = computed(() => duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0)
  const hasQueue = computed(() => audioQueue.value.length > 0)
  const hasNext = computed(() => isQueueMode.value && currentIndex.value < audioQueue.value.length - 1)
  const hasPrevious = computed(() => isQueueMode.value && currentIndex.value > 0)

  const playerState = computed(() => ({
    isPlaying: isPlaying.value,
    isPaused: isPaused.value,
    isLoading: isLoading.value,
    duration: duration.value,
    currentTime: currentTime.value,
    progress: progress.value,
    volume: volume.value,
    playbackRate: playbackRate.value,
    queueSize: audioQueue.value.length
  }))

  /**
   * 播放音頻Blob
   * @param {Blob} audioBlob 音頻數據
   * @param {Object} options 播放選項
   */
  const playAudioBlob = async (audioBlob, playOptions = {}) => {
    try {
      log('Playing audio blob:', audioBlob.size, 'bytes')
      
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Invalid or empty audio blob')
      }

      // 停止當前播放
      await stopAudio()

      // 創建音頻URL
      const audioUrl = URL.createObjectURL(audioBlob)
      currentAudio.value = { blob: audioBlob, url: audioUrl, ...playOptions }

      // 播放音頻
      const result = await playAudioUrl(audioUrl, playOptions)
      
      if (result.success) {
        log('Audio blob playback started successfully')
      }

      return result
    } catch (error) {
      console.error('Failed to play audio blob:', error)
      lastError.value = error.message
      
      return handlePlayerError(error)
    }
  }

  /**
   * 播放音頻URL
   * @param {string} audioUrl 音頻URL
   * @param {Object} options 播放選項
   */
  const playAudioUrl = async (audioUrl, playOptions = {}) => {
    try {
      log('Playing audio URL:', audioUrl)
      
      // 重置狀態
      resetPlaybackState()
      isLoading.value = true
      lastError.value = null

      // 創建新的音頻元素
      audioElement = new Audio()
      setupAudioElement(audioElement, playOptions)

      // 設置音頻源
      audioElement.src = audioUrl

      // 載入音頻
      audioElement.load()

      // 等待音頻可播放
      await waitForCanPlay(audioElement)

      // 開始播放
      if (config.value.autoPlay) {
        await audioElement.play()
      }

      log('Audio URL playback started successfully')
      return { success: true }
    } catch (error) {
      console.error('Failed to play audio URL:', error)
      lastError.value = error.message
      isLoading.value = false
      
      return handlePlayerError(error)
    }
  }

  /**
   * 設置音頻元素
   */
  const setupAudioElement = (audio, playOptions = {}) => {
    // 基本屬性
    audio.volume = playOptions.volume ?? volume.value
    audio.playbackRate = playOptions.playbackRate ?? playbackRate.value
    audio.crossOrigin = config.value.crossOrigin
    audio.preload = config.value.preload

    // 事件監聽器
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('loadeddata', handleLoadedData)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('canplaythrough', handleCanPlayThrough)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('progress', handleProgress)
    audio.addEventListener('error', handleAudioError)
    audio.addEventListener('stalled', handleStalled)
    audio.addEventListener('waiting', handleWaiting)

    log('Audio element setup completed')
  }

  /**
   * 等待音頻可播放
   */
  const waitForCanPlay = (audio) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio load timeout'))
      }, 30000) // 30秒超時

      const onCanPlay = () => {
        clearTimeout(timeout)
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('error', onError)
        resolve()
      }

      const onError = (event) => {
        clearTimeout(timeout)
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('error', onError)
        reject(new Error(`Audio load error: ${event.message || 'Unknown error'}`))
      }

      audio.addEventListener('canplay', onCanPlay)
      audio.addEventListener('error', onError)
    })
  }

  /**
   * 播放控制方法
   */
  const playAudio = async () => {
    if (!audioElement || !canPlay.value) {
      const error = 'Cannot play: audio not ready'
      log(error)
      return { success: false, error }
    }

    try {
      await audioElement.play()
      log('Audio playback resumed')
      return { success: true }
    } catch (error) {
      console.error('Failed to play audio:', error)
      return handlePlayerError(error)
    }
  }

  const pauseAudio = async () => {
    if (!audioElement || !canPause.value) {
      const error = 'Cannot pause: audio not playing'
      log(error)
      return { success: false, error }
    }

    try {
      audioElement.pause()
      log('Audio playback paused')
      return { success: true }
    } catch (error) {
      console.error('Failed to pause audio:', error)
      return handlePlayerError(error)
    }
  }

  const stopAudio = async () => {
    try {
      log('Stopping audio playback...')
      
      // 停止計時器
      clearTimers()

      // 停止並清理音頻元素
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
        removeAudioEventListeners(audioElement)
        audioElement = null
      }

      // 清理音頻URL
      if (currentAudio.value?.url) {
        URL.revokeObjectURL(currentAudio.value.url)
        currentAudio.value = null
      }

      // 重置狀態
      resetPlaybackState()

      log('Audio playback stopped')
      return { success: true }
    } catch (error) {
      console.error('Failed to stop audio:', error)
      return handlePlayerError(error)
    }
  }

  const togglePlayback = async () => {
    if (isPlaying.value && !isPaused.value) {
      return await pauseAudio()
    } else {
      return await playAudio()
    }
  }

  /**
   * 搜尋到指定時間
   */
  const seekTo = (time) => {
    if (!audioElement || !canPlay.value) {
      return { success: false, error: 'Audio not ready for seeking' }
    }

    try {
      const seekTime = Math.max(0, Math.min(time, duration.value))
      audioElement.currentTime = seekTime
      log('Seeked to:', seekTime, 'seconds')
      return { success: true }
    } catch (error) {
      console.error('Failed to seek:', error)
      return handlePlayerError(error)
    }
  }

  /**
   * 設置播放音量
   */
  const setVolume = (newVolume) => {
    try {
      const clampedVolume = Math.max(0, Math.min(1, newVolume))
      volume.value = clampedVolume
      
      if (audioElement) {
        audioElement.volume = clampedVolume
      }

      log('Volume set to:', clampedVolume)
      return { success: true }
    } catch (error) {
      console.error('Failed to set volume:', error)
      return handlePlayerError(error)
    }
  }

  /**
   * 設置播放速度
   */
  const setPlaybackRate = (rate) => {
    try {
      const clampedRate = Math.max(0.1, Math.min(4.0, rate))
      playbackRate.value = clampedRate
      
      if (audioElement) {
        audioElement.playbackRate = clampedRate
      }

      log('Playback rate set to:', clampedRate)
      return { success: true }
    } catch (error) {
      console.error('Failed to set playback rate:', error)
      return handlePlayerError(error)
    }
  }

  /**
   * 隊列管理方法
   */
  const addToQueue = (audioBlob, metadata = {}) => {
    if (!config.value.enableQueue) {
      return { success: false, error: 'Queue is disabled' }
    }

    if (audioQueue.value.length >= config.value.maxQueueSize) {
      return { success: false, error: 'Queue is full' }
    }

    const queueItem = {
      id: Date.now() + Math.random(),
      blob: audioBlob,
      metadata,
      addedAt: Date.now()
    }

    audioQueue.value.push(queueItem)
    log('Added to queue:', queueItem.id)
    
    return { success: true, queueId: queueItem.id }
  }

  const removeFromQueue = (queueId) => {
    const index = audioQueue.value.findIndex(item => item.id === queueId)
    if (index !== -1) {
      audioQueue.value.splice(index, 1)
      log('Removed from queue:', queueId)
      return { success: true }
    }
    return { success: false, error: 'Queue item not found' }
  }

  const clearQueue = () => {
    audioQueue.value = []
    currentIndex.value = -1
    isQueueMode.value = false
    log('Queue cleared')
  }

  const playNext = async () => {
    if (!hasNext.value) {
      return { success: false, error: 'No next item in queue' }
    }

    currentIndex.value++
    const nextItem = audioQueue.value[currentIndex.value]
    return await playAudioBlob(nextItem.blob, nextItem.metadata)
  }

  const playPrevious = async () => {
    if (!hasPrevious.value) {
      return { success: false, error: 'No previous item in queue' }
    }

    currentIndex.value--
    const previousItem = audioQueue.value[currentIndex.value]
    return await playAudioBlob(previousItem.blob, previousItem.metadata)
  }

  /**
   * 音頻事件處理器
   */
  const handleLoadStart = () => {
    log('Audio loading started')
    isLoading.value = true
  }

  const handleLoadedMetadata = () => {
    if (audioElement) {
      duration.value = audioElement.duration || 0
      log('Audio metadata loaded, duration:', duration.value, 'seconds')
    }
  }

  const handleLoadedData = () => {
    log('Audio data loaded')
  }

  const handleCanPlay = () => {
    canPlay.value = true
    isLoading.value = false
    log('Audio can play')
  }

  const handleCanPlayThrough = () => {
    log('Audio can play through')
  }

  const handlePlay = () => {
    isPlaying.value = true
    isPaused.value = false
    hasEnded.value = false
    startTimers()
    log('Audio playback started')
  }

  const handlePause = () => {
    isPlaying.value = false
    isPaused.value = true
    stopTimers()
    log('Audio playback paused')
  }

  const handleEnded = () => {
    isPlaying.value = false
    isPaused.value = false
    hasEnded.value = true
    stopTimers()
    log('Audio playback ended')

    // 自動播放下一首（如果在隊列模式）
    if (isQueueMode.value && hasNext.value) {
      setTimeout(() => {
        playNext().catch(error => {
          console.error('Failed to auto-play next:', error)
        })
      }, 100)
    }
  }

  const handleTimeUpdate = () => {
    if (audioElement) {
      currentTime.value = audioElement.currentTime
    }
  }

  const handleProgress = () => {
    if (audioElement && audioElement.buffered.length > 0) {
      const bufferedEnd = audioElement.buffered.end(audioElement.buffered.length - 1)
      bufferProgress.value = duration.value > 0 ? (bufferedEnd / duration.value) * 100 : 0
    }
  }

  const handleAudioError = (event) => {
    const error = event.target?.error
    const errorMessage = error ? `Audio error: ${error.message} (code: ${error.code})` : 'Unknown audio error'
    
    console.error('Audio element error:', errorMessage)
    lastError.value = errorMessage
    loadError.value = errorMessage
    isLoading.value = false
    canPlay.value = false

    handlePlayerError(new Error(errorMessage))
  }

  const handleStalled = () => {
    log('Audio loading stalled')
  }

  const handleWaiting = () => {
    log('Audio waiting for data')
    isLoading.value = true
  }

  /**
   * 工具方法
   */
  const startTimers = () => {
    // 時間更新計時器（用於更精確的時間更新）
    timeUpdateTimer = setInterval(() => {
      if (audioElement && isPlaying.value) {
        currentTime.value = audioElement.currentTime
      }
    }, 100)
  }

  const clearTimers = () => {
    if (timeUpdateTimer) {
      clearInterval(timeUpdateTimer)
      timeUpdateTimer = null
    }
  }

  const resetPlaybackState = () => {
    isPlaying.value = false
    isPaused.value = false
    isLoading.value = false
    canPlay.value = false
    hasEnded.value = false
    duration.value = 0
    currentTime.value = 0
    bufferProgress.value = 0
    loadError.value = null
  }

  const removeAudioEventListeners = (audio) => {
    if (!audio) return

    const events = [
      'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
      'play', 'pause', 'ended', 'timeupdate', 'progress', 'error', 'stalled', 'waiting'
    ]

    events.forEach(event => {
      audio.removeEventListener(event, getEventHandler(event))
    })
  }

  const getEventHandler = (eventName) => {
    const handlers = {
      loadstart: handleLoadStart,
      loadedmetadata: handleLoadedMetadata,
      loadeddata: handleLoadedData,
      canplay: handleCanPlay,
      canplaythrough: handleCanPlayThrough,
      play: handlePlay,
      pause: handlePause,
      ended: handleEnded,
      timeupdate: handleTimeUpdate,
      progress: handleProgress,
      error: handleAudioError,
      stalled: handleStalled,
      waiting: handleWaiting
    }
    return handlers[eventName]
  }

  /**
   * 更新配置
   */
  const updateConfig = (newConfig) => {
    config.value = { ...config.value, ...newConfig }
    
    // 應用新配置到當前播放
    if (audioElement) {
      if (newConfig.volume !== undefined) {
        setVolume(newConfig.volume)
      }
      if (newConfig.playbackRate !== undefined) {
        setPlaybackRate(newConfig.playbackRate)
      }
    }

    log('Configuration updated:', newConfig)
  }

  /**
   * 釋放資源
   */
  const dispose = () => {
    log('Disposing audio player...')
    
    // 停止播放
    stopAudio()
    
    // 清理隊列
    clearQueue()
    
    // 重置狀態
    resetPlaybackState()
    
    log('Audio player disposed')
  }

  /**
   * 日誌輸出
   */
  const log = (message, ...args) => {
    if (config.value.enableLogging) {
      console.log(`[useAudioPlayer] ${message}`, ...args)
    }
  }

  // 組件卸載時清理資源
  onUnmounted(() => {
    dispose()
  })

  return {
    // ===== 響應式狀態 =====
    isPlaying,
    isPaused,
    isLoading,
    duration,
    currentTime,
    volume,
    playbackRate,
    canPlay,
    hasEnded,
    bufferProgress,
    lastError,
    loadError,
    
    // ===== 隊列狀態 =====
    audioQueue,
    currentIndex,
    isQueueMode,
    
    // ===== 計算屬性 =====
    isReady,
    canResume,
    canPause,
    progress,
    hasQueue,
    hasNext,
    hasPrevious,
    playerState,
    
    // ===== 核心播放方法 =====
    playAudioBlob,
    playAudioUrl,
    playAudio,
    pauseAudio,
    stopAudio,
    togglePlayback,
    
    // ===== 控制方法 =====
    seekTo,
    setVolume,
    setPlaybackRate,
    
    // ===== 隊列方法 =====
    addToQueue,
    removeFromQueue,
    clearQueue,
    playNext,
    playPrevious,
    
    // ===== 配置方法 =====
    updateConfig,
    
    // ===== 工具方法 =====
    dispose
  }
}

export default useAudioPlayer