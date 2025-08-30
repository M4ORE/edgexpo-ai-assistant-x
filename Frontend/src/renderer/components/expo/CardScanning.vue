<template>
  <v-card elevation="0" rounded="lg" class="card-scan-card">
    <v-card-title>
      <div class="title-content">
        <div class="title-text">
          <v-icon icon="mdi-card-account-details" class="mr-2" />
          Card Scanning
        </div>
        <div class="title-buttons">
          <!-- Start Scan Button -->
          <v-btn
            size="small"
            :color="scanButtonColor"
            :loading="isScanning"
            :disabled="isScanning || !cameraStream"
            variant="elevated"
            class="mr-2 scan-action-btn"
            @click="handleScanClick"
          >
            <v-icon start size="small">{{ scanButtonIcon }}</v-icon>
            {{ scanButtonText }}
          </v-btn>
          
          <!-- View Recent Button -->
          <v-btn
            size="small"
            variant="outlined"
            color="orange"
            class="recent-action-btn"
            @click="showRecentScans = true"
          >
            <v-icon start size="small">mdi-history</v-icon>
            Recent
          </v-btn>
        </div>
      </div>
    </v-card-title>

    <v-card-text class="card-content flex-grow-1 d-flex flex-column pa-3">
      <!-- Camera Preview Area -->
      <div class="camera-preview-container flex-grow-1">
        <div v-if="cameraStream" class="video-container h-100">
          <video
            ref="videoElement"
            autoplay
            muted
            playsinline
            class="video-preview"
            @loadedmetadata="onVideoLoaded"
            @error="onVideoError"
          ></video>
          
          <!-- Captured Image Overlay -->
          <div v-if="capturedImageUrl" class="captured-overlay">
            <v-img
              :src="capturedImageUrl"
              alt="Captured Business Card"
              class="captured-image"
              contain
            />
            <div v-if="scanStatus === 'processing'" class="processing-overlay">
              <v-progress-circular
                indeterminate
                color="orange"
                size="64"
                class="mb-3"
              />
              <div class="text-white font-weight-medium text-h6">
                圖片辨識中...
              </div>
            </div>
          </div>

          <!-- Scan Status Overlay -->
          <div v-if="scanStatus === 'processing' && !capturedImageUrl" class="status-overlay">
            <v-progress-circular
              indeterminate
              color="orange"
              size="48"
              class="mb-2"
            />
            <div class="text-white font-weight-medium">Processing...</div>
          </div>
        </div>
        
        <!-- No Camera State -->
        <div v-else class="no-camera-state h-100">
          <v-icon size="64" color="grey-lighten-2">mdi-camera-off</v-icon>
          <div class="mt-3 text-grey-darken-1">Camera not available</div>
          <div class="text-caption text-grey">Please check camera permissions</div>
        </div>
      </div>
    </v-card-text>

    <!-- Recent Scans Dialog -->
    <v-dialog
      v-model="showRecentScans"
      max-width="500"
      max-height="900"
      scrollable
      persistent
    >
      <v-card height="900">
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <v-icon icon="mdi-history" class="mr-2" />
            Recent Scans (Total: {{ recentScans.length }})
          </div>
          <v-btn
            icon="mdi-refresh"
            variant="text"
            size="small"
            @click="loadRecentContacts"
            :loading="isLoading"
          />
        </v-card-title>

        <v-card-text class="pa-0">
          <v-list v-if="!isLoading && recentScans.length > 0">
            <v-list-item
              v-for="contact in recentScans"
              :key="contact.id"
              class="contact-item"
            >
              <template v-slot:prepend>
                <v-avatar color="orange-lighten-3" size="48">
                  <v-icon>mdi-account</v-icon>
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-medium">
                {{ contact.name }}
                <v-chip
                  v-if="contact.position"
                  size="x-small"
                  color="blue-grey-lighten-4"
                  class="ml-2"
                >
                  {{ contact.position }}
                </v-chip>
              </v-list-item-title>

              <v-list-item-subtitle>
                <div class="mt-1">
                  <div v-if="contact.company" class="d-flex align-center">
                    <v-icon icon="mdi-domain" size="small" class="mr-1" />
                    {{ contact.company }}
                  </div>
                  <div v-if="contact.email" class="d-flex align-center mt-1">
                    <v-icon icon="mdi-email" size="small" class="mr-1" />
                    {{ contact.email }}
                  </div>
                  <div v-if="contact.phone" class="d-flex align-center mt-1">
                    <v-icon icon="mdi-phone" size="small" class="mr-1" />
                    {{ contact.phone }}
                  </div>
                </div>
              </v-list-item-subtitle>

              <template v-slot:append>
                <div class="d-flex flex-column align-end">
                  <span class="text-caption text-grey-darken-2 mb-2">{{
                    contact.time
                  }}</span>
                  <v-btn
                    v-if="contact.id"
                    icon
                    size="small"
                    color="orange"
                    variant="tonal"
                    @click="resendCatalog(contact)"
                    :loading="isResending[contact.id]"
                    :disabled="isResending[contact.id]"
                  >
                    <v-icon>mdi-send</v-icon>
                    <v-tooltip activator="parent" location="top">
                      Resend product catalog
                    </v-tooltip>
                  </v-btn>
                </div>
              </template>
            </v-list-item>

            <v-divider v-if="recentScans.length > 0" />
          </v-list>

          <!-- Loading State -->
          <div v-else-if="isLoading" class="text-center py-8">
            <v-progress-circular indeterminate color="orange" />
            <div class="mt-4 text-grey-darken-2">
              Loading contact data......
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-8">
            <v-icon icon="mdi-account-off" size="64" color="grey-lighten-2" />
            <div class="mt-4 text-grey-darken-2">No contact data available</div>
            <div class="text-caption text-grey">
              Start scanning business cards to build your contacts database
            </div>
            <v-btn
              color="orange"
              variant="tonal"
              class="mt-4"
              @click="loadRecentContacts"
              :loading="isLoading"
            >
              Reload
            </v-btn>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="showRecentScans = false">關閉</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { getBusinessCardService } from "../../services/index.js";

// Props
const props = defineProps({
  scanStatus: {
    type: String,
    default: "ready",
    validator: (value) =>
      ["ready", "scanning", "processing", "complete"].includes(value),
  },
  lastScanTime: {
    type: String,
    default: "Never",
  },
  totalCards: {
    type: Number,
    default: 0,
  },
  cameraStream: {
    type: Object,
    default: null,
  },
  capturedImageUrl: {
    type: String,
    default: "",
  },
});

// Emits
const emit = defineEmits(["scan", "rescan", "resendEmail"]);

// Services
const businessCardService = getBusinessCardService();

// Local state
const showRecentScans = ref(false);
const recentScans = ref([]);
const isLoading = ref(false);
const isResending = ref({});
const videoElement = ref(null);

// Computed properties
const isScanning = computed(() => {
  return props.scanStatus === "scanning" || props.scanStatus === "processing";
});

const scanAreaColor = computed(() => {
  switch (props.scanStatus) {
    case "scanning":
    case "processing":
      return "orange-lighten-4";
    case "complete":
      return "green-lighten-4";
    default:
      return "amber-lighten-5";
  }
});

const scanButtonColor = computed(() => {
  if (props.scanStatus === "complete") return "green";
  if (isScanning.value) return "orange-lighten-1";
  return "orange";
});

const scanButtonIcon = computed(() => {
  switch (props.scanStatus) {
    case "scanning":
      return "mdi-camera";
    case "processing":
      return "mdi-text-recognition";
    case "complete":
      return "mdi-check";
    default:
      return "mdi-scan-helper";
  }
});

const scanButtonText = computed(() => {
  if (isScanning.value) {
    return "Processing...";
  }
  
  // 如果有圖片顯示，按鈕文字變成 Rescan
  if (props.capturedImageUrl) {
    return "Rescan";
  }
  
  return "Start Scan";
});

// Methods
const handleScanClick = () => {
  // 如果有圖片顯示，執行 rescan
  if (props.capturedImageUrl) {
    emit("rescan");
  } else {
    // 否則執行正常的掃描
    emit("scan");
  }
};

const statusColor = computed(() => {
  switch (props.scanStatus) {
    case "scanning":
    case "processing":
      return "orange";
    case "complete":
      return "green";
    default:
      return "grey";
  }
});

const statusText = computed(() => {
  switch (props.scanStatus) {
    case "scanning":
      return "Capturing image...";
    case "processing":
      return "Extracting information...";
    case "complete":
      return "Ready for next scan";
    default:
      return "Ready to scan";
  }
});

// Methods
const loadRecentContacts = async () => {
  try {
    isLoading.value = true;
    console.log("Loading recent contacts...");

    const result = await businessCardService.getContacts({
      limit: 10000,
      sort: "created_at",
      order: "desc",
    });

    if (result.success) {
      recentScans.value = result.contacts.map((contact) => ({
        id: contact.contact_id,
        name: contact.name || "Unknown",
        company: contact.company || "No Company",
        email: contact.email || "",
        phone: contact.phone || "",
        position: contact.position || "",
        address: contact.address || "",
        time: formatTimeAgo(contact.created_at),
        created_at: contact.created_at,
      }));

      console.log(`Loaded ${recentScans.value.length} recent contacts`);
    } else {
      console.error("Failed to load contacts:", result.error);
      recentScans.value = [];
    }
  } catch (error) {
    console.error("Error loading contacts:", error);
    recentScans.value = [];
  } finally {
    isLoading.value = false;
  }
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return "Unknown";

  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min ago`;
  return "just now";
};

const resendCatalog = async (contact) => {
  try {
    isResending.value[contact.id] = true;
    console.log("Resending catalog to:", contact.name);

    if (!contact.id) {
      console.warn("This contact has no email address, cannot send catalog.");
      return;
    }

    const result = await businessCardService.sendProductCatalog(contact.id, {
      language: "zh-TW",
      customMessage:
        "Thank you for your interest! Here are our latest product catalogs.",
    });

    if (result.success) {
      console.log(`The product catalog has been sent to ${contact.name} successfully!`);
      console.log("Catalog sent successfully to:", contact.id);
    } else {
      throw new Error(result.error || "Failed to send catalog");
    }
  } catch (error) {
    console.error("Error sending catalog:", error);
    console.error(`Failed to send catalog: ${error.message}`);
  } finally {
    isResending.value[contact.id] = false;
  }
};

// Lifecycle
onMounted(() => {
  loadRecentContacts();
});

// Camera handling methods
const onVideoLoaded = () => {
  if (videoElement.value) {
    console.log("CardScanning: Video loaded successfully");
  }
};

const onVideoError = (error) => {
  console.error("CardScanning: Video error:", error);
};

// Watch for camera stream changes
watch(
  [() => props.cameraStream, videoElement],
  async ([newStream]) => {
    await nextTick();
    const video = videoElement.value;
    if (!video) return;

    if (newStream) {
      video.srcObject = newStream;
      try {
        await video.play();
        console.log("CardScanning: Camera stream connected");
      } catch (e) {
        console.warn("CardScanning: autoplay failed:", e);
      }
    } else {
      if (video.srcObject) {
        video.srcObject = null;
      }
      console.log("CardScanning: Camera stream cleared");
    }
  },
  { immediate: true }
);

// Expose methods to reload contacts and video element
defineExpose({
  loadRecentContacts,
  videoElement,
});
</script>

<style scoped>
.card-scan-card {
  height: 100%;
  background: rgba(255, 255, 255, 0.95) !important;
  display: flex;
  flex-direction: column;
}

.title-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.title-text {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  color: #8b4513;
}

.title-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scan-action-btn {
  min-width: auto !important;
  font-weight: bold;
}

.recent-action-btn {
  min-width: auto !important;
}

/* Card Content */
.card-content {
  min-height: 0;
  height: 100%;
}

/* Camera Preview Styles */
.camera-preview-container {
  position: relative;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  border-radius: 8px;
  border: 2px solid #ffd54f;
  flex: 1;
}

.video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captured-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.captured-image {
  max-width: 80%;
  max-height: 80%;
  border: 2px solid #ffd54f;
  border-radius: 8px;
}

.processing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.status-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}

.no-camera-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  border: 2px dashed #ccc;
  border-radius: 8px;
}


.scan-area {
  background: linear-gradient(135deg, #fffef7 0%, #fff8e1 100%) !important;
  border: 2px dashed #ffcc02 !important;
  transition: all 0.3s ease;
}

.scan-area:hover {
  border-color: #ff9500 !important;
  transform: scale(1.02);
}


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

.pulse-animation {
  animation: pulse 1.5s infinite;
}

/* Scan transition */
.scan-fade-enter-active,
.scan-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.scan-fade-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.scan-fade-leave-to {
  opacity: 0;
  transform: scale(1.2);
}

/* Contact item styles */
.contact-item {
  border-bottom: 1px solid #f0f0f0;
  padding: 16px !important;
}

.contact-item:last-child {
  border-bottom: none;
}

.contact-item:hover {
  background-color: #fafafa;
}

/* Responsive Design */
@media (max-height: 600px) {
  
  .title-text {
    font-size: 16px;
  }
  
  .title-buttons .v-btn {
    min-height: 28px !important;
  }
}

@media (max-height: 500px) {
  .title-text {
    font-size: 14px;
  }
  
  .title-buttons .v-btn {
    min-height: 26px !important;
    font-size: 12px;
  }
}

/* Ensure minimum heights are respected */
.card-scan-card {
  min-height: 300px;
}

@media (min-height: 800px) {
  .camera-preview-container {
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .card-content {
    padding: 12px !important;
  }
  
  .title-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .title-buttons {
    align-self: flex-end;
  }
}

@media (max-width: 480px) {
  .title-buttons .v-btn {
    font-size: 11px;
    padding: 0 8px !important;
  }
  
  .title-buttons .v-btn .v-icon {
    font-size: 16px !important;
  }
}
</style>
