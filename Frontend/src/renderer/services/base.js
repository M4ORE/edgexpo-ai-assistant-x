/**
 * API服務基礎配置
 * EdgExpo AI Assistant X
 */

import axios from "axios";
// 從環境變量獲取配置
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://x.m4ore.com:8451";
const ENABLE_LOGGING = import.meta.env.VITE_ENABLE_LOGGING === "true";
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 60000;

// 基礎API服務類
export class BaseApiService {
  constructor(options = {}) {
    this.baseURL = options.baseURL || API_BASE_URL;
    this.timeout = options.timeout || API_TIMEOUT;
    this.enableLogging = options.enableLogging ?? ENABLE_LOGGING;
    this.headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
  }

  /**
   * 執行HTTP請求
   * @param {string} endpoint API端點
   * @param {Object} options 請求選項
   * @returns {Promise<Object>} 請求結果
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const method = (options.method || "GET").toUpperCase();

    // 合併標頭；若送 FormData，移除 Content-Type 讓瀏覽器自帶 boundary
    const headers = { ...this.headers, ...(options.headers || {}) };
    if (options.body instanceof FormData) {
      delete headers["Content-Type"];
    }

    // 統一以 blob 收下回應，事後依 Content-Type 分流（JSON 或二進位）
    const axiosConfig = {
      url,
      method,
      headers,
      timeout: this.timeout,
      responseType: options.responseType || "blob",
      data: ["GET", "HEAD"].includes(method) ? undefined : options.body,
    };

    try {
      this.log("API Request:", method, url, options.body ? "with body" : "");

      const resp = await axios(axiosConfig);
      const contentType = resp.headers["content-type"] || "";

      if (contentType.includes("application/json")) {
        const text = await resp.data.text();
        const json = text ? JSON.parse(text) : {};
        this.log("API Response:", resp.status, json);
        return {
          success: true,
          data: json,
          status: resp.status,
          headers: resp.headers,
        };
      } else {
        this.log(
          "API Response (blob):",
          resp.status,
          resp.data?.size || 0,
          "bytes"
        );
        return {
          success: true,
          data: resp.data,
          status: resp.status,
          headers: resp.headers,
          mimeType: contentType,
        };
      }
    } catch (error) {
      let message = error.message || "Network Error";
      let status = 0;

      if (error.response) {
        status = error.response.status;
        try {
          const ct = error.response.headers["content-type"] || "";
          if (ct.includes("application/json") && error.response.data?.text) {
            const t = await error.response.data.text();
            const j = t ? JSON.parse(t) : {};
            message = j?.error || j?.message || message;
          } else if (error.response.data?.text) {
            const t = await error.response.data.text();
            if (t) message = t;
          }
        } catch (_) {}
      }

      this.log("API Error:", message);
      return {
        success: false,
        error: message,
        status,
      };
    }
  }
  /**
   * GET 請求
   * @param {string} endpoint API端點
   * @param {Object} params 查詢參數
   * @param {Object} options 額外選項
   * @returns {Promise<Object>} 請求結果
   */
  async get(endpoint, params = {}, options = {}) {
    // 構建查詢字符串
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    return this.request(url, {
      method: "GET",
      ...options,
    });
  }

  /**
   * POST 請求
   * @param {string} endpoint API端點
   * @param {Object} data 請求數據
   * @param {Object} options 額外選項
   * @returns {Promise<Object>} 請求結果
   */
  async post(endpoint, data = null, options = {}) {
    const requestOptions = {
      method: "POST",
      ...options,
    };

    // 處理不同類型的數據
    if (data instanceof FormData) {
      // FormData不需要設置Content-Type
      const { "Content-Type": _, ...headersWithoutContentType } = this.headers;
      requestOptions.headers = {
        ...headersWithoutContentType,
        ...options.headers,
      };
      requestOptions.body = data;
    } else if (data !== null) {
      requestOptions.body = JSON.stringify(data);
      requestOptions.headers = {
        ...this.headers,
        ...options.headers,
      };
    }

    return this.request(endpoint, requestOptions);
  }

  /**
   * PUT 請求
   * @param {string} endpoint API端點
   * @param {Object} data 請求數據
   * @param {Object} options 額外選項
   * @returns {Promise<Object>} 請求結果
   */
  async put(endpoint, data = null, options = {}) {
    return this.post(endpoint, data, { method: "PUT", ...options });
  }

  /**
   * DELETE 請求
   * @param {string} endpoint API端點
   * @param {Object} options 額外選項
   * @returns {Promise<Object>} 請求結果
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: "DELETE",
      ...options,
    });
  }

  /**
   * 健康檢查
   * @returns {Promise<Object>} 健康狀態
   */
  async healthCheck() {
    try {
      const result = await this.get("/api/health");
      return {
        success: true,
        status: result.data?.status || "unknown",
        services: result.data?.services || {},
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 日誌輸出
   * @param {string} message 訊息
   * @param {...any} args 參數
   */
  log(message, ...args) {
    if (this.enableLogging) {
      console.log(`[${this.constructor.name}] ${message}`, ...args);
    }
  }

  /**
   * 錯誤日誌輸出
   * @param {string} message 錯誤訊息
   * @param {...any} args 參數
   */
  logError(message, ...args) {
    console.error(`[${this.constructor.name}] ${message}`, ...args);
  }

  /**
   * 更新配置
   * @param {Object} newConfig 新配置
   */
  updateConfig(newConfig) {
    Object.assign(this, newConfig);
    this.log("Configuration updated:", newConfig);
  }
}

/**
 * 創建API服務實例
 * @param {Object} config 配置選項
 * @returns {BaseApiService} API服務實例
 */
export const createApiService = (config = {}) => {
  return new BaseApiService(config);
};

/**
 * 預設API服務實例
 */
export const apiService = createApiService();

export default BaseApiService;
