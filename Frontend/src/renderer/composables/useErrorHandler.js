import { ref } from "vue";

// 錯誤類型定義
export const ERROR_TYPES = {
  NETWORK: "network",
  API: "api",
  VALIDATION: "validation",
  CACHE: "cache",
  FILE_UPLOAD: "file_upload",
  CONVERSATION: "conversation",
  AUTH: "auth",
  UNKNOWN: "unknown",
};

// 錯誤嚴重級別
export const ERROR_LEVELS = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
};

// 錯誤處理策略
export const ERROR_STRATEGIES = {
  SILENT: "silent", // 僅記錄，不顯示給用戶
  TOAST: "toast", // 顯示 toast 訊息
  MODAL: "modal", // 顯示模態對話框
  INLINE: "inline", // 內嵌錯誤顯示
  RETRY: "retry", // 提供重試選項
  FALLBACK: "fallback", // 使用降級方案
};

export function useErrorHandler() {
  const lastError = ref(null);
  const errorHistory = ref([]);

  // 錯誤分類映射
  const errorTypeMapping = {
    NetworkError: ERROR_TYPES.NETWORK,
    TypeError: ERROR_TYPES.VALIDATION,
    QuotaExceededError: ERROR_TYPES.CACHE,
    AbortError: ERROR_TYPES.NETWORK,
    TimeoutError: ERROR_TYPES.NETWORK,
  };

  // 根據錯誤內容自動分類
  const classifyError = (error) => {
    if (!error) return ERROR_TYPES.UNKNOWN;

    // 根據錯誤名稱分類
    if (errorTypeMapping[error.name]) {
      return errorTypeMapping[error.name];
    }

    // 根據錯誤訊息分類
    const message = error.message?.toLowerCase() || "";

    if (message.includes("network") || message.includes("fetch")) {
      return ERROR_TYPES.NETWORK;
    }
    if (message.includes("401") || message.includes("unauthorized")) {
      return ERROR_TYPES.AUTH;
    }
    if (message.includes("400") || message.includes("validation")) {
      return ERROR_TYPES.VALIDATION;
    }
    if (message.includes("conversation") || message.includes("對話")) {
      return ERROR_TYPES.CONVERSATION;
    }
    if (message.includes("upload") || message.includes("file")) {
      return ERROR_TYPES.FILE_UPLOAD;
    }
    if (message.includes("cache") || message.includes("localStorage")) {
      return ERROR_TYPES.CACHE;
    }

    return ERROR_TYPES.API;
  };

  // 確定錯誤級別
  const determineErrorLevel = (error, type) => {
    if (error.level) return error.level;

    switch (type) {
      case ERROR_TYPES.AUTH:
      case ERROR_TYPES.CRITICAL:
        return ERROR_LEVELS.CRITICAL;
      case ERROR_TYPES.NETWORK:
      case ERROR_TYPES.API:
        return ERROR_LEVELS.ERROR;
      case ERROR_TYPES.VALIDATION:
      case ERROR_TYPES.FILE_UPLOAD:
        return ERROR_LEVELS.WARNING;
      case ERROR_TYPES.CACHE:
        return ERROR_LEVELS.INFO;
      default:
        return ERROR_LEVELS.ERROR;
    }
  };

  // 獲取用戶友好的錯誤訊息
  const getUserFriendlyMessage = (error, type, context) => {
    // 如果錯誤已經有用戶友好的訊息
    if (error.userMessage) return error.userMessage;

    // 根據類型和上下文提供預設訊息
    const contextKey = context ? `errors.${context}.${type}` : `errors.${type}`;

    // 嘗試從 i18n 獲取本地化訊息
    const localizedMessage = t(contextKey, null, {
      default: null,
      fallbackWarn: false,
    });

    if (localizedMessage) return localizedMessage;

    // 降級到通用錯誤訊息
    switch (type) {
      case ERROR_TYPES.NETWORK:
        return t("errors.network", "網路連線異常，請檢查網路狀態");
      case ERROR_TYPES.API:
        return t("errors.api", "服務暫時無法使用，請稍後重試");
      case ERROR_TYPES.VALIDATION:
        return t("errors.validation", "輸入資料格式錯誤");
      case ERROR_TYPES.CACHE:
        return t("errors.cache", "快取操作失敗");
      case ERROR_TYPES.FILE_UPLOAD:
        return t("errors.fileUpload", "檔案上傳失敗");
      case ERROR_TYPES.CONVERSATION:
        return t("errors.conversation", "對話操作失敗");
      case ERROR_TYPES.AUTH:
        return t("errors.auth", "身份驗證失敗，請重新登入");
      default:
        return t("errors.unknown", "發生未知錯誤，請重試");
    }
  };

  // 確定處理策略
  const determineStrategy = (error, type, level, options = {}) => {
    // 優先使用明確指定的策略
    if (options.strategy) return options.strategy;

    // 根據級別和類型自動選擇策略
    switch (level) {
      case ERROR_LEVELS.CRITICAL:
        return ERROR_STRATEGIES.MODAL;
      case ERROR_LEVELS.ERROR:
        if (type === ERROR_TYPES.NETWORK && options.hasCache) {
          return ERROR_STRATEGIES.FALLBACK;
        }
        return options.silent
          ? ERROR_STRATEGIES.SILENT
          : ERROR_STRATEGIES.TOAST;
      case ERROR_LEVELS.WARNING:
        return ERROR_STRATEGIES.INLINE;
      case ERROR_LEVELS.INFO:
        return ERROR_STRATEGIES.SILENT;
      default:
        return ERROR_STRATEGIES.TOAST;
    }
  };

  // 執行錯誤處理策略
  const executeStrategy = (strategy, message, error, options = {}) => {
    switch (strategy) {
      case ERROR_STRATEGIES.SILENT:
        // 僅記錄，不顯示
        break;

      case ERROR_STRATEGIES.TOAST:
        // 顯示 toast（需要 UI 框架支援）
        if (options.showToast) {
          options.showToast(message, "error");
        } else {
          console.warn("Toast 顯示功能未配置:", message);
        }
        break;

      case ERROR_STRATEGIES.MODAL:
        // 顯示模態對話框
        if (options.showModal) {
          options.showModal({
            title: t("errors.title", "錯誤"),
            message: message,
            type: "error",
          });
        } else {
          // 降級到 alert
          alert(message);
        }
        break;

      case ERROR_STRATEGIES.INLINE:
        // 內嵌錯誤顯示（由調用方處理）
        if (options.onInlineError) {
          options.onInlineError(message, error);
        }
        break;

      case ERROR_STRATEGIES.RETRY:
        // 提供重試選項
        if (options.onRetry) {
          const retry = confirm(`${message}\n\n是否重試？`);
          if (retry) {
            options.onRetry();
          }
        }
        break;

      case ERROR_STRATEGIES.FALLBACK:
        // 使用降級方案
        if (options.onFallback) {
          options.onFallback(error);
        }
        break;
    }
  };

  // 記錄錯誤到歷史
  const logError = (error, type, level, context) => {
    const errorRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      type,
      level,
      context,
      userAgent: navigator.userAgent,
    };

    errorHistory.value.unshift(errorRecord);

    // 保持歷史記錄在合理範圍內
    if (errorHistory.value.length > 100) {
      errorHistory.value = errorHistory.value.slice(0, 100);
    }

    // 關鍵錯誤發送到監控服務
    if (level === ERROR_LEVELS.CRITICAL) {
      sendToMonitoring(errorRecord);
    }
  };

  // 發送到監控服務（佔位符）
  const sendToMonitoring = (errorRecord) => {
    try {
      // 這裡可以集成錯誤監控服務如 Sentry
      console.error("Critical Error:", errorRecord);
    } catch (e) {
      console.warn("Failed to send error to monitoring:", e);
    }
  };

  // 主要的錯誤處理函數
  const handleError = (error, context = "", options = {}) => {
    if (!error) return;

    try {
      // 分類錯誤
      const type = options.type || classifyError(error);
      const level = options.level || determineErrorLevel(error, type);

      // 記錄錯誤
      console.error(`[${context || "Unknown"}][${type}][${level}]`, error);
      logError(error, type, level, context);

      // 更新最新錯誤
      lastError.value = {
        error,
        type,
        level,
        context,
        timestamp: Date.now(),
      };

      // 獲取用戶友好訊息
      const userMessage = getUserFriendlyMessage(error, type, context);

      // 確定處理策略
      const strategy = determineStrategy(error, type, level, options);

      // 執行處理策略
      executeStrategy(strategy, userMessage, error, options);

      return {
        type,
        level,
        strategy,
        userMessage,
        handled: true,
      };
    } catch (handlingError) {
      console.error("Error handling failed:", handlingError);

      // 降級處理
      const fallbackMessage = "系統發生錯誤，請重新載入頁面";
      if (options.showToast) {
        options.showToast(fallbackMessage, "error");
      } else {
        alert(fallbackMessage);
      }

      return {
        type: ERROR_TYPES.UNKNOWN,
        level: ERROR_LEVELS.CRITICAL,
        strategy: ERROR_STRATEGIES.MODAL,
        userMessage: fallbackMessage,
        handled: false,
      };
    }
  };

  // 創建帶有上下文的錯誤處理器
  const createContextHandler = (context, defaultOptions = {}) => {
    return (error, options = {}) => {
      return handleError(error, context, { ...defaultOptions, ...options });
    };
  };

  // 清除錯誤狀態
  const clearError = () => {
    lastError.value = null;
  };

  // 獲取錯誤統計
  const getErrorStats = () => {
    const stats = errorHistory.value.reduce(
      (acc, record) => {
        acc.total++;
        acc.byType[record.type] = (acc.byType[record.type] || 0) + 1;
        acc.byLevel[record.level] = (acc.byLevel[record.level] || 0) + 1;
        return acc;
      },
      {
        total: 0,
        byType: {},
        byLevel: {},
      }
    );

    return stats;
  };

  return {
    // 核心功能
    handleError,
    createContextHandler,

    // 狀態
    lastError,
    errorHistory,

    // 工具函數
    clearError,
    getErrorStats,
    classifyError,
    determineErrorLevel,
    getUserFriendlyMessage,

    // 常數
    ERROR_TYPES,
    ERROR_LEVELS,
    ERROR_STRATEGIES,
  };
}

// 預設的錯誤處理器實例（單例模式）
let defaultErrorHandler = null;

export function getDefaultErrorHandler() {
  if (!defaultErrorHandler) {
    defaultErrorHandler = useErrorHandler();
  }
  return defaultErrorHandler;
}
