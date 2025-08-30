import { ref } from 'vue'
import { useErrorHandler, ERROR_STRATEGIES } from './useErrorHandler'

/**
 * 檔案上傳狀態管理 Composable
 * 
 * 統一管理所有檔案上傳相關的狀態和邏輯，包括：
 * - 檔案選擇和驗證
 * - 上傳進度追蹤
 * - WebSocket上傳進度更新
 * - 檔案狀態管理
 * - 上傳錯誤處理
 * 
 * @param {Object} options 配置選項
 * @param {Object} options.webSocketService WebSocket服務對象
 * @param {Object} options.fileUploadService 檔案上傳服務對象
 * @returns {Object} 檔案上傳狀態管理相關的響應式資料和方法
 */
export function useFileUploadState(options = {}) {
  const { webSocketService, fileUploadService } = options
  
  // 錯誤處理
  const { createContextHandler, ERROR_STRATEGIES } = useErrorHandler()
  const handleUploadError = createContextHandler('upload', {
    strategy: ERROR_STRATEGIES.INLINE
  })

  // ===== 核心狀態 =====
  const uploadingFiles = ref([])
  
  // ===== 配置常數 =====
  const ALLOWED_FILE_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    archive: ['application/zip', 'application/x-rar-compressed'],
    general: ['*/*'] // 允許所有類型
  }
  
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  const MAX_FILES_COUNT = 5 // 最多同時上傳5個檔案

  /**
   * 檔案類型驗證
   * @param {File} file 檔案對象
   * @returns {Object} 驗證結果
   */
  const validateFile = (file) => {
    const errors = []
    
    // 檢查檔案大小
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`檔案大小超過限制 (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`)
    }
    
    // 檢查檔案數量
    if (uploadingFiles.value.length >= MAX_FILES_COUNT) {
      errors.push(`最多只能同時上傳 ${MAX_FILES_COUNT} 個檔案`)
    }
    
    // 檢查是否已存在相同檔案
    const existingFile = uploadingFiles.value.find(f => f.name === file.name && f.size === file.size)
    if (existingFile) {
      errors.push('相同檔案已存在於上傳列表中')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 確定檔案類型類別
   * @param {File} file 檔案對象
   * @returns {string} 檔案類型類別
   */
  const determineFileType = (file) => {
    const mimeType = file.type
    
    if (ALLOWED_FILE_TYPES.image.includes(mimeType)) {
      return 'image'
    } else if (ALLOWED_FILE_TYPES.document.includes(mimeType)) {
      return 'document'
    } else if (ALLOWED_FILE_TYPES.archive.includes(mimeType)) {
      return 'archive'
    } else {
      return 'general'
    }
  }

  /**
   * 處理檔案選擇
   * @param {Event} event 檔案選擇事件
   * @returns {Promise<Object>} 處理結果
   */
  const handleFileSelected = async (event) => {
    const file = event.target?.files?.[0]
    if (!file) {
      return { success: false, error: '未選擇檔案' }
    }

    try {
      // 驗證檔案
      const validation = validateFile(file)
      if (!validation.valid) {
        const errorMessage = validation.errors.join(', ')
        console.warn('檔案驗證失敗:', errorMessage)
        
        handleUploadError(new Error(errorMessage), {
          onInlineError: (message) => {
            console.error(`檔案選擇錯誤: ${message}`)
          }
        })
        
        return { success: false, error: errorMessage }
      }

      // 創建檔案資訊對象
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const fileType = determineFileType(file)
      
      const fileInfo = {
        fileId: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        fileType: fileType,
        path: file.path || file.name, // Electron環境下可能有path屬性
        uploaded: true, // 在當前實現中，直接標記為已上傳
        stage: "completed",
        progress: 100,
        file: file, // 保留原始檔案對象以供後續使用
        timestamp: Date.now()
      }

      // 添加到上傳列表
      uploadingFiles.value.push(fileInfo)
      
      console.log('檔案選擇成功:', fileInfo)
      
      return { 
        success: true, 
        fileInfo: fileInfo,
        message: `檔案 "${file.name}" 已準備就緒`
      }

    } catch (error) {
      console.error("檔案選擇處理錯誤:", error)
      
      handleUploadError(error, {
        onInlineError: (message) => {
          console.error(`檔案處理錯誤: ${message}`)
        }
      })
      
      return { success: false, error: error.message }
    }
  }

  /**
   * 處理 WebSocket 檔案上傳進度更新
   * @param {Object} fileInfo 檔案資訊
   */
  const handleUploadProgress = (fileInfo) => {
    const fileIndex = uploadingFiles.value.findIndex(
      (file) => file.fileId === fileInfo.fileId
    )

    if (fileIndex === -1) {
      // 如果是新文件，添加到列表
      uploadingFiles.value.push(fileInfo)
      console.log('新增檔案上傳進度:', fileInfo)
    } else {
      // 更新現有文件
      const newFiles = [...uploadingFiles.value]
      newFiles[fileIndex] = {
        ...newFiles[fileIndex],
        ...fileInfo,
        timestamp: Date.now()
      }
      uploadingFiles.value = newFiles
      console.log('更新檔案上傳進度:', fileInfo)
    }
  }

  /**
   * 處理檔案上傳完成
   * @param {Object} fileInfo 檔案資訊
   */
  const handleUploadComplete = (fileInfo) => {
    const fileIndex = uploadingFiles.value.findIndex(
      (file) => file.fileId === fileInfo.fileId
    )

    if (fileIndex !== -1) {
      const newFiles = [...uploadingFiles.value]
      newFiles[fileIndex] = {
        ...newFiles[fileIndex],
        ...fileInfo,
        uploaded: true,
        stage: "completed",
        progress: 100,
        timestamp: Date.now()
      }
      uploadingFiles.value = newFiles
      console.log('檔案上傳完成:', fileInfo)
    }
  }

  /**
   * 處理檔案上傳錯誤
   * @param {Object} fileInfo 檔案資訊
   * @param {Error} error 錯誤對象
   */
  const handleFileUploadError = (fileInfo, error) => {
    const fileIndex = uploadingFiles.value.findIndex(
      (file) => file.fileId === fileInfo.fileId
    )

    if (fileIndex !== -1) {
      const newFiles = [...uploadingFiles.value]
      newFiles[fileIndex] = {
        ...newFiles[fileIndex],
        ...fileInfo,
        stage: "error",
        status: `上傳失敗: ${error.message}`,
        error: error,
        timestamp: Date.now()
      }
      uploadingFiles.value = newFiles
    }

    // 使用統一錯誤處理
    handleUploadError(error, {
      onInlineError: (message) => {
        console.error(`檔案上傳錯誤: ${message}`)
      }
    })
  }

  /**
   * 移除上傳中的檔案
   * @param {number|string} indexOrFileId 索引或檔案ID
   */
  const removeUploadingFile = (indexOrFileId) => {
    if (typeof indexOrFileId === 'number') {
      // 按索引移除
      if (indexOrFileId >= 0 && indexOrFileId < uploadingFiles.value.length) {
        const removedFile = uploadingFiles.value[indexOrFileId]
        uploadingFiles.value.splice(indexOrFileId, 1)
        console.log('移除檔案 (按索引):', removedFile.name)
        
        // 通知服務器取消上傳（如果需要）
        if (fileUploadService && !removedFile.uploaded) {
          fileUploadService.cancelUpload?.(removedFile.fileId)
        }
      }
    } else {
      // 按檔案ID移除
      const fileIndex = uploadingFiles.value.findIndex(file => file.fileId === indexOrFileId)
      if (fileIndex !== -1) {
        const removedFile = uploadingFiles.value[fileIndex]
        uploadingFiles.value.splice(fileIndex, 1)
        console.log('移除檔案 (按ID):', removedFile.name)
        
        // 通知服務器取消上傳（如果需要）
        if (fileUploadService && !removedFile.uploaded) {
          fileUploadService.cancelUpload?.(removedFile.fileId)
        }
      }
    }
  }

  /**
   * 清空所有上傳檔案
   */
  const clearAllFiles = () => {
    // 取消所有未完成的上傳
    if (fileUploadService) {
      uploadingFiles.value.forEach(file => {
        if (!file.uploaded && file.stage !== 'completed') {
          fileUploadService.cancelUpload?.(file.fileId)
        }
      })
    }
    
    uploadingFiles.value = []
    console.log('已清空所有上傳檔案')
  }

  /**
   * 驗證發送條件（檢查所有檔案是否已準備就緒）
   * @returns {Object} 驗證結果
   */
  const validateBeforeSend = () => {
    if (uploadingFiles.value.length === 0) {
      return { valid: true, message: null }
    }
    
    const allFilesReady = uploadingFiles.value.every((file) => 
      file.uploaded && file.stage === 'completed'
    )
    
    if (!allFilesReady) {
      const pendingFiles = uploadingFiles.value.filter(file => !file.uploaded || file.stage !== 'completed')
      return { 
        valid: false, 
        message: `請等待 ${pendingFiles.length} 個檔案完成上傳`,
        pendingFiles
      }
    }
    
    return { valid: true }
  }

  /**
   * 獲取準備發送的檔案附件資訊
   * @returns {Array} 檔案附件陣列
   */
  const getFileAttachments = () => {
    return uploadingFiles.value
      .filter(file => file.uploaded && file.stage === 'completed')
      .map(file => ({
        fileId: file.fileId,
        path: file.path,
        name: file.name,
        size: file.size,
        type: file.type,
        fileType: file.fileType
      }))
  }

  /**
   * 獲取上傳統計資訊
   * @returns {Object} 統計資訊
   */
  const getUploadStats = () => {
    const stats = {
      total: uploadingFiles.value.length,
      completed: 0,
      uploading: 0,
      error: 0,
      totalSize: 0
    }
    
    uploadingFiles.value.forEach(file => {
      stats.totalSize += file.size
      
      if (file.stage === 'completed' && file.uploaded) {
        stats.completed++
      } else if (file.stage === 'error') {
        stats.error++
      } else {
        stats.uploading++
      }
    })
    
    return stats
  }

  /**
   * 批量上傳檔案（如果需要真實上傳功能）
   * @param {Array} files 檔案陣列
   * @returns {Promise<Array>} 上傳結果陣列
   */
  const batchUploadFiles = async (files) => {
    if (!fileUploadService) {
      console.warn('檔案上傳服務未配置，跳過真實上傳')
      return files.map(file => ({ success: true, fileInfo: file }))
    }
    
    const uploadPromises = files.map(async (file) => {
      try {
        const result = await fileUploadService.uploadFile(file)
        return { success: true, fileInfo: result }
      } catch (error) {
        handleFileUploadError(file, error)
        return { success: false, error: error.message, fileInfo: file }
      }
    })
    
    return Promise.allSettled(uploadPromises)
  }

  /**
   * WebSocket 訊息處理器
   * @param {Object} message WebSocket訊息
   */
  const handleWebSocketMessage = (message) => {
    if (message.path === "upload/progress" && message.status === "ok") {
      const { fileId, progress, stage, processingStatus, fileType } = message.data

      // 更新上傳進度，包含檔案類型
      if (fileUploadService?.updateFileProgress) {
        fileUploadService.updateFileProgress(fileId, progress, stage, processingStatus, fileType)
      }

      // 手動更新狀態（如果服務沒有自動處理）
      handleUploadProgress({
        fileId,
        progress,
        stage,
        processingStatus,
        fileType
      })

      // 如果處理完成
      if (progress === 100 && stage === "completed") {
        if (fileUploadService?.markFileAsUploaded) {
          fileUploadService.markFileAsUploaded(fileId)
        }
        
        handleUploadComplete({ fileId, progress, stage })
      }
    }
  }

  /**
   * 重試失敗的上傳
   * @param {string} fileId 檔案ID
   */
  const retryUpload = async (fileId) => {
    const fileIndex = uploadingFiles.value.findIndex(file => file.fileId === fileId)
    if (fileIndex === -1) {
      console.warn('找不到要重試的檔案:', fileId)
      return
    }
    
    const file = uploadingFiles.value[fileIndex]
    if (!file.file) {
      console.warn('檔案對象已遺失，無法重試:', fileId)
      return
    }
    
    try {
      // 重置檔案狀態
      uploadingFiles.value[fileIndex] = {
        ...file,
        stage: 'uploading',
        progress: 0,
        error: null,
        status: '重新上傳中...'
      }
      
      // 重新上傳
      if (fileUploadService?.uploadFile) {
        await fileUploadService.uploadFile(file.file)
      }
      
    } catch (error) {
      handleFileUploadError(file, error)
    }
  }

  return {
    // ===== 響應式狀態 =====
    uploadingFiles,
    
    // ===== 核心方法 =====
    handleFileSelected,
    removeUploadingFile,
    clearAllFiles,
    validateBeforeSend,
    getFileAttachments,
    
    // ===== 上傳管理 =====
    handleUploadProgress,
    handleUploadComplete,
    handleFileUploadError,
    batchUploadFiles,
    retryUpload,
    
    // ===== WebSocket整合 =====
    handleWebSocketMessage,
    
    // ===== 工具函數 =====
    validateFile,
    determineFileType,
    getUploadStats,
    
    // ===== 常數 =====
    ALLOWED_FILE_TYPES,
    MAX_FILE_SIZE,
    MAX_FILES_COUNT
  }
}