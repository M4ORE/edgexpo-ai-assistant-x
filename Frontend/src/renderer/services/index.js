// src/renderer/services/index.js
/**
 * EdgExpo AI Assistant X API服務統一入口
 */

import { BaseApiService } from "./base.js";
import { AIConversationService } from "./AIConversationService.js";
import { VoiceRecordingService } from "./VoiceRecordingService.js";
import { BusinessCardService } from "./BusinessCardService.js";

// 從環境變量獲取配置
const API_CONFIG = {
  // 本地 API (ASR, RAG, TTS, CRM)
  localBaseURL: import.meta.env.VITE_LOCAL_API_BASE_URL || "http://localhost:5000",
  // 遠端 API (OCR, Marketing)
  remoteBaseURL: import.meta.env.VITE_REMOTE_API_BASE_URL || "https://x.m4ore.com:8451",
  // 向後兼容
  baseURL: import.meta.env.VITE_API_BASE_URL || "https://x.m4ore.com:8451",
  enableLogging: import.meta.env.VITE_ENABLE_LOGGING === "true" || true, // 強制啟用日誌
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 60000,
};

// 臨時強制設置，測試用
console.log('[ServiceManager] Force setting API URLs for testing...');
API_CONFIG.localBaseURL = "http://localhost:5000";
API_CONFIG.remoteBaseURL = "https://x.m4ore.com:8451";
console.log('[ServiceManager] Forced config:', API_CONFIG);

// 創建服務實例（單例模式）
let serviceInstances = null;

/**
 * 初始化所有服務實例
 * @param {Object} config 自定義配置
 * @returns {Object} 服務實例集合
 */
export const initializeServices = (config = {}) => {
  const finalConfig = { ...API_CONFIG, ...config };
  
  // 調試：檢查環境變數載入
  console.log('[ServiceManager] Environment variables:');
  console.log('  VITE_LOCAL_API_BASE_URL:', import.meta.env.VITE_LOCAL_API_BASE_URL);
  console.log('  VITE_REMOTE_API_BASE_URL:', import.meta.env.VITE_REMOTE_API_BASE_URL);
  console.log('  VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  
  console.log('[ServiceManager] Final config:');
  console.log('  localBaseURL:', finalConfig.localBaseURL);
  console.log('  remoteBaseURL:', finalConfig.remoteBaseURL);
  console.log('  baseURL:', finalConfig.baseURL);

  serviceInstances = {
    // AI對話服務 - 使用本地 API
    aiConversation: new AIConversationService({
      ...finalConfig,
      baseURL: finalConfig.localBaseURL
    }),

    // 語音錄製服務
    voiceRecording: new VoiceRecordingService({
      enableLogging: finalConfig.enableLogging,
      enableVAD: true,
      autoStopOnSilence: true,
      vadTimeout: import.meta.env.VITE_VAD_TIMEOUT || 5000,
      silenceThreshold: import.meta.env.VITE_SILENCE_THRESHOLD || 30,
    }),

    // 名片掃描服務 - 使用混合 API
    businessCard: new BusinessCardService({
      ...finalConfig,
      localBaseURL: finalConfig.localBaseURL,    // CRM 使用本地
      remoteBaseURL: finalConfig.remoteBaseURL,  // OCR, Marketing 使用遠端
    }),
  };

  console.log(
    "[ServiceManager] Services initialized with config:",
    finalConfig
  );
  return serviceInstances;
};

/**
 * 獲取服務實例（自動初始化）
 * @returns {Object} 服務實例集合
 */
export const getServices = () => {
  if (!serviceInstances) {
    initializeServices();
  }
  return serviceInstances;
};

/**
 * 獲取AI對話服務
 * @returns {AIConversationService}
 */
export const getAIConversationService = () => {
  return getServices().aiConversation;
};

/**
 * 獲取語音錄製服務
 * @returns {VoiceRecordingService}
 */
export const getVoiceRecordingService = () => {
  return getServices().voiceRecording;
};

/**
 * 獲取名片掃描服務
 * @returns {BusinessCardService}
 */
export const getBusinessCardService = () => {
  return getServices().businessCard;
};

/**
 * 系統健康檢查
 * @returns {Promise<Object>} 所有服務的健康狀態
 */
export const systemHealthCheck = async () => {
  try {
    const services = getServices();

    const healthChecks = await Promise.allSettled([
      services.aiConversation.healthCheck(),
    ]);

    const results = {
      timestamp: Date.now(),
      overall: true,
      services: {
        aiConversation:
          healthChecks[0].status === "fulfilled"
            ? healthChecks[0].value
            : { success: false, error: healthChecks[0].reason?.message },
      },
    };

    // 檢查整體狀態
    results.overall = Object.values(results.services).every(
      (service) => service.success
    );

    console.log("[SystemHealth] Health check completed:", results);
    return results;
  } catch (error) {
    console.error("[SystemHealth] Health check failed:", error);
    return {
      timestamp: Date.now(),
      overall: false,
      error: error.message,
      services: {},
    };
  }
};

/**
 * 重置所有服務實例
 * @param {Object} config 新配置
 * @returns {Object} 新的服務實例集合
 */
export const resetServices = (config = {}) => {
  // 清理現有實例
  if (serviceInstances) {
    if (
      serviceInstances.voiceRecording &&
      typeof serviceInstances.voiceRecording.dispose === "function"
    ) {
      serviceInstances.voiceRecording.dispose();
    }
  }

  serviceInstances = null;
  return initializeServices(config);
};

/**
 * 便捷方法 - AI對話相關
 */

// STT → RAG → TTS 完整流程
export const processVoiceConversation = async (
  audioBlob,
  options = {},
  onProgress = null
) => {
  const aiService = getAIConversationService();
  return await aiService.processVoiceConversation(
    audioBlob,
    options,
    onProgress
  );
};

// 單獨的ASR（語音轉文字）
export const speechToText = async (audioBlob, options = {}) => {
  const aiService = getAIConversationService();
  return await aiService.speechToText(audioBlob, options);
};

// 單獨的RAG（AI回應生成）
export const generateAIResponse = async (text, options = {}) => {
  const aiService = getAIConversationService();
  return await aiService.generateAIResponse(text, options);
};

// 單獨的TTS（文字轉語音）
export const textToSpeech = async (text, options = {}) => {
  const aiService = getAIConversationService();
  return await aiService.textToSpeech(text, options);
};

/**
 * 便捷方法 - 語音錄製相關
 */

// 初始化語音錄製
export const initializeVoiceRecording = async () => {
  const voiceService = getVoiceRecordingService();
  return await voiceService.initialize();
};

// 開始錄製
export const startVoiceRecording = async () => {
  const voiceService = getVoiceRecordingService();
  return await voiceService.startRecording();
};

// 停止錄製
export const stopVoiceRecording = async () => {
  const voiceService = getVoiceRecordingService();
  return await voiceService.stopRecording();
};

/**
 * 便捷方法 - 名片掃描相關
 */

// 完整名片處理流程（OCR + CRM + 發送目錄）
export const processBusinessCard = async (
  imageFile,
  options = {},
  onProgress = null
) => {
  const cardService = getBusinessCardService();
  return await cardService.processBusinessCardComplete(
    imageFile,
    options,
    onProgress
  );
};

// 單獨的OCR識別
export const scanBusinessCard = async (imageFile, options = {}) => {
  const cardService = getBusinessCardService();
  return await cardService.scanBusinessCard(imageFile, options);
};

// 儲存聯絡人
export const saveContact = async (contactData, options = {}) => {
  const cardService = getBusinessCardService();
  return await cardService.saveContact(contactData, options);
};

// 發送產品目錄
export const sendProductCatalog = async (contactId, options = {}) => {
  const cardService = getBusinessCardService();
  return await cardService.sendProductCatalog(contactId, options);
};

// 獲取聯絡人列表
export const getContacts = async (params = {}) => {
  const cardService = getBusinessCardService();
  return await cardService.getContacts(params);
};

/**
 * 預設導出服務集合
 */
export default {
  // 初始化
  initialize: initializeServices,
  get: getServices,
  reset: resetServices,
  healthCheck: systemHealthCheck,

  // 服務實例獲取
  getAIConversationService,
  getVoiceRecordingService,
  getBusinessCardService,

  // AI對話便捷方法
  processVoiceConversation,
  speechToText,
  generateAIResponse,
  textToSpeech,

  // 語音錄製便捷方法
  initializeVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,

  // 名片掃描便捷方法
  processBusinessCard,
  scanBusinessCard,
  saveContact,
  sendProductCatalog,
  getContacts,

  // 服務類別（用於手動實例化）
  BaseApiService,
  AIConversationService,
  VoiceRecordingService,
  BusinessCardService,
};
