import { ref, nextTick } from 'vue'
import { useErrorHandler, ERROR_STRATEGIES } from './useErrorHandler'

/**
 * 對話狀態管理 Composable
 * 
 * 統一管理所有對話相關的狀態和邏輯，包括：
 * - 對話列表管理
 * - 對話切換邏輯（含防抖和競態條件處理）
 * - 對話CRUD操作
 * - 快取管理
 * 
 * @param {Object} options 配置選項
 * @param {Object} options.apiServices API服務對象
 * @param {Function} options.clearMessageCache 清理訊息快取的函數
 * @returns {Object} 對話狀態管理相關的響應式資料和方法
 */
export function useConversationState(options = {}) {
  const { apiServices, clearMessageCache } = options
  const { conversationService } = apiServices || {}
  
  // 錯誤處理
  const { createContextHandler, ERROR_STRATEGIES } = useErrorHandler()
  const handleConversationError = createContextHandler('conversation', {
    strategy: ERROR_STRATEGIES.TOAST,
    silent: false
  })

  // ===== 核心狀態 =====
  const conversationList = ref([])
  const activeConversationId = ref(null)
  
  // ===== 載入狀態 =====
  const conversationListLoading = ref(false)
  const conversationListError = ref(null)
  
  // ===== 分頁狀態 =====
  const hasMoreConversations = ref(true)
  const currentPage = ref(1)
  const conversationsPerPage = 20
  
  // ===== 對話切換狀態管理 =====
  const switchingConversation = ref(false)
  const pendingConversationId = ref(null)
  const switchingTimeouts = new Map()
  
  // ===== 刪除狀態 =====
  const deletingConversations = ref(new Set())
  
  // ===== 配置常數 =====
  const CONVERSATION_SWITCH_DEBOUNCE = 150 // 150ms 防抖延遲
  const CONVERSATION_CACHE_PREFIX = 'conversation_'
  
  // ===== 防抖機制 =====
  let conversationSwitchTimeout = null

  /**
   * 獲取對話列表
   * @param {Object} options 選項
   * @param {number} options.page 頁碼
   * @param {number} options.limit 每頁數量
   * @param {string} options.sort 排序字段
   * @param {string} options.order 排序順序
   * @param {string} options.search 搜尋關鍵字
   * @param {boolean} options.reset 是否重置列表
   * @param {Function} options.getConversationMessages 獲取對話訊息的函數（用於自動選擇第一個對話時）
   */
  const getConversationList = async (options = {}) => {
    try {
      conversationListLoading.value = true
      conversationListError.value = null
      
      const {
        page = 1,
        limit = conversationsPerPage,
        sort = 'updated_at',
        order = 'desc',
        search = '',
        reset = true,
        getConversationMessages = null
      } = options

      const response = await conversationService.getList({
        page,
        limit,
        sort,
        order,
        search
      })
      
      console.log('獲取對話列表回應:', response)
      
      // 適配 v2 API 回傳結構
      const conversationData = response.conversations || response.data || []
      
      if (reset || page === 1) {
        // 重置或首次載入
        conversationList.value = conversationData
        currentPage.value = 1
      } else {
        // 分頁載入，追加到現有列表
        conversationList.value.push(...conversationData)
      }
      
      // 更新分頁狀態
      currentPage.value = page
      hasMoreConversations.value = conversationData.length === limit
      
      console.log(`載入了 ${conversationData.length} 個對話，總數: ${conversationList.value.length}`)

      // 如果有對話且當前沒有選中的對話，預設選擇第一個
      if (conversationList.value.length > 0 && !activeConversationId.value) {
        const firstRealConversation = conversationList.value.find(conv => !conv.is_temp)
        if (firstRealConversation && getConversationMessages) {
          await handleSelectConversation(firstRealConversation.id, getConversationMessages)
        }
      }

      return {
        conversations: conversationData,
        total: response.total || conversationData.length,
        hasMore: hasMoreConversations.value
      }

    } catch (error) {
      console.error("獲取對話列表失敗:", error)
      conversationListError.value = error.message || '獲取對話列表失敗'
      
      handleConversationError(error, {
        onFallback: () => {
          console.log('嘗試使用本地快取的對話列表')
        }
      })
      
      return {
        conversations: [],
        total: 0,
        hasMore: false
      }
    } finally {
      conversationListLoading.value = false
    }
  }

  /**
   * 選擇對話處理函數（優化版本，包含防抖和競態條件處理）
   * @param {string} id 對話ID
   * @param {Function} getConversationMessages 獲取對話訊息的函數
   */
  const handleSelectConversation = async (id, getConversationMessages) => {
    // 如果正在切換到相同對話，直接返回
    if (activeConversationId.value === id && !switchingConversation.value) {
      return
    }

    // 清除之前的防抖計時器
    if (conversationSwitchTimeout) {
      clearTimeout(conversationSwitchTimeout)
    }

    // 清除所有舊的切換計時器
    switchingTimeouts.forEach(timeout => clearTimeout(timeout))
    switchingTimeouts.clear()

    // 立即更新 UI 狀態，提供即時反饋
    const previousConversationId = activeConversationId.value
    activeConversationId.value = id
    pendingConversationId.value = id
    switchingConversation.value = true

    console.log(`🔄 開始切換對話: ${previousConversationId} → ${id}`)

    // 防抖處理：延遲執行實際的對話載入
    conversationSwitchTimeout = setTimeout(async () => {
      try {
        // 雙重檢查：確保這仍然是最新的切換請求
        if (pendingConversationId.value !== id) {
          console.log(`⚠️ 對話切換已被取消: ${id} (最新請求: ${pendingConversationId.value})`)
          return
        }

        // 保存上一個對話到 localStorage（如果有提供訊息）
        if (previousConversationId && getConversationMessages) {
          // 這部分邏輯由 useMessageState 處理
          console.log(`💾 準備保存對話 ${previousConversationId} 的歷史紀錄`)
        }

        // 載入新對話的訊息
        console.log(`📥 載入對話 ${id} 的訊息...`)
        if (getConversationMessages) {
          await getConversationMessages(id, { useCache: true, priority: 'high' })
        }
        
        console.log(`✅ 對話切換完成: ${id}`)
      } catch (error) {
        console.error(`❌ 對話切換失敗: ${id}`, error)
        
        // 錯誤處理：回退到上一個對話
        if (previousConversationId) {
          activeConversationId.value = previousConversationId
          console.log(`🔙 回退到上一個對話: ${previousConversationId}`)
        }
        
        handleConversationError(error)
      } finally {
        // 清理切換狀態
        if (pendingConversationId.value === id) {
          switchingConversation.value = false
          pendingConversationId.value = null
        }
      }
    }, CONVERSATION_SWITCH_DEBOUNCE)

    // 將計時器添加到追蹤列表
    switchingTimeouts.set(id, conversationSwitchTimeout)
  }

  /**
   * 載入更多對話
   */
  const loadMoreConversations = async () => {
    if (!hasMoreConversations.value || conversationListLoading.value) {
      return
    }
    
    const nextPage = currentPage.value + 1
    await getConversationList({
      page: nextPage,
      reset: false
    })
  }

  /**
   * 重新整理對話列表
   */
  const refreshConversationList = async () => {
    await getConversationList({ reset: true })
  }

  /**
   * 新增對話處理函數（v2 API 使用自動創建機制）
   */
  const handleAddConversation = async () => {
    try {
      // v2 API 採用聊天時自動創建對話的模式
      const tempId = `new_chat_${Date.now()}`
      const now = new Date()
      const newConversation = {
        id: tempId,
        title: "新對話",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        message_count: 0,
        status: 0, // 處理中狀態
        is_temp: true, // 標記為臨時對話
        isLoading: false
      }
      
      // 將新對話添加到列表頂部
      conversationList.value.unshift(newConversation)
      activeConversationId.value = tempId

      console.log(`創建新的臨時對話: ${tempId}`)

      return tempId
    } catch (error) {
      console.error("新增對話失敗:", error)
      handleConversationError(error)
      throw error
    }
  }

  /**
   * 處理對話刪除
   * @param {string} deletedId 要刪除的對話ID
   * @param {boolean|Object} hardDeleteOrOptions 是否硬刪除或選項對象
   */
  const handleConversationDeleted = async (deletedId, hardDeleteOrOptions = false) => {
    // 兼容舊的調用方式
    let hardDelete = false
    let options = {}
    
    if (typeof hardDeleteOrOptions === 'boolean') {
      hardDelete = hardDeleteOrOptions
    } else if (typeof hardDeleteOrOptions === 'object') {
      hardDelete = hardDeleteOrOptions.hardDelete || false
      options = hardDeleteOrOptions
    }
    
    // 檢查是否正在刪除中
    if (deletingConversations.value.has(deletedId)) {
      console.log(`對話 ${deletedId} 已在刪除進程中`)
      return
    }

    try {
      // 標記為刪除中
      deletingConversations.value.add(deletedId)
      
      // 更新 UI 狀態（顯示刪除進度）
      const conversationIndex = conversationList.value.findIndex(conv => conv.id === deletedId)
      if (conversationIndex !== -1) {
        conversationList.value[conversationIndex] = {
          ...conversationList.value[conversationIndex],
          status: 0, // 處理中狀態
          isLoading: true
        }
      }

      // 如果不是臨時對話，使用 v2 API 刪除對話
      const isTemp = deletedId.startsWith('temp_') || deletedId.startsWith('new_chat_')
      if (!isTemp && conversationService) {
        try {
          console.log(`準備刪除對話 ${deletedId} (硬刪除: ${hardDelete})`)
          const response = await conversationService.delete(deletedId, hardDelete)
          console.log(`對話 ${deletedId} 已成功從服務器刪除:`, response)
        } catch (apiError) {
          console.error('從服務器刪除對話時出錯:', apiError)
          
          // 還原 UI 狀態
          if (conversationIndex !== -1) {
            conversationList.value[conversationIndex] = {
              ...conversationList.value[conversationIndex],
              status: 2, // 錯誤狀態
              isLoading: false
            }
          }
          
          console.error(`刪除對話失敗: ${apiError.message || '未知錯誤'}`)
        }
      }

      // 從列表中移除已刪除的對話
      conversationList.value = conversationList.value.filter(
        (conv) => conv.id !== deletedId
      )

      // 清理快取
      if (clearMessageCache) {
        clearMessageCache(deletedId)
      }
      console.log(`已清理對話 ${deletedId} 的快取資料`)

      // 如果刪除的是當前選中的對話，選擇一個新的對話或清空
      if (activeConversationId.value === deletedId) {
        // 傳入 getConversationMessages 函數參數（如果提供）
        const getMessages = options.getConversationMessages
        await selectNewActiveConversation(getMessages)
      }

      // 重新整理對話列表以確保同步
      setTimeout(() => {
        refreshConversationList().catch(console.warn)
      }, 500)

      console.log(`對話 ${deletedId} 刪除完成`)

    } catch (error) {
      console.error('處理對話刪除時出錯:', error)
      
      // 還原 UI 狀態
      const conversationIndex = conversationList.value.findIndex(conv => conv.id === deletedId)
      if (conversationIndex !== -1) {
        conversationList.value[conversationIndex] = {
          ...conversationList.value[conversationIndex],
          status: 2, // 錯誤狀態
          isLoading: false
        }
      }
      
      handleConversationError(error)
    } finally {
      // 移除刪除標記
      deletingConversations.value.delete(deletedId)
    }
  }

  /**
   * 選擇新的活動對話
   * @param {Function} getConversationMessages 獲取對話訊息的函數（可選）
   */
  const selectNewActiveConversation = async (getConversationMessages) => {
    if (conversationList.value.length > 0) {
      // 選擇列表中的第一個非臨時對話作為新的活動對話
      const firstRealConversation = conversationList.value.find(conv => 
        !conv.is_temp && 
        !conv.id.startsWith('temp_') && 
        !conv.id.startsWith('new_chat_')
      )
      
      if (firstRealConversation) {
        // 如果提供了 getConversationMessages 函數，使用完整的切換邏輯
        if (getConversationMessages) {
          await handleSelectConversation(firstRealConversation.id, getConversationMessages)
        } else {
          await handleSelectConversation(firstRealConversation.id)
        }
        console.log(`切換到對話: ${firstRealConversation.id}`)
      } else {
        // 如果只有臨時對話，選擇第一個
        const firstConversation = conversationList.value[0]
        if (!firstConversation.is_temp) {
          if (getConversationMessages) {
            await handleSelectConversation(firstConversation.id, getConversationMessages)
          } else {
            await handleSelectConversation(firstConversation.id)
          }
        } else {
          activeConversationId.value = firstConversation.id
          // 臨時對話清空訊息
          if (getConversationMessages) {
            // 通知清空訊息
            console.log('臨時對話，清空訊息列表')
          }
        }
        console.log(`切換到對話: ${firstConversation.id} (臨時)`)
      }
    } else {
      // 如果沒有對話了，清空活動對話
      activeConversationId.value = null
      console.log('沒有可用對話，清空活動對話')
    }
  }

  /**
   * 批量刪除對話
   * @param {Array} conversationIds 要刪除的對話ID陣列
   * @param {boolean} hardDelete 是否硬刪除
   */
  const handleBulkDelete = async (conversationIds, hardDelete = false) => {
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return
    }
    
    console.log(`準備批量刪除 ${conversationIds.length} 個對話`)
    
    const deletePromises = conversationIds.map(id => 
      handleConversationDeleted(id, hardDelete)
    )
    
    try {
      await Promise.allSettled(deletePromises)
      console.log('批量刪除完成')
    } catch (error) {
      console.error('批量刪除過程中出錯:', error)
      handleConversationError(error)
    }
  }

  /**
   * 更新對話資訊（當收到新訊息或API回應時）
   * @param {string} conversationId 對話ID
   * @param {Object} updates 要更新的欄位
   */
  const updateConversationInfo = (conversationId, updates) => {
    const conversationIndex = conversationList.value.findIndex(conv => conv.id === conversationId)
    if (conversationIndex !== -1) {
      conversationList.value[conversationIndex] = {
        ...conversationList.value[conversationIndex],
        ...updates,
        updated_at: new Date().toISOString()
      }
      console.log(`更新對話 ${conversationId} 的資訊:`, updates)
    }
  }

  /**
   * 將臨時對話轉換為真實對話
   * @param {string} tempId 臨時對話ID
   * @param {string} realId 真實對話ID
   * @param {Object} conversationData 對話數據
   * @param {string} userMessage 用戶訊息內容（用於生成標題）
   */
  const convertTempToRealConversation = (tempId, realId, conversationData, userMessage = '') => {
    const tempIndex = conversationList.value.findIndex(conv => 
      conv.id === tempId || conv.id.startsWith('temp_') || conv.id.startsWith('new_chat_')
    )
    
    if (tempIndex !== -1) {
      // 優先使用 API 回傳的標題，其次用用戶訊息生成標題
      let newTitle = conversationData.title
      
      if (!newTitle && userMessage) {
        // 從用戶訊息生成標題（取前30字符）
        newTitle = userMessage.length > 30 
          ? userMessage.substring(0, 30) + '...' 
          : userMessage
      }
      
      // 如果都沒有，保持原標題
      if (!newTitle) {
        newTitle = conversationList.value[tempIndex].title
      }
      
      // 使用 Vue 的響應式更新，確保 UI 立即反映變化
      const updatedConversation = {
        ...conversationList.value[tempIndex],
        id: realId,
        title: newTitle,
        status: 1, // 完成狀態
        is_temp: false,
        message_count: conversationData.message_count || 2,
        updated_at: new Date().toISOString(),
        created_at: conversationData.created_at || conversationList.value[tempIndex].created_at,
        model: conversationData.model,
        service: conversationData.service || 'chat'
      }
      
      // 直接更新對話項目，觸發響應式更新
      conversationList.value.splice(tempIndex, 1, updatedConversation)
      
      console.log(`臨時對話 ${tempId} 已轉換為真實對話 ${realId}，標題: "${newTitle}"`)
      
      // 更新當前活動對話ID
      if (activeConversationId.value === tempId) {
        activeConversationId.value = realId
        console.log(`活動對話ID已更新: ${tempId} → ${realId}`)
      }
      
      // 清理舊的臨時對話快取
      if (clearMessageCache) {
        clearMessageCache(tempId)
      }
      
      // 返回更新後的對話資訊，供調用方使用
      return updatedConversation
    }
    
    return null
  }

  /**
   * 檢查是否為臨時對話
   * @param {string} conversationId 對話ID
   * @returns {boolean} 是否為臨時對話
   */
  const isTempConversation = (conversationId) => {
    return conversationId?.startsWith('temp_') || conversationId?.startsWith('new_chat_')
  }

  /**
   * 清理所有計時器
   */
  const cleanup = () => {
    // 清理所有計時器
    if (conversationSwitchTimeout) {
      clearTimeout(conversationSwitchTimeout)
    }
    switchingTimeouts.forEach(timeout => clearTimeout(timeout))
    switchingTimeouts.clear()
  }

  return {
    // ===== 響應式狀態 =====
    conversationList,
    activeConversationId,
    switchingConversation,
    conversationListLoading,
    conversationListError,
    hasMoreConversations,
    currentPage,
    deletingConversations,
    
    // ===== 核心方法 =====
    getConversationList,
    handleSelectConversation,
    handleAddConversation,
    handleConversationDeleted,
    handleBulkDelete,
    
    // ===== 輔助方法 =====
    loadMoreConversations,
    refreshConversationList,
    selectNewActiveConversation,
    updateConversationInfo,
    convertTempToRealConversation,
    isTempConversation,
    cleanup,
    
    // ===== 常數 =====
    CONVERSATION_SWITCH_DEBOUNCE,
    CONVERSATION_CACHE_PREFIX,
    conversationsPerPage
  }
}