// src/renderer/services/BusinessCardService.js
import { BaseApiService } from "./base.js";

/**
 * 名片掃描與CRM服務
 * 包含OCR識別、聯絡人管理和產品目錄發送功能
 */
export class BusinessCardService extends BaseApiService {
  constructor(config = {}) {
    super(config);

    this.config = {
      enableLogging: true,
      ...config,
    };

    // 設置不同的 API 基礎 URL
    this.localBaseURL = config.localBaseURL || config.baseURL;
    this.remoteBaseURL = config.remoteBaseURL || config.baseURL;

    console.log("[BusinessCardService] Initialized:");
    console.log("  local:", this.localBaseURL);
    console.log("  remote:", this.remoteBaseURL);
    console.log("  originalBaseURL:", config.baseURL);
    console.log("  config.localBaseURL:", config.localBaseURL);
    console.log("  config.remoteBaseURL:", config.remoteBaseURL);
  }

  /**
   * 根據端點選擇正確的 baseURL
   * @param {string} endpoint API 端點
   * @returns {string} 對應的 baseURL
   */
  getBaseURLForEndpoint(endpoint) {
    // 移除查詢參數，只檢查路徑部分
    const pathOnly = endpoint.split('?')[0];
    
    console.log(`[getBaseURLForEndpoint] Original: ${endpoint}, Path only: ${pathOnly}`);
    
    // 遠端服務 (x.m4ore.com:8451): OCR 和 Marketing
    if (pathOnly.startsWith('/api/ocr') || pathOnly.startsWith('/api/marketing')) {
      console.log(`[getBaseURLForEndpoint] Using remote: ${this.remoteBaseURL}`);
      return this.remoteBaseURL;
    }
    
    // 本地服務 (localhost:5000): CRM 和 health
    if (pathOnly.startsWith('/api/crm') || pathOnly.startsWith('/api/health')) {
      console.log(`[getBaseURLForEndpoint] Using local: ${this.localBaseURL}`);
      return this.localBaseURL;
    }
    
    // 預設使用本地服務
    console.log(`[getBaseURLForEndpoint] Using default local: ${this.localBaseURL}`);
    return this.localBaseURL;
  }

  /**
   * 覆寫父類的請求方法以支援多 baseURL
   */
  async request(endpoint, options = {}) {
    const originalBaseURL = this.baseURL;
    const selectedBaseURL = this.getBaseURLForEndpoint(endpoint);
    
    this.log(`[REQUEST] ${endpoint} -> using baseURL: ${selectedBaseURL}`);
    this.log(`[REQUEST] Original baseURL: ${originalBaseURL}`);
    this.log(`[REQUEST] Local: ${this.localBaseURL}, Remote: ${this.remoteBaseURL}`);
    
    this.baseURL = selectedBaseURL;
    
    try {
      const result = await super.request(endpoint, options);
      return result;
    } finally {
      this.baseURL = originalBaseURL;
    }
  }

  /**
   * 名片OCR識別
   * @param {File|Blob} imageFile 名片圖片文件
   * @param {Object} options 選項
   * @returns {Promise<Object>} OCR結果
   */
  async scanBusinessCard(imageFile, options = {}) {
    try {
      this.log("Starting business card OCR...", imageFile.name || "blob");

      // 創建FormData用於multipart/form-data上傳
      const formData = new FormData();
      formData.append("image", imageFile, "business_card.jpg");

      // 添加可選參數
      if (options.language) {
        formData.append("language", options.language);
      }

      const response = await this.post("/api/ocr/business-card", formData);

      if (!response.success) {
        throw new Error(`OCR API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log("OCR response received:", result);

      // 檢查回應格式
      if (result.error) {
        throw new Error(`OCR API error: ${result.error}`);
      }

      if (!result.status) {
        throw new Error("OCR processing failed");
      }

      const cardData = result.data || {};

      return {
        success: true,
        data: {
          name: cardData.name || "",
          company: cardData.company || "",
          position: cardData.position || "",
          phone: cardData.phone || "",
          email: cardData.email || "",
          address: cardData.address || "",
          website: cardData.website || "",
          fax: cardData.fax || "",
          mobile: cardData.mobile || "",
        },
        confidence: result.confidence || 0.8,
        processingTime: result.processingTime || 0,
        raw: result,
      };
    } catch (error) {
      console.error("Business Card OCR Error:", error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * 儲存聯絡人到CRM
   * @param {Object} contactData 聯絡人數據
   * @param {Object} options 選項
   * @returns {Promise<Object>} 儲存結果
   */
  async saveContact(contactData, options = {}) {
    try {
      this.log("Saving contact to CRM...", contactData.name);

      const requestData = {
        name: contactData.name || "",
        company: contactData.company || "",
        position: contactData.position || "",
        phone: contactData.phone || "",
        email: contactData.email || "",
        address: contactData.address || "",
        source: "business_card_scan",
      };

      const response = await this.post("/api/crm/contacts", requestData);

      if (!response.success) {
        throw new Error(`CRM API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log("Contact saved successfully:", result.contact_id);

      return {
        success: true,
        contact_id: result.contact_id,
        status: result.status || "created",
        data: result.contact || requestData,
        raw: result,
      };
    } catch (error) {
      console.error("Save Contact Error:", error);
      return {
        success: false,
        error: error.message,
        contact_id: null,
      };
    }
  }

  /**
   * 獲取聯絡人清單
   * @param {Object} params 查詢參數
   * @returns {Promise<Object>} 聯絡人清單
   */
  async getContacts(params = {}) {
    try {
      this.log("Fetching contacts list...");

      const queryParams = {
        limit: params.limit || 10,
        offset: params.offset || 0,
        search: params.search || "",
        sort: params.sort || "created_at",
        order: params.order || "desc",
        ...params.filters,
      };

      const response = await this.get("/api/crm/contacts", queryParams);

      if (!response.success) {
        throw new Error(`CRM API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log(`Retrieved ${result.contacts?.length || 0} contacts`);

      return {
        success: true,
        contacts: result.contacts || [],
        total: result.total || 0,
        limit: result.limit || queryParams.limit,
        offset: result.offset || queryParams.offset,
        raw: result,
      };
    } catch (error) {
      console.error("Get Contacts Error:", error);
      return {
        success: false,
        error: error.message,
        contacts: [],
        total: 0,
      };
    }
  }

  /**
   * 獲取單個聯絡人詳情
   * @param {string} contactId 聯絡人ID
   * @returns {Promise<Object>} 聯絡人詳情
   */
  async getContact(contactId) {
    try {
      this.log("Fetching contact details...", contactId);

      const response = await this.get(`/api/crm/contacts/${contactId}`);

      if (!response.success) {
        throw new Error(`CRM API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log("Contact details retrieved:", result.name);

      return {
        success: true,
        contact: result,
        raw: result,
      };
    } catch (error) {
      console.error("Get Contact Error:", error);
      return {
        success: false,
        error: error.message,
        contact: null,
      };
    }
  }

  /**
   * 更新聯絡人資料
   * @param {string} contactId 聯絡人ID
   * @param {Object} updateData 更新數據
   * @returns {Promise<Object>} 更新結果
   */
  async updateContact(contactId, updateData) {
    try {
      this.log("Updating contact...", contactId);

      const response = await this.put(
        `/api/crm/contacts/${contactId}`,
        updateData
      );

      if (!response.success) {
        throw new Error(`CRM API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log("Contact updated successfully");

      return {
        success: true,
        contact: result,
        raw: result,
      };
    } catch (error) {
      console.error("Update Contact Error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 刪除聯絡人
   * @param {string} contactId 聯絡人ID
   * @returns {Promise<Object>} 刪除結果
   */
  async deleteContact(contactId) {
    try {
      this.log("Deleting contact...", contactId);

      const response = await this.delete(`/api/crm/contacts/${contactId}`);

      if (!response.success) {
        throw new Error(`CRM API request failed: ${response.error}`);
      }

      this.log("Contact deleted successfully");

      return {
        success: true,
        message: "Contact deleted successfully",
      };
    } catch (error) {
      console.error("Delete Contact Error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 發送產品目錄到聯絡人信箱
   * @param {string} contactId 聯絡人ID
   * @param {Object} options 選項
   * @returns {Promise<Object>} 發送結果
   */
  async sendProductCatalog(contactId, options = {}) {
    try {
      this.log("Sending product catalog...", contactId);

      const requestData = {
        contact_id: contactId,
      };

      const response = await this.post(
        "/api/marketing/send-catalog",
        requestData
      );

      if (!response.success) {
        throw new Error(`Marketing API request failed: ${response.error}`);
      }

      const result = response.data;

      this.log("Product catalog sent successfully");

      return {
        success: true,
        status: result.status || true,
        message: result.message || "Catalog sent successfully",
        sent_at: result.sent_at || new Date().toISOString(),
        raw: result,
      };
    } catch (error) {
      console.error("Send Catalog Error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 完整的名片掃描流程
   * 掃描 → 識別 → 儲存 → 自動發送目錄
   * @param {File|Blob} imageFile 名片圖片
   * @param {Object} options 選項
   * @param {Function} onProgress 進度回調
   * @returns {Promise<Object>} 完整流程結果
   */
  async processBusinessCardComplete(
    imageFile,
    options = {},
    onProgress = null
  ) {
    const startTime = Date.now();

    try {
      this.log("Starting complete business card processing flow...");

      const result = {
        success: true,
        steps: {},
        timings: {},
        cardData: null,
        contact_id: null,
        catalogSent: false,
      };

      // 步驟1: OCR識別名片
      if (onProgress) onProgress("ocr", "Identifying business card...");
      const ocrStart = Date.now();

      const ocrResult = await this.scanBusinessCard(imageFile, {
        language: options.language,
      });

      result.steps.ocr = ocrResult;
      result.timings.ocr = Date.now() - ocrStart;

      if (!ocrResult.success) {
        throw new Error(
          `Business card identification failed: ${ocrResult.error}`
        );
      }

      result.cardData = ocrResult.data;
      this.log("OCR completed:", result.cardData.name);

      // 檢查是否有必要的聯絡信息
      if (!result.cardData.name && !result.cardData.email) {
        throw new Error("Cannot identify name or email from business card");
      }

      // 步驟2: 儲存聯絡人到CRM
      if (onProgress) onProgress("crm", "Saving contact...");
      const crmStart = Date.now();

      const saveResult = await this.saveContact(result.cardData, {
        extraData: options.extraData,
      });

      result.steps.crm = saveResult;
      result.timings.crm = Date.now() - crmStart;

      if (!saveResult.success) {
        throw new Error(`Contact saving failed: ${saveResult.error}`);
      }

      result.contact_id = saveResult.contact_id;
      this.log("Contact saved:", result.contact_id);

      // 步驟3: 自動發送產品目錄（如果有電子郵件）
      if (result.cardData.email && options.autoSendCatalog !== false) {
        if (onProgress) onProgress("catalog", "Sending product catalog...");
        const catalogStart = Date.now();

        const catalogResult = await this.sendProductCatalog(result.contact_id, {
          language: options.language,
          customMessage: options.catalogMessage,
        });

        result.steps.catalog = catalogResult;
        result.timings.catalog = Date.now() - catalogStart;

        if (catalogResult.success) {
          result.catalogSent = true;
          this.log("Product catalog sent successfully");
        } else {
          this.log("Product catalog sending failed:", catalogResult.error);
          // 不拋出錯誤，因為主要流程已完成
        }
      }

      result.totalTime = Date.now() - startTime;

      this.log(
        "Complete business card processing flow completed in",
        result.totalTime,
        "ms"
      );

      if (onProgress)
        onProgress("completed", "Business card processing completed");

      return result;
    } catch (error) {
      console.error("Business card processing flow error:", error);

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
   * 批量處理名片
   * @param {Array<File|Blob>} imageFiles 名片圖片數組
   * @param {Object} options 選項
   * @param {Function} onProgress 進度回調
   * @returns {Promise<Object>} 批量處理結果
   */
  async processBatchBusinessCards(imageFiles, options = {}, onProgress = null) {
    try {
      this.log(
        "Starting batch business card processing...",
        imageFiles.length,
        "cards"
      );

      const results = [];
      const errors = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];

        if (onProgress) {
          onProgress(
            "batch",
            `Processing business card ${i + 1}/${imageFiles.length}...`
          );
        }

        try {
          const result = await this.processBusinessCardComplete(file, options);
          results.push({
            index: i,
            filename: file.name || `card_${i}`,
            ...result,
          });
        } catch (error) {
          errors.push({
            index: i,
            filename: file.name || `card_${i}`,
            error: error.message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const errorCount = errors.length;

      this.log(
        `Batch processing completed: ${successCount} success, ${errorCount} errors`
      );

      return {
        success: true,
        total: imageFiles.length,
        successful: successCount,
        failed: errorCount,
        results: results,
        errors: errors,
      };
    } catch (error) {
      console.error("Batch processing error:", error);
      return {
        success: false,
        error: error.message,
        results: [],
        errors: [],
      };
    }
  }

  /**
   * 驗證名片數據完整性
   * @param {Object} cardData 名片數據
   * @returns {Object} 驗證結果
   */
  validateCardData(cardData) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // 必要欄位檢查
    if (!cardData.name || cardData.name.trim().length === 0) {
      validation.errors.push("Name is required");
    }

    if (!cardData.email && !cardData.phone) {
      validation.errors.push("At least one of email or phone is required");
    }

    // 格式驗證
    if (cardData.email && !this.validateEmail(cardData.email)) {
      validation.warnings.push("Email format may be incorrect");
    }

    if (cardData.phone && !this.validatePhone(cardData.phone)) {
      validation.warnings.push("Phone format may be incorrect");
    }

    validation.valid = validation.errors.length === 0;

    return validation;
  }

  /**
   * 驗證電子郵件格式
   * @param {string} email 電子郵件
   * @returns {boolean} 是否有效
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 驗證電話格式
   * @param {string} phone 電話號碼
   * @returns {boolean} 是否有效
   */
  validatePhone(phone) {
    // 簡單的電話格式驗證，支援多種格式
    const phoneRegex = /^[\+]?[0-9\-\(\)\s]{8,20}$/;
    return phoneRegex.test(phone);
  }
}

export default BusinessCardService;
