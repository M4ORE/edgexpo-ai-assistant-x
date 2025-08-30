import { ref, computed } from 'vue';

/**
 * 打字機效果的 Composable 函數
 * @param {Object} options 配置選項
 * @param {Number} options.typingSpeed 打字速度(毫秒/字符)
 * @param {Number} options.startDelay 開始打字前的延遲(毫秒)
 * @returns {Object} 打字機相關的方法和狀態
 */
export function useTypewriter(options = {}) {
  const {
    typingSpeed = 30,
    startDelay = 200
  } = options;

  // 儲存所有正在打字的消息
  const typingMessages = ref(new Map());
  
  /**
   * 開始對指定消息應用打字機效果
   * @param {String} messageId 消息ID
   * @param {String} fullText 完整文本
   * @param {Function} updateCallback 更新消息文本的回調函數
   * @param {Function} completeCallback 打字完成後的回調函數
   */
  const startTyping = (messageId, fullText, updateCallback, completeCallback) => {
    if (typingMessages.value.has(messageId)) {
      return; // 避免重複開始
    }
    
    let charIndex = 0;
    typingMessages.value.set(messageId, {
      fullText,
      charIndex,
      isTyping: true
    });
    
    // 打字機效果實現
    const typeWriter = () => {
      const typingData = typingMessages.value.get(messageId);
      
      if (!typingData || charIndex >= fullText.length) {
        finishTyping(messageId);
        if (completeCallback) completeCallback();
        return;
      }
      
      charIndex++;
      const currentText = fullText.substring(0, charIndex);
      
      // 更新打字狀態
      typingMessages.value.set(messageId, {
        ...typingData,
        charIndex
      });
      
      // 調用更新回調
      updateCallback(currentText);
      
      // 繼續打字
      if (charIndex < fullText.length) {
        setTimeout(typeWriter, typingSpeed);
      } else {
        finishTyping(messageId);
        if (completeCallback) completeCallback();
      }
    };
    
    // 延遲開始打字
    setTimeout(typeWriter, startDelay);
  };
  
  /**
   * 完成打字過程
   * @param {String} messageId 消息ID
   */
  const finishTyping = (messageId) => {
    typingMessages.value.delete(messageId);
  };
  
  /**
   * 檢查消息是否正在打字
   * @param {String} messageId 消息ID
   * @returns {Boolean} 是否正在打字
   */
  const isTyping = (messageId) => {
    return typingMessages.value.has(messageId);
  };
  
  /**
   * 獲取當前正在打字的消息數
   */
  const typingCount = computed(() => typingMessages.value.size);
  
  /**
   * 停止所有打字動作
   */
  const stopAllTyping = () => {
    typingMessages.value.clear();
  };
  
  return {
    startTyping,
    finishTyping,
    isTyping,
    typingCount,
    stopAllTyping,
    typingMessages
  };
}