import { ref, nextTick } from 'vue'
import { useErrorHandler, ERROR_STRATEGIES } from './useErrorHandler'
import { useTypewriter } from './useTypewriter'

/**
 * 訊息狀態管理 Composable
 * 
 * 統一管理所有訊息相關的狀態和邏輯，包括：
 * - 訊息列表管理
 * - 訊息快取系統（記憶體 + localStorage）
 * - 訊息發送邏輯
 * - 打字機效果整合
 * - 智能降級策略
 * 
 * @param {Object} options 配置選項
 * @param {Object} options.apiServices API服務對象
 * @param {Function} options.scrollToBottom 滾動到底部的函數
 * @returns {Object} 訊息狀態管理相關的響應式資料和方法
 */
export function useMessageState(options = {}) {
  const { apiServices, scrollToBottom } = options
  const { conversationService, chatService } = apiServices || {}
  
  // 錯誤處理
  const { createContextHandler, ERROR_STRATEGIES } = useErrorHandler()
  const handleMessageError = createContextHandler('message', {
    strategy: ERROR_STRATEGIES.FALLBACK,
    hasCache: true
  })

  // 打字機效果
  const { startTyping, isTyping } = useTypewriter({
    typingSpeed: 30,
    startDelay: 200
  })

  // ===== 核心狀態 =====
  const messages = ref([])
  
  // ===== 載入狀態 =====
  const messageLoading = ref(false)
  const messageError = ref(null)
  const isResponseGenerating = ref(false)
  
  // ===== 快取系統 =====
  const messageCache = new Map() // 記憶體快取
  
  // ===== 配置常數 =====
  const CONVERSATION_CACHE_PREFIX = 'conversation_'
  
  /**
   * 檢查是否為臨時對話
   * @param {string} conversationId 對話ID
   * @returns {boolean} 是否為臨時對話
   */
  const isTempConversation = (conversationId) => {
    return conversationId?.startsWith('temp_') || conversationId?.startsWith('new_chat_')
  }

  /**
   * 檢查記憶體快取並返回結果
   * @param {string} conversationId 對話ID
   * @param {string} cacheKey 快取鍵
   * @param {Object} options 選項
   * @returns {Object|null} 快取結果或null
   */
  const checkMemoryCache = (conversationId, cacheKey, options) => {
    if (messageCache.has(cacheKey)) {
      const cachedMessages = messageCache.get(cacheKey)
      messages.value = cachedMessages
      console.log(`⚡ 從記憶體快取立即讀取對話 ${conversationId} 的訊息 (${cachedMessages.length} 條)`)
      
      // 高優先級請求不進行背景更新
      if (options.priority !== 'high') {
        setTimeout(() => {
          getConversationMessages(conversationId, { 
            ...options, 
            useCache: false, 
            forceRefresh: true,
            priority: 'background'
          }).catch(err => console.warn('背景更新失敗:', err))
        }, 2000)
      }
      
      return {
        messages: cachedMessages,
        hasMore: false,
        total: cachedMessages.length,
        fromCache: 'memory',
        instant: true
      }
    }
    return null
  }

  /**
   * 檢查 localStorage 快取並返回結果
   * @param {string} conversationId 對話ID
   * @param {string} localStorageKey localStorage鍵
   * @param {string} cacheKey 記憶體快取鍵
   * @param {Object} options 選項
   * @returns {Object|null} 快取結果或null
   */
  const checkLocalStorageCache = (conversationId, localStorageKey, cacheKey, options) => {
    try {
      const cachedData = localStorage.getItem(localStorageKey)
      if (cachedData) {
        const parsedMessages = JSON.parse(cachedData)
        const cacheTimestamp = localStorage.getItem(`${localStorageKey}_timestamp`)
        const cacheAge = Date.now() - (parseInt(cacheTimestamp) || 0)
        
        const cacheThreshold = options.priority === 'high' ? 30 * 60 * 1000 : 5 * 60 * 1000
        
        if (cacheAge < cacheThreshold) {
          messages.value = parsedMessages
          messageCache.set(cacheKey, parsedMessages)
          
          const cacheAgeText = cacheAge < 60000 ? `${Math.round(cacheAge/1000)}秒前` : `${Math.round(cacheAge/60000)}分鐘前`
          console.log(`⚡ 從 localStorage 立即讀取對話 ${conversationId} 的訊息 (${parsedMessages.length} 條, ${cacheAgeText})`)
          
          if (options.priority === 'normal') {
            setTimeout(() => {
              getConversationMessages(conversationId, { 
                ...options, 
                useCache: false, 
                forceRefresh: true,
                priority: 'background'
              }).catch(err => console.warn('背景更新失敗:', err))
            }, 1000)
          }
          
          return {
            messages: parsedMessages,
            hasMore: false,
            total: parsedMessages.length,
            fromCache: 'localStorage',
            instant: true
          }
        } else {
          console.log(`⚠️ localStorage 快取已過期 (${Math.round(cacheAge/1000/60)}分鐘前), 將重新獲取`)
        }
      }
    } catch (e) {
      console.warn('讀取 localStorage 快取失敗:', e)
      // 清理損壞的快取
      try {
        localStorage.removeItem(localStorageKey)
        localStorage.removeItem(`${localStorageKey}_timestamp`)
      } catch (err) {
        console.warn('清理損壞快取失敗:', err)
      }
    }
    return null
  }

  /**
   * 從 API 獲取訊息數據
   * @param {string} conversationId 對話ID
   * @param {Object} options 選項
   * @returns {Object} API回應數據
   */
  const fetchMessagesFromAPI = async (conversationId, options) => {
    const { limit = 100, offset = 0, priority = 'normal' } = options
    
    const requestType = priority === 'background' ? '背景' : priority === 'high' ? '高優先級' : '普通'
    console.log(`📡 ${requestType}請求：從 API 獲取對話 ${conversationId} 的訊息`)
    
    const response = await conversationService.getDetail(conversationId, {
      limit: limit,
      offset: offset,
      include_messages: 'true'
    })
    
    console.log('API 回應結構:', response)
    
    // 解析 API 回應數據
    let conversationData = null
    let messagesData = []
    
    if (response.conversation) {
      conversationData = response.conversation
      messagesData = conversationData.messages || []
    } else if (response.data?.conversation) {
      conversationData = response.data.conversation
      messagesData = conversationData.messages || []
    } else {
      messagesData = response.messages || response.data?.messages || []
    }
    
    return { conversationData, messagesData }
  }

  /**
   * 格式化訊息數據
   * @param {Array} messagesData 原始訊息數據
   * @returns {Array} 格式化後的訊息
   */
  const formatMessages = (messagesData) => {
    return messagesData.map(msg => ({
      id: msg.id,
      role: msg.role,
      text: msg.content || msg.text,
      content: msg.content,
      createAt: msg.created_at || msg.createAt,
      conversation_id: msg.conversation_id,
      metadata: msg.metadata || {},
      attachments: msg.attachments || [],
      file: msg.attachments && msg.attachments.length === 1 ? {
        name: msg.attachments[0].name,
        size: msg.attachments[0].size,
        path: msg.attachments[0].path
      } : undefined
    }))
  }

  /**
   * 更新訊息到快取系統
   * @param {string} conversationId 對話ID
   * @param {Array} formattedMessages 格式化的訊息
   * @param {Object} options 選項
   */
  const updateMessageCache = async (conversationId, formattedMessages, options) => {
    const { limit = 100, offset = 0 } = options
    const localStorageKey = `${CONVERSATION_CACHE_PREFIX}${conversationId}`
    const finalCacheKey = `${conversationId}_${limit}_${offset}`
    
    // 更新記憶體快取
    messageCache.set(finalCacheKey, [...messages.value])
    console.log(`📝 已更新記憶體快取: ${conversationId} (${messages.value.length} 條訊息)`)
    
    // 更新 localStorage 快取
    if (offset === 0 && messages.value.length > 0) {
      try {
        const timestamp = Date.now()
        localStorage.setItem(localStorageKey, JSON.stringify(messages.value))
        localStorage.setItem(`${localStorageKey}_timestamp`, timestamp.toString())
        console.log(`💾 已更新 localStorage 快取: ${conversationId} (${messages.value.length} 條訊息)`)
        cleanupOldCache()
      } catch (e) {
        console.warn('⚠️ 無法保存到 localStorage:', e)
        if (e.name === 'QuotaExceededError') {
          console.warn('localStorage 空間不足，嘗試清理舊快取...')
          try {
            cleanupOldCache(true)
            localStorage.setItem(localStorageKey, JSON.stringify(messages.value))
            localStorage.setItem(`${localStorageKey}_timestamp`, timestamp.toString())
            console.log(`💾 清理後成功保存快取: ${conversationId}`)
          } catch (e2) {
            console.error('清理後仍無法保存快取:', e2)
          }
        }
      }
    }
  }

  /**
   * 智能降級策略處理
   * @param {string} conversationId 對話ID
   * @param {Error} error 錯誤對象
   * @param {Object} options 選項
   * @returns {Object} 降級結果
   */
  const handleAPIFailureFallback = async (conversationId, error, options) => {
    const { limit = 100, offset = 0 } = options
    const localStorageKey = `${CONVERSATION_CACHE_PREFIX}${conversationId}`
    const memoryCacheKey = `${conversationId}_${limit}_${offset}`
    
    messageError.value = error.response?.data?.error?.message || error.message || '獲取訊息失敗'
    console.log(`🔄 API 失敗，啟動智能降級策略...`)
    
    // 嘗試記憶體快取
    if (messageCache.has(memoryCacheKey)) {
      const cachedMessages = messageCache.get(memoryCacheKey)
      messages.value = cachedMessages
      console.log(`✅ API 失敗降級成功：使用記憶體快取 (${cachedMessages.length} 條訊息)`)
      return {
        messages: cachedMessages,
        hasMore: false,
        total: cachedMessages.length,
        fromCache: 'memory',
        fallback: true,
        error: `網路錯誤，已載入快取資料 (${messageError.value})`
      }
    }
    
    // 嘗試 localStorage 快取
    if (offset === 0) {
      try {
        const cachedData = localStorage.getItem(localStorageKey)
        const cacheTimestamp = localStorage.getItem(`${localStorageKey}_timestamp`)
        
        if (cachedData) {
          const parsedMessages = JSON.parse(cachedData)
          const cacheAge = Date.now() - (parseInt(cacheTimestamp) || 0)
          
          messages.value = parsedMessages
          messageCache.set(memoryCacheKey, parsedMessages)
          
          const cacheAgeText = cacheAge < 60000 ? 
            `${Math.round(cacheAge/1000)}秒前` : 
            `${Math.round(cacheAge/60000)}分鐘前`
            
          console.log(`✅ API 失敗降級成功：使用 localStorage 快取 (${parsedMessages.length} 條訊息, ${cacheAgeText})`)
          
          return {
            messages: parsedMessages,
            hasMore: false,
            total: parsedMessages.length,
            fromCache: 'localStorage',
            fallback: true,
            cacheAge: cacheAge,
            error: `網路錯誤，已載入離線快取 (${messageError.value})`
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ 讀取 localStorage 快取時出錯:', cacheError)
        try {
          localStorage.removeItem(localStorageKey)
          localStorage.removeItem(`${localStorageKey}_timestamp`)
        } catch (cleanupError) {
          console.warn('清理損壞快取失敗:', cleanupError)
        }
      }
    }
    
    // 檢查部分快取
    for (const [key, value] of messageCache.entries()) {
      if (key.startsWith(conversationId)) {
        console.log(`✅ API 失敗降級成功：使用部分記憶體快取 (${value.length} 條訊息)`)
        messages.value = value
        return {
          messages: value,
          hasMore: false,
          total: value.length,
          fromCache: 'memory-partial',
          fallback: true,
          error: `網路錯誤，已載入部分快取資料 (${messageError.value})`
        }
      }
    }
    
    // 完全失敗
    console.error(`❌ 智能降級策略失敗：無可用快取，對話 ${conversationId}`)
    messages.value = []
    
    return {
      messages: [],
      hasMore: false,
      total: 0,
      error: messageError.value,
      noCache: true
    }
  }

  /**
   * 獲取指定對話的訊息（重構版）
   * @param {string} conversationId 對話ID
   * @param {Object} options 選項
   * @returns {Object} 訊息獲取結果
   */
  const getConversationMessages = async (conversationId, options = {}) => {
    if (!conversationId) return

    // 如果是臨時對話，直接返回
    if (isTempConversation(conversationId)) {
      messages.value = []
      return
    }

    try {
      // 高優先級請求不顯示載入狀態，避免 UI 閃爍
      const isHighPriority = options.priority === 'high'
      if (!isHighPriority) {
        messageLoading.value = true
      }
      messageError.value = null
      
      const {
        useCache = true,
        limit = 100,
        offset = 0,
        forceRefresh = false,
        priority = 'normal'
      } = options

      // 建立快取鍵
      const cacheKey = `${conversationId}_${limit}_${offset}`
      const localStorageKey = `${CONVERSATION_CACHE_PREFIX}${conversationId}`
      
      // 檢查記憶體快取
      if (useCache && !forceRefresh) {
        const memoryCacheResult = checkMemoryCache(conversationId, cacheKey, options)
        if (memoryCacheResult) return memoryCacheResult
      }
      
      // 檢查 localStorage 快取
      if (useCache && !forceRefresh && offset === 0) {
        const localCacheResult = checkLocalStorageCache(conversationId, localStorageKey, cacheKey, options)
        if (localCacheResult) return localCacheResult
      }

      // 從 API 獲取訊息
      const { conversationData, messagesData } = await fetchMessagesFromAPI(conversationId, options)
      
      // 格式化訊息
      const formattedMessages = formatMessages(messagesData)
      
      // 更新 UI 中的訊息列表
      if (offset === 0) {
        messages.value = formattedMessages
      } else {
        messages.value = [...formattedMessages, ...messages.value]
      }
      
      // 更新快取系統
      await updateMessageCache(conversationId, formattedMessages, options)
      
      const requestType = priority === 'background' ? '背景' : priority === 'high' ? '高優先級' : '普通'
      console.log(`✅ 載入對話 ${conversationId} 訊息成功，共 ${formattedMessages.length} 條 (${requestType}請求)`)
      
      // 如果是首次載入，滾動到底部
      if (offset === 0 && scrollToBottom) {
        nextTick(() => scrollToBottom())
      }

      return {
        messages: formattedMessages,
        hasMore: conversationData?.messages_pagination?.has_more || (formattedMessages.length === limit),
        total: conversationData?.messages_pagination?.total || formattedMessages.length,
        conversation: conversationData,
        fromAPI: true,
        requestType: requestType
      }

    } catch (error) {
      console.error(`❌ 獲取對話(ID: ${conversationId})訊息失敗:`, error)
      
      // 使用統一錯誤處理，並返回降級結果
      const errorResult = handleMessageError(error, {
        onFallback: () => console.log(`正在為對話 ${conversationId} 啟動降級策略`)
      })
      
      return await handleAPIFailureFallback(conversationId, error, options)
    } finally {
      if (options.priority !== 'high') {
        messageLoading.value = false
      }
    }
  }

  /**
   * 智能快取清理系統
   * @param {boolean} force 是否強制清理
   */
  const cleanupOldCache = (force = false) => {
    try {
      const allKeys = Object.keys(localStorage)
      const conversationKeys = allKeys.filter(key => key.startsWith(CONVERSATION_CACHE_PREFIX))
      
      if (force || conversationKeys.length > 50) { // 超過 50 個快取項目時清理
        const cacheItems = []
        
        // 收集所有快取項目和其時間戳
        conversationKeys.forEach(key => {
          if (!key.includes('_timestamp')) {
            const timestampKey = `${key}_timestamp`
            const timestamp = parseInt(localStorage.getItem(timestampKey)) || 0
            cacheItems.push({ key, timestamp })
          }
        })
        
        // 按時間排序，刪除最舊的項目
        cacheItems.sort((a, b) => b.timestamp - a.timestamp)
        const keepCount = force ? 20 : 40 // 保留最新的 20-40 個
        const toDelete = cacheItems.slice(keepCount)
        
        toDelete.forEach(item => {
          localStorage.removeItem(item.key)
          localStorage.removeItem(`${item.key}_timestamp`)
        })
        
        console.log(`🧹 清理了 ${toDelete.length} 個舊快取項目`)
      }
    } catch (e) {
      console.warn('快取清理過程中出錯:', e)
    }
  }

  /**
   * 清理快取
   * @param {string} conversationId 對話ID（可選，不提供則清理所有）
   */
  const clearMessageCache = (conversationId = null) => {
    if (conversationId) {
      // 清理特定對話的快取
      console.log(`🗑️ 清理對話 ${conversationId} 的快取`)
      
      // 清理記憶體快取
      let memoryCleared = 0
      for (const key of messageCache.keys()) {
        if (key.startsWith(conversationId)) {
          messageCache.delete(key)
          memoryCleared++
        }
      }
      
      // 清理 localStorage 快取
      const localStorageKey = `${CONVERSATION_CACHE_PREFIX}${conversationId}`
      try {
        localStorage.removeItem(localStorageKey)
        localStorage.removeItem(`${localStorageKey}_timestamp`)
        console.log(`✅ 已清理對話 ${conversationId} 的快取 (記憶體: ${memoryCleared} 項, localStorage: 2 項)`)
      } catch (e) {
        console.warn('清理 localStorage 時出錯:', e)
      }
    } else {
      // 清理所有快取
      console.log(`🗑️ 清理所有對話快取`)
      
      // 清理記憶體快取
      const memorySize = messageCache.size
      messageCache.clear()
      
      // 清理 localStorage 中的對話快取
      let localStorageCleared = 0
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(CONVERSATION_CACHE_PREFIX)) {
            localStorage.removeItem(key)
            localStorageCleared++
          }
        })
        console.log(`✅ 已清理所有快取 (記憶體: ${memorySize} 項, localStorage: ${localStorageCleared} 項)`)
      } catch (e) {
        console.warn('清理 localStorage 時出錯:', e)
      }
    }
  }

  /**
   * 獲取快取統計資訊
   * @returns {Object} 快取統計資訊
   */
  const getCacheStats = () => {
    const memoryStats = {
      size: messageCache.size,
      keys: Array.from(messageCache.keys())
    }
    
    const localStorageStats = {
      conversationCount: 0,
      totalSize: 0
    }
    
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CONVERSATION_CACHE_PREFIX) && !key.includes('_timestamp')) {
          localStorageStats.conversationCount++
          localStorageStats.totalSize += localStorage.getItem(key)?.length || 0
        }
      })
    } catch (e) {
      console.warn('計算 localStorage 統計時出錯:', e)
    }
    
    return {
      memory: memoryStats,
      localStorage: localStorageStats
    }
  }

  /**
   * 添加訊息到列表
   * @param {Object} message 訊息對象
   */
  const addMessage = (message) => {
    messages.value.push(message)
    if (scrollToBottom) {
      nextTick(() => scrollToBottom())
    }
  }

  /**
   * 更新訊息內容
   * @param {string} messageId 訊息ID
   * @param {Object} updates 要更新的內容
   */
  const updateMessage = (messageId, updates) => {
    const messageIndex = messages.value.findIndex(msg => msg.id === messageId)
    if (messageIndex !== -1) {
      messages.value[messageIndex] = {
        ...messages.value[messageIndex],
        ...updates
      }
    }
  }

  /**
   * 移除訊息
   * @param {string} messageId 訊息ID
   */
  const removeMessage = (messageId) => {
    const messageIndex = messages.value.findIndex(msg => msg.id === messageId)
    if (messageIndex !== -1) {
      messages.value.splice(messageIndex, 1)
    }
  }

  /**
   * 創建用戶訊息
   * @param {string} text 訊息文字
   * @param {Array} files 附件陣列
   * @returns {Object} 訊息對象
   */
  const createUserMessage = (text, files = []) => {
    const timestamp = Date.now()
    const tempUserMessageId = `temp_${timestamp}`
    
    return {
      id: tempUserMessageId,
      role: "user",
      text: text.trim(),
      files: files.length > 0 ? files.map(file => ({
        name: file.name,
        size: file.size,
        fileId: file.fileId,
        path: file.path
      })) : undefined,
      file: files.length === 1 ? {
        name: files[0].name,
        size: files[0].size,
        path: files[0].path
      } : undefined,
      createAt: new Date().toISOString(),
      _fileAttachments: files.map(file => ({
        fileId: file.fileId,
        path: file.path,
        name: file.name,
        size: file.size
      }))
    }
  }

  /**
   * 創建AI思考訊息
   * @param {string} thinkingText 思考文字
   * @returns {Object} 訊息對象
   */
  const createThinkingMessage = (thinkingText = '正在思考...') => {
    const timestamp = Date.now()
    const assistantMsgId = `assistant_${timestamp}`
    
    return {
      id: assistantMsgId,
      role: "assistant",
      text: thinkingText,
      isThinking: true,
      isLoading: true,
      createAt: new Date().toISOString()
    }
  }

  /**
   * 使用打字機效果更新訊息
   * @param {string} messageId 訊息ID
   * @param {string} responseText 回應文字
   * @param {Function} onComplete 完成回調
   */
  const typewriterUpdateMessage = (messageId, responseText, onComplete) => {
    startTyping(
      messageId,
      responseText,
      // 更新文本的回調
      (currentText) => {
        updateMessage(messageId, {
          text: currentText,
          isThinking: false,
          isLoading: false
        })
        if (scrollToBottom) {
          scrollToBottom()
        }
      },
      // 完成打字的回調
      async () => {
        isResponseGenerating.value = false
        console.log("AI回應打字效果完成")
        if (onComplete) {
          await onComplete()
        }
      }
    )
  }

  /**
   * 保存對話到快取
   * @param {string} conversationId 對話ID
   */
  const saveConversationToCache = (conversationId) => {
    if (conversationId && !isTempConversation(conversationId) && messages.value.length > 0) {
      const currentConversationKey = `${CONVERSATION_CACHE_PREFIX}${conversationId}`
      try {
        localStorage.setItem(currentConversationKey, JSON.stringify(messages.value))
        localStorage.setItem(`${currentConversationKey}_timestamp`, Date.now().toString())
        console.log(`保存對話 ${conversationId} 的歷史紀錄到 localStorage`)
        
        // 同時更新記憶體快取
        const cacheKey = `${conversationId}_100_0`
        messageCache.set(cacheKey, [...messages.value])
      } catch (error) {
        console.error("保存對話歷史紀錄失敗:", error)
      }
    }
  }

  return {
    // ===== 響應式狀態 =====
    messages,
    messageLoading,
    messageError,
    isResponseGenerating,
    
    // ===== 核心方法 =====
    getConversationMessages,
    addMessage,
    updateMessage,
    removeMessage,
    createUserMessage,
    createThinkingMessage,
    typewriterUpdateMessage,
    saveConversationToCache,
    
    // ===== 快取管理 =====
    clearMessageCache,
    getCacheStats,
    cleanupOldCache,
    
    // ===== 打字機效果 =====
    startTyping,
    isTyping,
    
    // ===== 工具函數 =====
    isTempConversation,
    
    // ===== 常數 =====
    CONVERSATION_CACHE_PREFIX
  }
}