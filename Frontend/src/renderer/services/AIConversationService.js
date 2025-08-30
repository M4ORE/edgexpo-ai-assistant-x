// src/renderer/services/AIConversationService.js
import { BaseApiService } from "./base.js";

/**
 * AI對話HTTP API服務
 * 整合ASR (語音轉文字) → RAG (知識檢索) → TTS (文字轉語音) 完整流程
 */
export class AIConversationService extends BaseApiService {
  constructor(config = {}) {
    super(config);

    this.config = {
      language: "zh-TW",
      enableLogging: true,
      ...config,
    };

    this.log("AIConversationService initialized");
  }

  /**
   * 語音轉文字 (ASR - Automatic Speech Recognition)
   * @param {Blob} audioBlob 音頻文件
   * @param {Object} options 選項
   * @returns {Promise<Object>} 轉錄結果
   */
  async speechToText(audioBlob, options = {}) {
    try {
      this.log("Starting ASR request...");

      // 創建FormData用於multipart/form-data上傳
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");

      // 添加可選參數
      if (options.language) {
        formData.append("language", options.language);
      }

      // 使用基礎API服務處理multipart/form-data
      const response = await this.post("/api/asr", formData);

      if (!response.success) {
        throw new Error(`ASR API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log("ASR response received:", result);

      // 檢查回應格式
      if (result.error) {
        throw new Error(`ASR API error: ${result.error}`);
      }

      const transcribedText =
        result.text || result.transcription || result.result || "";

      return {
        success: true,
        text: transcribedText.trim(),
        language: result.language || options.language || this.config.language,
        confidence: result.confidence || 1.0,
        duration: result.duration || 0,
        raw: result,
      };
    } catch (error) {
      console.error("ASR Error:", error);
      return {
        success: false,
        error: error.message,
        text: "",
      };
    }
  }

  /**
   * AI回應生成 (RAG - Retrieval Augmented Generation)
   * @param {string} text 用戶輸入文字
   * @param {Object} options 選項
   * @returns {Promise<Object>} AI回應結果
   */
  async generateAIResponse(text, options = {}) {
    try {
      this.log("Starting RAG request...", text);

      const requestData = {
        query: text,
        language: options.language || this.config.language,
        context: options.context || {},
        stream: false, // 目前使用非串流模式
        ...options.extraParams,
      };

      const response = await this.post("/api/rag", requestData);

      if (!response.success) {
        throw new Error(`RAG API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log("RAG response received:", result);

      // 檢查回應格式
      if (result.error) {
        throw new Error(`RAG API error: ${result.error}`);
      }

      const aiResponse =
        result.response || result.answer || result.text || result.result || "";

      return {
        success: true,
        text: aiResponse.trim(),
        confidence: result.confidence || 1.0,
        sources: result.sources || [],
        context: result.context || {},
        raw: result,
      };
    } catch (error) {
      console.error("RAG Error:", error);
      return {
        success: false,
        error: error.message,
        text: "Sorry, I cannot answer your question now.",
      };
    }
  }

  /**
   * 文字轉語音 (TTS - Text To Speech)
   * @param {string} text 要轉換的文字
   * @param {Object} options 選項
   * @returns {Promise<Object>} 音頻結果
   */
  async textToSpeech(text, options = {}) {
    try {
      this.log("Starting TTS request...", text);

      const requestData = {
        text: text,
        language: options.language || this.config.language,
        voice: options.voice || "default",
        speed: options.speed || 1.0,
        pitch: options.pitch || 1.0,
        format: options.format || "mp3",
        ...options.extraParams,
      };

      const response = await this.post("/api/tts", requestData);

      if (!response.success) {
        throw new Error(`TTS API request failed: ${response.error}`);
      }

      // 檢查回應類型
      if (response.mimeType && response.mimeType.includes("audio/")) {
        // 直接返回音頻數據
        const audioBlob = response.data;

        this.log("TTS audio blob received:", audioBlob.size, "bytes");

        return {
          success: true,
          audioBlob: audioBlob,
          mimeType: response.mimeType,
          size: audioBlob.size,
        };
      } else {
        // JSON回應，可能包含Base64編碼的音頻
        const result = response.data;

        if (result.error) {
          throw new Error(`TTS API error: ${result.error}`);
        }

        if (result.audio) {
          // 處理Base64編碼的音頻
          const audioData = result.audio;
          const audioBlob = this.base64ToBlob(audioData, "audio/mp3");

          this.log(
            "TTS base64 audio converted to blob:",
            audioBlob.size,
            "bytes"
          );

          return {
            success: true,
            audioBlob: audioBlob,
            mimeType: "audio/mp3",
            size: audioBlob.size,
            raw: result,
          };
        }

        throw new Error("No audio data in TTS response");
      }
    } catch (error) {
      console.error("TTS Error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 完整的語音對話流程
   * ASR → RAG → TTS
   * @param {Blob} audioBlob 語音輸入
   * @param {Object} options 選項
   * @param {Function} onProgress 進度回調
   * @returns {Promise<Object>} 完整對話結果
   */
  async processVoiceConversation(audioBlob, options = {}, onProgress = null) {
    const startTime = Date.now();

    try {
      this.log("Starting complete voice conversation flow...");

      const result = {
        success: true,
        steps: {},
        timings: {},
        userText: "",
        aiText: "",
        aiAudioBlob: null,
      };

      // 步驟1: 語音轉文字 (ASR)
      if (onProgress) onProgress("asr", "Identifying voice...");
      const asrStart = Date.now();

      const asrResult = await this.speechToText(audioBlob, {
        language: options.language,
      });

      result.steps.asr = asrResult;
      result.timings.asr = Date.now() - asrStart;

      if (!asrResult.success) {
        throw new Error(`Voice recognition failed: ${asrResult.error}`);
      }

      result.userText = asrResult.text;
      this.log("ASR completed:", result.userText);

      // 檢查是否有有效的語音輸入
      if (!result.userText || result.userText.length < 2) {
        throw new Error("No valid voice input detected");
      }

      // 步驟2: AI回應生成 (RAG)
      if (onProgress) onProgress("rag", "Generating response...");
      const ragStart = Date.now();

      const ragResult = await this.generateAIResponse(result.userText, {
        language: options.language,
        context: options.context,
      });

      result.steps.rag = ragResult;
      result.timings.rag = Date.now() - ragStart;

      if (!ragResult.success) {
        throw new Error(`AI response generation failed: ${ragResult.error}`);
      }

      result.aiText = ragResult.text;
      this.log("RAG completed:", result.aiText);

      // 步驟3: 文字轉語音 (TTS)
      if (onProgress) onProgress("tts", "Generating voice...");
      const ttsStart = Date.now();

      const ttsResult = await this.textToSpeech(result.aiText, {
        language: options.language,
        voice: options.voice,
        speed: options.speed,
      });

      result.steps.tts = ttsResult;
      result.timings.tts = Date.now() - ttsStart;

      if (!ttsResult.success) {
        throw new Error(`Voice generation failed: ${ttsResult.error}`);
      }

      result.aiAudioBlob = ttsResult.audioBlob;
      result.totalTime = Date.now() - startTime;

      this.log(
        "Complete voice conversation flow completed in",
        result.totalTime,
        "ms"
      );

      if (onProgress) onProgress("completed", "Conversation completed");

      return result;
    } catch (error) {
      console.error("Voice conversation flow error:", error);

      if (onProgress) onProgress("error", error.message);

      return {
        success: false,
        error: error.message,
        steps: {},
        timings: {},
        totalTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Base64轉Blob
   * @param {string} base64 Base64字符串
   * @param {string} mimeType MIME類型
   * @returns {Blob} 音頻Blob
   */
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * 健康檢查 (使用基礎類的healthCheck方法)
   * @returns {Promise<Object>} 健康狀態
   */
  async healthCheck() {
    return super.healthCheck();
  }

  /**
   * 更新配置
   * @param {Object} newConfig 新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.log("Configuration updated:", newConfig);
  }

  /**
   * 日誌輸出
   */
  log(message, ...args) {
    if (this.config.enableLogging) {
      console.log(`[AIConversationService] ${message}`, ...args);
    }
  }
}

export default AIConversationService;
