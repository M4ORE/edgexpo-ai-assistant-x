<template>
  <v-app>
    <!-- Main Content -->
    <v-main class="expo-gradient">
      <div class="content-wrapper">
        <!-- Main Container -->
        <v-container fluid class="main-container">
          <v-row>
            <!-- Main Voice Guide Section-->
            <v-col cols="7">
              <div class="left-column">
                <!-- Product Showcase - Top 50% -->
                <div class="showcase-section">
                  <product-showcase />
                </div>

                <!-- Card Scanning - Bottom 50% -->
                <div class="scanning-section">
                  <card-scanning
                    ref="cardScanningRef"
                    :scan-status="scanStatus"
                    :last-scan-time="lastScanTime"
                    :total-cards="totalCards"
                    :camera-stream="cardScanStream"
                    :captured-image-url="capturedImageUrl"
                    @scan="handleDirectCardScan"
                    @rescan="handleRescan"
                  />
                </div>
              </div>
            </v-col>

            <!-- Sidebar -->
            <v-col cols="5">
              <div class="sidebar-content">
            <!-- Chat Section - Bottom left quadrant -->
                <div
                  v-if="showInlineChat"
                  :class="['chat-section', { maximized: isChatMaximized }]"
                >
                  <div class="inline-chat-container">
                    <div class="chat-header">
                      <div class="chat-title">
                        <v-icon color="orange">mdi-chat</v-icon>
                        Interactive Q&A
                      </div>
                      <div class="chat-language-toggle">
                        <v-btn-toggle
                          v-model="currentLanguage"
                          @update:model-value="handleLanguageSwitchWrapper"
                          mandatory
                          density="compact"
                          variant="elevated"
                          divided
                          color="orange"
                          selected-class="bg-orange text-white"
                          class="language-toggle-group"
                        >
                          <v-btn value="en" size="small">
                            <strong>English</strong>
                          </v-btn>
                          <v-btn value="zh" size="small">
                            <strong>中文</strong>
                          </v-btn>
                        </v-btn-toggle>
                      </div>
                    </div>

                    <div
                      class="chat-messages"
                      ref="chatMessages"
                    >
                      <div
                        v-for="message in qaMessages"
                        :key="message.id"
                        :class="['chat-message', message.type || message.role]"
                      >
                        <div class="message-content">
                          <div class="message-text">{{ message.original }}</div>
                        </div>
                      </div>

                      <!-- 語音系統狀態指示 -->
                      <div
                        v-if="isQARecording || isQAProcessing"
                        class="chat-message system"
                      >
                        <div class="message-content">
                          <div class="recording-indicator">
                            <v-icon
                              :color="isQARecording ? 'red' : 'orange'"
                              class="pulse-animation"
                            >
                              {{ isQARecording ? "mdi-microphone" : "mdi-cog" }}
                            </v-icon>
                            {{
                              voiceStepText ||
                              (isQARecording ? "Listening..." : "Processing...")
                            }}
                          </div>
                          <!-- 處理進度條 -->
                          <div
                            v-if="isQAProcessing && processingProgress > 0"
                            class="mt-2"
                          >
                            <v-progress-linear
                              :model-value="processingProgress"
                              color="orange"
                              height="4"
                            ></v-progress-linear>
                          </div>
                        </div>
                      </div>

                      <!-- 錯誤提示 -->
                      <div v-if="voiceError" class="chat-message system">
                        <div class="message-content error-message">
                          <v-icon color="error" class="mr-2"
                            >mdi-alert-circle</v-icon
                          >
                          {{ voiceError }}
                        </div>
                      </div>
                    </div>

                    <div class="chat-controls">
                      <!-- 只有開始錄製按鈕，VAD會自動停止 -->
                      <v-btn
                        color="orange"
                        icon="mdi-microphone"
                        size="large"
                        variant="elevated"
                        :disabled="
                          !isVoiceSystemReady || isQAProcessing || isQARecording
                        "
                        @click="handleQARecordingWrapper"
                      />
                      <span class="ml-3">
                        <span v-if="!isVoiceSystemReady"
                          >Initializing voice system...</span
                        >
                        <span v-else-if="isQAProcessing">{{
                          voiceStepText
                        }}</span>
                        <span v-else-if="isQARecording"
                          >Listening... (VAD will auto-stop)</span
                        >
                        <span v-else>Click to ask a question</span>
                      </span>

                      <!-- 清除對話按鈕 -->
                      <v-btn
                        v-if="qaMessages.length > 0"
                        icon="mdi-delete-sweep"
                        size="small"
                        variant="text"
                        color="grey"
                        class="ml-2"
                        @click="clearQAMessages"
                        :disabled="isQARecording || isQAProcessing"
                        title="Clear conversation"
                      />
                      
                      <!-- 重新載入按鈕 -->
                      <v-btn
                        v-if="qaMessages.length > 0"
                        icon="mdi-reload"
                        size="small"
                        variant="text"
                        color="orange"
                        class="ml-1"
                        @click="handleReloadChat"
                        :disabled="isQARecording || isQAProcessing"
                        title="Reload to initial state"
                      />
                    </div>
                  </div>
                </div>
             
              </div>
            </v-col>
          </v-row>
        </v-container>
      </div>
    </v-main>

    <!-- Card Result Dialog -->
    <card-result-dialog
      v-model="showResultDialog"
      :card-data="scannedCardData"
      :is-processing="isCardProcessing"
      :captured-image="capturedImageUrl"
      @close="handleCardConfirm"
    />
  </v-app>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from "vue";

// Import components
import ProductShowcase from "../components/expo/ProductShowcase.vue";
import CardScanning from "../components/expo/CardScanning.vue";
import CardResultDialog from "../components/expo/CardResultDialog.vue";

// Import voice conversation composable
import { useVoiceConversation } from "../composables/useVoiceConversation.js";

// Import services
import { getBusinessCardService } from "../services/index.js";

// Default AI welcome messages
const defaultMessages = {
  zh: [
    "歡迎使用 EdgExpo AI Assistant X！我支援中英雙語對話，很樂意為您解答任何問題。",
    "請問您想了解什麼呢？\n例如您可以問我：\n• 這個系統可以支援哪些語言？\n• 語音辨識的準確度有多高？\n• 與傳統展覽服務相比有什麼不同？\n• 系統的回應速度有多快？"
  ],
  en: [
    "Welcome to EdgExpo AI Assistant! I support both Chinese and English conversations, and I'm happy to answer any questions.",
    "What would you like to know?\nFor example, you can ask me:\n• What languages does the system support?\n• How accurate is the voice recognition?"
  ]
};

// Q&A states
const showInlineChat = ref(true);
const chatMessages = ref(null);

// Card scan states
const scanStatus = ref("ready");
const lastScanTime = ref("Never");
const totalCards = ref(0);

// 初始化語音對話系統 - 預設為英文
const voiceConversation = useVoiceConversation({
  language: "en",
  enableLogging: true,
  vadSettings: {
    silenceThreshold: 30,
    vadTimeout: 1500, // 1秒靜音後自動停止
    enableVAD: true,
    autoStopOnSilence: true, // 啟用VAD自動停止
  },
});

// 從語音對話系統獲取狀態
const {
  // 狀態
  isInitialized: isVoiceSystemReady,
  isRecording: isQARecording,
  isProcessing: isQAProcessing,
  currentLanguage,
  conversations: qaMessages,
  currentStep: voiceStep,
  stepDisplayText: voiceStepText,
  processingProgress,
  lastError: voiceError,

  // 方法
  initialize: initializeVoiceSystem,
  startRecording,
  stopRecording,
  toggleRecording: handleQARecording,
  switchLanguage: handleLanguageSwitch,
  clearConversations: clearQAMessagesBase,
  dispose: disposeVoiceSystem,
} = voiceConversation;

// Wrap clear messages to reload defaults
const clearQAMessages = () => {
  clearQAMessagesBase();
  loadDefaultMessages(currentLanguage.value);
};

// Handle reload chat to initial state
const handleReloadChat = () => {
  console.log("Reloading chat to initial state...");
  
  // Clear all messages first
  clearQAMessagesBase();
  
  // Reset to default language (English)
  if (currentLanguage.value !== 'en') {
    handleLanguageSwitch('en');
  }
  
  // Load default English messages
  loadDefaultMessages('en');
  
  // Reset any error states
  lastError.value = null;
  
  console.log("Chat reloaded to initial state");
};

// Card scan dialog states
const showResultDialog = ref(false);
const isCardProcessing = ref(false);
const ocrSuccess = ref(false);
const capturedImageUrl = ref("");
const isChatMaximized = ref(false);

const scannedCardData = reactive({
  name: "",
  company: "",
  position: "",
  phone: "",
  email: "",
  address: "",
});

// Business card service
const businessCardService = getBusinessCardService();
const cardScanStream = ref(null);
const cardScanningRef = ref(null);
const isCameraActive = ref(false);


// Direct card scanning handler (new flow)
const handleDirectCardScan = async () => {
  console.log("Starting direct card scan...");

  try {
    // 確保攝影機已啟動
    if (!cardScanStream.value) {
      await initCardScanCamera();
    }

    // 立即執行掃描
    await performDirectCardScan();
  } catch (error) {
    console.error("Direct card scan error:", error);
    scanStatus.value = "ready";
    // 靜默處理錯誤，不顯示alert
  }
};


// 初始化名片掃描攝影機
const initCardScanCamera = async () => {
  try {
    console.log("Initializing card scan camera...");

    // 請求攝影機權限
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "environment", // 使用後置攝影機
      },
      audio: false,
    });

    cardScanStream.value = stream;
    isCameraActive.value = true;

    console.log("Card scan camera initialized successfully");
  } catch (error) {
    console.error("Failed to initialize card scan camera:", error);
    scanStatus.value = "ready";
    throw error;
  }
};

// 停止名片掃描攝影機
const stopCardScanCamera = () => {
  if (cardScanStream.value) {
    cardScanStream.value.getTracks().forEach((track) => track.stop());
    cardScanStream.value = null;
  }
  isCameraActive.value = false;
  console.log("Card scan camera stopped");
};

// 執行直接掃描 (新流程)
const performDirectCardScan = async () => {
  if (!cardScanStream.value) {
    throw new Error("Camera stream not available");
  }

  try {
    scanStatus.value = "processing";
    isCardProcessing.value = true;

    console.log("Capturing image for direct OCR...");

    // 等待一小段時間讓攝影機穩定
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 從CardScanning組件取得video元素
    let video = null;
    if (cardScanningRef.value?.videoElement) {
      video = cardScanningRef.value.videoElement;
      console.log("Using video element from CardScanning ref");
    } else {
      throw new Error("Video element not found in CardScanning component");
    }

    // 等待video元素準備就緒
    if (video.readyState < 2) {
      console.log("Waiting for video to be ready...");
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 30; // 3秒超時

        const checkReady = () => {
          attempts++;
          if (video.readyState >= 2) {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error("Video element timeout waiting to be ready"));
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error(
        `Video dimensions not ready: ${video.videoWidth}x${video.videoHeight}`
      );
    }

    console.log(
      `Capturing from video: ${video.videoWidth}x${video.videoHeight}`
    );

    // 創建canvas來截取圖片
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0);

    // 轉換為Blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.8);
    });

    if (!blob) {
      throw new Error("Failed to capture image from video");
    }

    // 創建圖片 URL
    const imageUrl = URL.createObjectURL(blob);
    let ocrCompleted = false;
    
    // 設置 2 秒延遲顯示圖片的定時器
    const displayImageTimer = setTimeout(() => {
      if (!ocrCompleted) {
        capturedImageUrl.value = imageUrl;
        console.log("Captured image displayed after 2 seconds (OCR still processing)");
      }
    }, 2000);

    console.log(`Image captured: ${blob.size} bytes, sending to OCR API...`);

    // 調用OCR API
    const result = await businessCardService.scanBusinessCard(blob, {
      language: "zh-TW",
    });

    // 標記 OCR 已完成
    ocrCompleted = true;

    if (result.success) {
      // 更新掃描到的名片資料
      Object.assign(scannedCardData, result.data);
      
      scanStatus.value = "complete";
      ocrSuccess.value = true;
      totalCards.value++;
      lastScanTime.value = "just now";

      // 清除定時器
      clearTimeout(displayImageTimer);
      
      // 設置圖片 URL（如果還沒設置的話）
      if (!capturedImageUrl.value) {
        capturedImageUrl.value = imageUrl;
      }

      console.log("OCR completed, auto-saving to CRM");
      
      // 自動儲存到CRM
      try {
        const saveResult = await businessCardService.saveContact(result.data);
        
        if (saveResult.success) {
          console.log("Card auto-saved successfully:", saveResult.contact_id);
          
          // 如果有email，自動發送產品目錄
          if (result.data.email) {
            const catalogResult = await businessCardService.sendProductCatalog(
              saveResult.contact_id,
              {
                language: currentLanguage.value,
                customMessage: "Thank you for visiting our exhibition!",
              }
            );
            
            if (catalogResult.success) {
              console.log("Product catalog sent successfully");
            } else {
              console.error("Failed to send catalog:", catalogResult.error);
            }
          }
          
          // 刷新聯絡人列表
          if (cardScanningRef.value?.loadRecentContacts) {
            cardScanningRef.value.loadRecentContacts();
          }
        } else {
          console.error("Failed to save contact:", saveResult.error);
        }
      } catch (error) {
        console.error("Auto-save error:", error);
      }
      
      showResultDialog.value = true;
    } else {
      // OCR 失敗時清除定時器
      clearTimeout(displayImageTimer);
      throw new Error(result.error || "OCR processing failed");
    }
  } catch (error) {
    // OCR 錯誤時也清除定時器
    clearTimeout(displayImageTimer);
    
    console.error("Direct card scan error:", error);
    scanStatus.value = "ready";
    ocrSuccess.value = false;

    // 清空並釋放圖片 URL
    if (capturedImageUrl.value) {
      URL.revokeObjectURL(capturedImageUrl.value);
      capturedImageUrl.value = "";
    }

  } finally {
    isCardProcessing.value = false;
  }
};


// Function to load default AI messages
const loadDefaultMessages = (language) => {
  // Clear existing messages first
  qaMessages.value = [];
  
  // Add default messages for the selected language
  const messages = defaultMessages[language] || defaultMessages['zh'];
  messages.forEach((text, index) => {
    qaMessages.value.push({
      id: index + 1,
      type: "ai",
      role: "ai",
      original: text,
    });
  });
  
  // Auto scroll to bottom
  nextTick(() => {
    if (chatMessages.value) {
      chatMessages.value.scrollTop = chatMessages.value.scrollHeight;
    }
  });
};


// 語言切換處理
const handleLanguageSwitchWrapper = (language) => {
  handleLanguageSwitch(language);
  console.log("Language switched to:", language);
  
  // Reload default messages with new language
  loadDefaultMessages(language);
};

// Q&A 錄製處理（只啟動錄製，VAD自動停止）
const handleQARecordingWrapper = async () => {
  try {
    console.log("Q&A Recording button clicked, starting recording with VAD...");

    // 只啟動錄製（不是切換），VAD會自動檢測靜音並停止
    const result = await startRecording();

    if (result && !result.success) {
      console.error("Voice recording failed:", result.error);
    }

    // 自動滾動到底部
    nextTick(() => {
      if (chatMessages.value) {
        chatMessages.value.scrollTop = chatMessages.value.scrollHeight;
      }
    });
  } catch (error) {
    console.error("Q&A recording error:", error);
  }
};

const handleRescan = async () => {
  try {
    console.log("Starting rescan process...");

    // 清空之前的資料
    Object.assign(scannedCardData, {
      name: "",
      company: "",
      position: "",
      phone: "",
      email: "",
      address: "",
    });

    // 重置所有狀態
    scanStatus.value = "ready";
    ocrSuccess.value = false;
    isCardProcessing.value = false;

    // 清空並釋放圖片 URL
    if (capturedImageUrl.value) {
      URL.revokeObjectURL(capturedImageUrl.value);
      capturedImageUrl.value = "";
    }

    // 關閉對話框
    showResultDialog.value = false;

    // 重新初始化相機
    await initCardScanCamera();

    console.log("Rescan: Camera reinitialized, ready for new scan");
  } catch (error) {
    console.error("Rescan error:", error);
  }
};

// 移除重複的handleCardRescan

// 由於自動儲存，這個函數現在只用於關閉對話框
const handleCardConfirm = async (confirmedData) => {
  // 關閉對話框並重置狀態
  showResultDialog.value = false;
  scanStatus.value = "ready";
  
  // 清空並釋放圖片 URL
  if (capturedImageUrl.value) {
    URL.revokeObjectURL(capturedImageUrl.value);
    capturedImageUrl.value = "";
  }
  
  isCardProcessing.value = false;
};

onMounted(async () => {
  console.log("EdgeExpo Demo initialized");
  // 初始化語音對話系統
  try {
    console.log("Initializing voice conversation system...");
    const result = await initializeVoiceSystem();
    if (result.success) {
      console.log("Voice conversation system initialized successfully");
    } else {
      console.error("Failed to initialize voice system:", result.error);
    }
  } catch (error) {
    console.error("Voice system initialization error:", error);
  }

  // 使用 nextTick 確保 DOM 更新後設置語言
  await nextTick();
  
  // 確保 currentLanguage 正確設置為英文
  if (currentLanguage.value !== 'en') {
    await handleLanguageSwitch('en');
  }
  
  // 載入預設 AI 對話訊息 (預設為英文)
  loadDefaultMessages('en');

  // 直接啟動名片掃描攝影機
  try {
    await initCardScanCamera();
    console.log("Card scan camera initialized on startup");
  } catch (error) {
    console.warn("Failed to initialize card scan camera on startup:", error);
  }
});

onUnmounted(() => {

  // 清理語音對話系統
  try {
    disposeVoiceSystem();
    console.log("Voice conversation system disposed");
  } catch (error) {
    console.error("Error disposing voice system:", error);
  }

  // 清理攝影機
  stopCardScanCamera();
});
</script>

<style scoped>
/* Gradient background */
.expo-gradient {
  background: linear-gradient(135deg, #fff7e6 0%, #ffeaa7 50%, #fdcb6e 100%);
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Content wrapper for proper layout */
.content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Main container */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
  min-height: 0;
  height: 100%;
}

/* Main row */
.main-row {
  flex: 1;
  margin: 0;
  display: flex;
  gap: 16px;
  overflow: hidden;
  height: 100%;
}

/* Left column layout */
.left-column {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  gap: 16px;
}

/* Showcase section - Top 50% */
.showcase-section {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Controls section */
.controls-section {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

/* Content section */
.content-section {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* Sidebar content */
.sidebar-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 58px);
  gap: 16px;
}

/* Detection section */
.detection-section {
  height: 100%;
  overflow: auto;
}

/* Scanning section - Bottom 50% */
.scanning-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* QA section wrapper */
.qa-section-wrapper {
  flex: 0 0 auto;
  padding: 0 16px 16px;
}

/* QA Overlay Button */
.qa-overlay-button {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
}

/* Chat Section */
.chat-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: calc(100vh - 80px);
  overflow: hidden;
}
.chat-section.maximized {
  height: 100%;
}

/* Inline Chat Container */
.inline-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #ffd54f;
}

/* Chat Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fff7e6 0%, #ffeaa7 100%);
  border-bottom: 2px solid #ffd54f;
  flex-shrink: 0;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: bold;
  color: #8b4513;
}

.chat-language-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Language toggle button styling */
.language-toggle-group {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.language-toggle-group .v-btn {
  min-width: 70px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.language-toggle-group .v-btn:not(.v-btn--active) {
  background-color: #fff;
  color: #ff9800;
  border: 1px solid #ff9800;
}

.language-toggle-group .v-btn:not(.v-btn--active):hover {
  background-color: #fff3e0;
}

.language-toggle-group .v-btn.v-btn--active {
  background-color: #ff9800 !important;
  color: white !important;
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
  transform: scale(1.05);
}

/* Chat Messages */
.chat-messages {
  padding: 20px;
  overflow-y: auto;
  background: linear-gradient(135deg, #fffef7 0%, #fff8e1 100%);
  flex: 1 1 auto; /* 佔滿剩餘空間 */
  min-height: 0; /* 允許在彈性容器內縮放 */
}

.chat-message {
  margin-bottom: 16px;
  display: flex;
  flex-shrink: 0; /* 固定高度，不允許收縮 */
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.ai {
  justify-content: flex-start;
}

.chat-message.system {
  justify-content: center;
}

.message-content {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 12px;
  position: relative;
}

.chat-message.user .message-content {
  background: #e3f2fd;
  border-bottom-right-radius: 4px;
}

.chat-message.ai .message-content {
  background: #fff3e0;
  border-bottom-left-radius: 4px;
}

.chat-message.system .message-content {
  background: #f5f5f5;
  text-align: center;
  border-radius: 20px;
  max-width: 300px;
}

.message-text {
  font-size: 16px;
  color: #424242;
  margin-bottom: 4px;
  white-space: pre-line;
  line-height: 1.6;
}

.message-translated {
  font-size: 14px;
  color: #757575;
  font-style: italic;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff5252;
  font-weight: 500;
}

/* Chat Controls */
.chat-controls {
  display: flex;
  align-items: center;
  padding: 8px 0px;
  background: white;
  border-top: 2px solid #ffd54f;
  flex-shrink: 0; /* 防止控制區域縮小 */
  justify-content: center;
}

/* Scrollbar styling for chat */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #ff9500;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #f57c00;
}

/* Animation for pulse effect */
@keyframes pulse {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }

  100% {
    opacity: 1;
  }
}

::deep(.pulse-animation) {
  animation: pulse 2s infinite;
}

/* Error message styling */
.error-message {
  background: #ffebee !important;
  border: 1px solid #f44336 !important;
  color: #c62828 !important;
}

/* Processing indicator improvements */
.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff5252;
  font-weight: 500;
  flex-direction: column;
}

.recording-indicator .v-icon {
  margin-bottom: 4px;
}
</style>
