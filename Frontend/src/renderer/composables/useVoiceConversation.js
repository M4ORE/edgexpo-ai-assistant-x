// src/renderer/composables/useVoiceConversation.js
import { ref, computed, onUnmounted } from "vue";
import {
  getVoiceRecordingService,
  getAIConversationService,
  initializeVoiceRecording,
  processVoiceConversation as processVoiceConversationAPI,
} from "../services/index.js";
import { useErrorHandler, ERROR_STRATEGIES } from "./useErrorHandler.js";

/**
 * 語音對話管理 Composable
 * 整合語音錄製、AI對話API和音頻播放的完整流程
 *
 * @param {Object} options 配置選項
 * @returns {Object} 語音對話相關的響應式資料和方法
 */
export function useVoiceConversation(options = {}) {
  // 錯誤處理
  const { createContextHandler } = useErrorHandler();
  const handleVoiceError = createContextHandler("voice", {
    strategy: ERROR_STRATEGIES.FALLBACK,
    maxRetries: 2,
  });

  // ===== 服務實例 =====
  let voiceRecordingService = null;
  let aiConversationService = null;

  // ===== 核心狀態 =====
  const isInitialized = ref(false);
  const isRecording = ref(false);
  const isProcessing = ref(false);
  const isPlaying = ref(false);
  const currentLanguage = ref("zh");

  // ===== 語音檢測狀態 =====
  const isSpeaking = ref(false);
  const currentVolume = ref(0);
  const vadEnabled = ref(true);

  // ===== 處理狀態 =====
  const currentStep = ref("idle"); // idle, recording, asr, rag, tts, playing, completed, error
  const currentStepText = ref("");
  const processingProgress = ref(0);

  // ===== 對話數據 =====
  const conversations = ref([]);
  const lastUserText = ref("");
  const lastAiText = ref("");
  const lastAudioBlob = ref(null);

  // ===== 錯誤狀態 =====
  const lastError = ref(null);
  const errorCount = ref(0);

  // ===== 音頻播放 =====
  let currentAudio = null;

  // ===== 配置 =====
  const config = ref({
    apiEndpoint: import.meta.env.VITE_API_BASE_URL,
    language: "zh-TW",
    vadSettings: {
      silenceThreshold: 30,
      vadTimeout: 1500,
      enableVAD: true,
      autoStopOnSilence: true,
    },
    ttsSettings: {
      voice: "default",
      speed: 1.0,
      pitch: 1.0,
    },
    enableLogging: true,
    ...options,
  });

  // ===== 計算屬性 =====
  const isSystemReady = computed(
    () => isInitialized.value && !isProcessing.value
  );
  const canStartRecording = computed(
    () => isSystemReady.value && !isRecording.value && !isPlaying.value
  );
  const canStopRecording = computed(() => isRecording.value);

  const stepDisplayText = computed(() => {
    const stepTexts = {
      idle: "準備就緒",
      recording: "正在聽取...",
      asr: "正在識別語音...",
      rag: "正在思考回應...",
      tts: "正在生成語音...",
      playing: "正在播放回應...",
      completed: "對話完成",
      error: "發生錯誤",
    };
    return (
      currentStepText.value || stepTexts[currentStep.value] || currentStep.value
    );
  });

  /**
   * 初始化語音對話系統
   */
  const initialize = async () => {
    try {
      log("Initializing voice conversation system...");

      // 獲取服務實例
      voiceRecordingService = getVoiceRecordingService();
      aiConversationService = getAIConversationService();

      // 更新服務配置
      voiceRecordingService.updateVADSettings({
        ...config.value.vadSettings,
        enableLogging: config.value.enableLogging,
      });

      aiConversationService.updateConfig({
        language: config.value.language,
        enableLogging: config.value.enableLogging,
      });

      // 設置語音錄製回調
      voiceRecordingService.setCallbacks({
        onRecordingStart: handleRecordingStart,
        onRecordingStop: handleRecordingStop,
        onSpeechStart: handleSpeechStart,
        onSpeechEnd: handleSpeechEnd,
        onVolumeChange: handleVolumeChange,
        onAutoStop: handleAutoStop,
        onError: (error) => handleVoiceError(error),
      });

      // 初始化語音錄製服務
      const initResult = await voiceRecordingService.initialize();
      if (!initResult.success) {
        throw new Error(
          `Voice recording initialization failed: ${initResult.error}`
        );
      }

      // 健康檢查
      const healthResult = await aiConversationService.healthCheck();
      if (!healthResult.success) {
        log(
          "Warning: AI service health check failed, but continuing...",
          healthResult.error
        );
      }

      isInitialized.value = true;
      lastError.value = null;
      log("Voice conversation system initialized successfully");

      return { success: true };
    } catch (error) {
      console.error("Failed to initialize voice conversation system:", error);
      lastError.value = error.message;
      isInitialized.value = false;

      return { success: false, error: error.message };
    }
  };

  /**
   * 開始語音錄製
   */
  const startRecording = async () => {
    if (!canStartRecording.value) {
      const error = "Cannot start recording: system not ready";
      log(error);
      return { success: false, error };
    }

    try {
      log("Starting voice recording...");

      // 重置狀態
      lastError.value = null;
      currentStep.value = "recording";
      processingProgress.value = 0;

      // 開始錄製
      const result = await voiceRecordingService.startRecording();
      if (!result.success) {
        throw new Error(result.error);
      }

      isRecording.value = true;
      log("Voice recording started successfully");

      return { success: true };
    } catch (error) {
      console.error("Failed to start recording:", error);
      lastError.value = error.message;
      currentStep.value = "error";

      return handleVoiceError(error);
    }
  };

  /**
   * 停止語音錄製並處理對話
   */
  const stopRecording = async () => {
    if (!canStopRecording.value) {
      const error = "Cannot stop recording: not currently recording";
      log(error);
      return { success: false, error };
    }

    try {
      log("Stopping voice recording...");
      isProcessing.value = true;

      // 停止錄製並獲取音頻
      const recordResult = await voiceRecordingService.stopRecording();
      if (!recordResult.success) {
        throw new Error(recordResult.error);
      }

      isRecording.value = false;
      const audioBlob = recordResult.audioBlob;

      log("Audio recorded:", audioBlob.size, "bytes");

      // 處理完整的對話流程
      const conversationResult = await processConversation(audioBlob);

      isProcessing.value = false;

      if (conversationResult.success) {
        currentStep.value = "completed";
        processingProgress.value = 100;
      } else {
        currentStep.value = "error";
        lastError.value = conversationResult.error;
      }

      return conversationResult;
    } catch (error) {
      console.error(
        "Failed to stop recording and process conversation:",
        error
      );
      isRecording.value = false;
      isProcessing.value = false;
      currentStep.value = "error";
      lastError.value = error.message;

      return handleVoiceError(error);
    }
  };

  /**
   * 處理完整的對話流程
   */
  const processConversation = async (audioBlob) => {
    try {
      log("Processing complete conversation flow...");

      const progressCallback = (step, message) => {
        currentStep.value = step;
        currentStepText.value = message;

        // 更新進度
        const stepProgress = {
          asr: 33,
          rag: 66,
          tts: 90,
          completed: 100,
        };
        processingProgress.value = stepProgress[step] || 0;

        log(`Progress: ${step} - ${message}`);
      };

      // 執行完整的AI對話流程 (使用統一API)
      const result = await processVoiceConversationAPI(
        audioBlob,
        {
          language: currentLanguage.value === "zh" ? "zh-TW" : "en",
          voice: config.value.ttsSettings.voice,
          speed: config.value.ttsSettings.speed,
        },
        progressCallback
      );

      if (result.success) {
        // 保存對話數據
        lastUserText.value = result.userText;
        lastAiText.value = result.aiText;
        lastAudioBlob.value = result.aiAudioBlob;

        // 添加到對話列表
        addConversation("user", result.userText);
        addConversation("ai", result.aiText);

        // 播放AI回應語音
        if (result.aiAudioBlob) {
          await playAudioResponse(result.aiAudioBlob);
        }

        log("Conversation processed successfully");
        log("Timings:", result.timings);

        return { success: true, result };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Conversation processing failed:", error);
      return { success: false, error: error.message };
    }
  };

  /**
   * 播放AI回應音頻
   */
  const playAudioResponse = async (audioBlob) => {
    try {
      log("Playing AI audio response...");
      currentStep.value = "playing";

      // 停止當前播放的音頻
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }

      // 創建音頻URL
      const audioUrl = URL.createObjectURL(audioBlob);
      currentAudio = new Audio(audioUrl);

      // 設置事件監聽器
      currentAudio.onloadstart = () => {
        isPlaying.value = true;
      };

      currentAudio.onended = () => {
        isPlaying.value = false;
        currentStep.value = "completed";
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        log("Audio playback completed");
      };

      currentAudio.onerror = (error) => {
        isPlaying.value = false;
        currentStep.value = "error";
        lastError.value = "Audio playback failed";
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        console.error("Audio playback error:", error);
      };

      // 開始播放
      await currentAudio.play();
      log("Audio playback started");
    } catch (error) {
      console.error("Failed to play audio response:", error);
      isPlaying.value = false;
      currentStep.value = "error";
      lastError.value = error.message;
    }
  };

  /**
   * 停止音頻播放
   */
  const stopAudioPlayback = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
      isPlaying.value = false;
      log("Audio playback stopped");
    }
  };

  /**
   * 切換錄製狀態
   */
  const toggleRecording = async () => {
    if (isRecording.value) {
      return await stopRecording();
    } else {
      return await startRecording();
    }
  };

  /**
   * 添加對話記錄
   */
  const addConversation = (role, text, timestamp = Date.now()) => {
    const conversation = {
      id: Date.now() + Math.random(),
      role,
      text,
      timestamp,
      original: text,
      // 支援翻譯顯示 (如果需要)
      translated:
        role === "user" && currentLanguage.value === "en" ? text : null,
    };

    conversations.value.push(conversation);
    log("Added conversation:", conversation);
  };

  /**
   * 清除對話記錄
   */
  const clearConversations = () => {
    conversations.value = [];
    lastUserText.value = "";
    lastAiText.value = "";
    lastAudioBlob.value = null;
    log("Conversations cleared");
  };

  /**
   * 切換語言
   */
  const switchLanguage = (newLanguage) => {
    currentLanguage.value = newLanguage;
    const langCode = newLanguage === "zh" ? "zh-TW" : "en";

    // 更新AI服務配置
    if (aiConversationService) {
      aiConversationService.updateConfig({ language: langCode });
    }

    log("Language switched to:", newLanguage, langCode);
  };

  /**
   * 更新配置
   */
  const updateConfig = (newConfig) => {
    config.value = { ...config.value, ...newConfig };

    // 更新服務配置
    if (voiceRecordingService && newConfig.vadSettings) {
      voiceRecordingService.updateVADSettings(newConfig.vadSettings);
    }

    if (aiConversationService) {
      aiConversationService.updateConfig(newConfig);
    }

    log("Configuration updated:", newConfig);
  };

  // ===== 事件處理器 =====
  const handleRecordingStart = () => {
    isRecording.value = true;
    log("Recording started event");
  };

  const handleRecordingStop = (data) => {
    isRecording.value = false;
    log("Recording stopped event:", data);
  };

  const handleSpeechStart = (data) => {
    isSpeaking.value = true;
    log("Speech started:", data);
  };

  const handleSpeechEnd = (data) => {
    isSpeaking.value = false;
    log("Speech ended:", data);
  };

  const handleVolumeChange = (volume, audioData) => {
    currentVolume.value = volume;
    // audioData 可用於音頻可視化
  };

  const handleAutoStop = async (data) => {
    log("Auto-stop triggered by VAD:", data);

    // 檢查是否仍在錄製狀態
    if (!isRecording.value) {
      log("Auto-stop called but not recording, ignoring");
      return;
    }

    // 自動觸發停止錄製和處理流程
    try {
      log("Processing auto-stop...");
      currentStep.value = "processing";

      const result = await stopRecording();
      if (result && result.success) {
        log("Auto-stop processing completed successfully");
      } else {
        log("Auto-stop processing failed:", result?.error);
      }
    } catch (error) {
      console.error("Error in auto-stop handling:", error);
      handleVoiceError(error);
    }
  };

  /**
   * 獲取系統狀態
   */
  const getSystemStatus = () => {
    return {
      isInitialized: isInitialized.value,
      isRecording: isRecording.value,
      isProcessing: isProcessing.value,
      isPlaying: isPlaying.value,
      currentStep: currentStep.value,
      processingProgress: processingProgress.value,
      conversationCount: conversations.value.length,
      lastError: lastError.value,
      vadEnabled: vadEnabled.value,
      currentVolume: currentVolume.value,
      isSpeaking: isSpeaking.value,
    };
  };

  /**
   * 重置狀態
   */
  const resetState = () => {
    currentStep.value = "idle";
    currentStepText.value = "";
    processingProgress.value = 0;
    lastError.value = null;
    errorCount.value = 0;
    isSpeaking.value = false;
    currentVolume.value = 0;

    // 停止所有活動
    stopAudioPlayback();

    log("State reset");
  };

  /**
   * 釋放資源
   */
  const dispose = () => {
    log("Disposing voice conversation system...");

    // 停止所有活動
    stopAudioPlayback();

    // 釋放服務
    if (voiceRecordingService) {
      voiceRecordingService.dispose();
      voiceRecordingService = null;
    }

    if (aiConversationService) {
      aiConversationService = null;
    }

    // 重置狀態
    isInitialized.value = false;
    resetState();

    log("Voice conversation system disposed");
  };

  /**
   * 日誌輸出
   */
  const log = (message, ...args) => {
    if (config.value.enableLogging) {
      console.log(`[useVoiceConversation] ${message}`, ...args);
    }
  };

  // 組件卸載時清理資源
  onUnmounted(() => {
    dispose();
  });

  return {
    // ===== 響應式狀態 =====
    isInitialized,
    isRecording,
    isProcessing,
    isPlaying,
    currentLanguage,
    isSpeaking,
    currentVolume,
    currentStep,
    stepDisplayText,
    processingProgress,
    conversations,
    lastUserText,
    lastAiText,
    lastError,

    // ===== 計算屬性 =====
    isSystemReady,
    canStartRecording,
    canStopRecording,

    // ===== 核心方法 =====
    initialize,
    startRecording,
    stopRecording,
    toggleRecording,
    stopAudioPlayback,

    // ===== 對話管理 =====
    addConversation,
    clearConversations,

    // ===== 配置管理 =====
    switchLanguage,
    updateConfig,

    // ===== 工具方法 =====
    getSystemStatus,
    resetState,
    dispose,
  };
}

export default useVoiceConversation;
