// src/renderer/composables/useVoiceErrorHandler.js
import { ref } from "vue";

/**
 * 語音對話專用錯誤處理 Composable
 * 提供語音相關錯誤的友好提示和恢復機制
 */
export function useVoiceErrorHandler() {
  const errorHistory = ref([]);
  const lastNotifiedError = ref(null);
  const errorCounts = ref(new Map());

  // 錯誤類型與用戶友好提示的映射
  const errorMessages = {
    // 權限相關
    "Permission denied": "無法存取麥克風，請檢查瀏覽器設定並允許麥克風權限",
    NotAllowedError: "麥克風權限被拒絕，請在瀏覽器設定中允許此網站存取麥克風",
    NotFoundError: "找不到可用的麥克風設備，請檢查麥克風是否正確連接",
    NotReadableError: "麥克風被其他應用程式佔用，請關閉其他使用麥克風的程式",

    // 網絡相關
    NetworkError: "網路連線失敗，請檢查網路連線狀態",
    "fetch failed": "API 服務無法連線，請稍後再試",
    "API request failed": "API 服務暫時不可用，請稍後再試",

    // 音頻相關
    "Audio load error": "音頻載入失敗，請重新嘗試",
    "Audio playback failed": "音頻播放失敗，請檢查音量設定",
    "MediaRecorder error": "錄音功能異常，請重新整理頁面並再次嘗試",

    // API 相關
    "ASR API error": "語音識別服務暫時不可用，請稍後再試",
    "RAG API error": "AI 回應服務暫時不可用，請稍後再試",
    "TTS API error": "語音合成服務暫時不可用，請稍後再試",
    "Invalid or empty audio blob": "錄音數據無效，請重新錄製",
    "No recorded data available":
      "沒有錄製到音頻數據，請確保麥克風正常工作並重新嘗試",

    // 系統相關
    "Browser does not support audio recording":
      "您的瀏覽器不支援音頻錄製功能，請使用較新版本的瀏覽器",
    "Voice recording initialization failed":
      "語音錄製系統初始化失敗，請重新整理頁面",
    "Audio context creation failed": "音頻系統初始化失敗，請重新整理頁面",
  };

  // 錯誤恢復建議
  const recoveryActions = {
    "Permission denied": [
      "點擊瀏覽器地址欄的麥克風圖標",
      '選擇"始終允許"',
      "重新整理頁面",
    ],
    NotAllowedError: [
      "點擊瀏覽器地址欄的麥克風圖標",
      '選擇"始終允許"',
      "重新整理頁面",
    ],
    NotFoundError: [
      "檢查麥克風是否正確連接",
      "嘗試重新連接麥克風",
      "重新整理頁面",
    ],
    NotReadableError: [
      "關閉其他使用麥克風的程式",
      "重新插拔麥克風",
      "重新整理頁面",
    ],
    NetworkError: ["檢查網路連線", "嘗試重新連線", "稍後再試"],
    "MediaRecorder error": [
      "重新整理頁面",
      "檢查瀏覽器版本",
      "嘗試使用其他瀏覽器",
    ],
  };

  /**
   * 處理語音相關錯誤
   * @param {Error|string} error 錯誤對象或錯誤訊息
   * @param {Object} context 錯誤上下文
   * @returns {Object} 處理後的錯誤信息
   */
  const handleVoiceError = (error, context = {}) => {
    const errorMessage = typeof error === "string" ? error : error.message;
    const errorType = getErrorType(errorMessage);

    // 記錄錯誤歷史
    const errorRecord = {
      message: errorMessage,
      type: errorType,
      timestamp: Date.now(),
      context,
      count: (errorCounts.value.get(errorType) || 0) + 1,
    };

    errorHistory.value.push(errorRecord);
    errorCounts.value.set(errorType, errorRecord.count);

    // 生成用戶友好的錯誤提示
    const userFriendlyMessage = getUserFriendlyMessage(errorMessage);
    const suggestions = getRecoveryActions(errorMessage);

    const result = {
      original: errorMessage,
      userMessage: userFriendlyMessage,
      suggestions,
      severity: getErrorSeverity(errorType),
      canRetry: canRetryError(errorType),
      shouldShowModal: shouldShowErrorModal(errorType, errorRecord.count),
      errorType,
      timestamp: errorRecord.timestamp,
    };

    console.error("[VoiceErrorHandler]", result);
    return result;
  };

  /**
   * 獲取錯誤類型
   */
  const getErrorType = (errorMessage) => {
    for (const [type, message] of Object.entries(errorMessages)) {
      if (errorMessage.includes(type) || errorMessage.includes(message)) {
        return type;
      }
    }
    return "Unknown";
  };

  /**
   * 獲取用戶友好的錯誤訊息
   */
  const getUserFriendlyMessage = (errorMessage) => {
    for (const [type, friendlyMessage] of Object.entries(errorMessages)) {
      if (errorMessage.includes(type)) {
        return friendlyMessage;
      }
    }

    // 根據關鍵詞匹配
    if (
      errorMessage.includes("permission") ||
      errorMessage.includes("denied")
    ) {
      return "需要麥克風權限才能使用語音功能，請允許權限並重試";
    }

    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "網路連線問題，請檢查網路狀態並重試";
    }

    if (errorMessage.includes("audio") || errorMessage.includes("media")) {
      return "音頻處理發生問題，請重新嘗試";
    }

    return "發生未知錯誤，請重試或重新整理頁面";
  };

  /**
   * 獲取恢復操作建議
   */
  const getRecoveryActions = (errorMessage) => {
    for (const [type, actions] of Object.entries(recoveryActions)) {
      if (errorMessage.includes(type)) {
        return actions;
      }
    }

    // 默認建議
    return ["重新嘗試操作", "檢查網路連線", "重新整理頁面"];
  };

  /**
   * 獲取錯誤嚴重程度
   */
  const getErrorSeverity = (errorType) => {
    const criticalErrors = [
      "Permission denied",
      "NotAllowedError",
      "Browser does not support audio recording",
    ];

    const warningErrors = [
      "NetworkError",
      "API request failed",
      "Audio load error",
    ];

    if (criticalErrors.includes(errorType)) return "critical";
    if (warningErrors.includes(errorType)) return "warning";
    return "info";
  };

  /**
   * 判斷錯誤是否可以重試
   */
  const canRetryError = (errorType) => {
    const nonRetryableErrors = [
      "Permission denied",
      "NotAllowedError",
      "NotFoundError",
      "Browser does not support audio recording",
    ];

    return !nonRetryableErrors.includes(errorType);
  };

  /**
   * 判斷是否應該顯示錯誤模態框
   */
  const shouldShowErrorModal = (errorType, count) => {
    // 權限相關錯誤總是顯示模態框
    if (errorType.includes("Permission") || errorType.includes("NotAllowed")) {
      return true;
    }

    // 連續3次相同錯誤顯示模態框
    if (count >= 3) {
      return true;
    }

    // 嚴重錯誤顯示模態框
    if (getErrorSeverity(errorType) === "critical") {
      return true;
    }

    return false;
  };

  /**
   * 清除錯誤歷史
   */
  const clearErrorHistory = () => {
    errorHistory.value = [];
    errorCounts.value.clear();
    lastNotifiedError.value = null;
  };

  /**
   * 獲取錯誤統計
   */
  const getErrorStats = () => {
    const stats = {
      total: errorHistory.value.length,
      byType: Object.fromEntries(errorCounts.value),
      recent: errorHistory.value.slice(-10),
      mostCommon: null,
    };

    // 找出最常見的錯誤
    let maxCount = 0;
    for (const [type, count] of errorCounts.value.entries()) {
      if (count > maxCount) {
        maxCount = count;
        stats.mostCommon = { type, count };
      }
    }

    return stats;
  };

  /**
   * 檢查系統健康狀態
   */
  const checkSystemHealth = async () => {
    const health = {
      microphone: false,
      network: false,
      browser: false,
      overall: false,
    };

    try {
      // 檢查瀏覽器支援
      health.browser = !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia &&
        window.MediaRecorder &&
        (window.AudioContext || window.webkitAudioContext)
      );

      // 檢查麥克風（非侵入性檢查）
      if (health.browser) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          health.microphone = devices.some(
            (device) => device.kind === "audioinput"
          );
        } catch (e) {
          health.microphone = false;
        }
      }

      // 檢查網路連線
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/health`,
          {
            method: "HEAD",
            timeout: 5000,
          }
        );
        health.network = response.ok;
      } catch (e) {
        health.network = false;
      }

      health.overall = health.browser && health.microphone && health.network;
    } catch (error) {
      console.error("Health check failed:", error);
    }

    return health;
  };

  return {
    // 狀態
    errorHistory,
    lastNotifiedError,
    errorCounts,

    // 方法
    handleVoiceError,
    clearErrorHistory,
    getErrorStats,
    checkSystemHealth,

    // 工具方法
    getUserFriendlyMessage,
    getRecoveryActions,
    getErrorSeverity,
    canRetryError,
    shouldShowErrorModal,
  };
}

export default useVoiceErrorHandler;
