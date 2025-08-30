<template>
  <v-card elevation="0" rounded="lg" class="detection-card">
    <v-card-title class="d-flex justify-space-between align-center">
      <div>
        <v-icon icon="mdi-eye" class="mr-2" />
        People Detection
      </div>
      <v-chip :color="hasVideo ? 'success' : 'grey'" text-color="white" small>
        {{ hasVideo ? "Active" : "Inactive" }}
      </v-chip>
    </v-card-title>

    <v-divider></v-divider>

    <v-card-text class="pa-0">
      <div class="video-container">
        <!-- 影像串流顯示 -->
        <video
          ref="videoElement"
          autoplay
          muted
          playsinline
          class="video-preview"
          @loadedmetadata="onVideoLoaded"
          @error="onVideoError"
        ></video>

        <!-- People Detection Overlay -->
        <div v-if="hasVideo && isActive" class="detection-overlay">
          <v-progress-circular
            :rotate="-90"
            :size="60"
            :width="4"
            :model-value="detectedCount * 20"
            color="orange"
            class="detection-indicator"
          >
            {{ detectedCount }}
          </v-progress-circular>
        </div>

        <!-- 無影像時的預設畫面 -->
        <div v-if="!hasVideo" class="video-placeholder">
          <v-icon size="64" color="white">mdi-eye-off</v-icon>
          <p class="text-white mt-3 mb-2">
            Waiting for people detection to start
          </p>
          <p class="text-caption text-white opacity-70">
            Please allow the browser to access your camera
          </p>
        </div>

        <!-- 影像控制按鈕 -->
        <div class="video-controls" v-if="hasVideo">
          <v-btn
            icon
            size="small"
            class="video-control-btn"
            @click="toggleFullscreen"
          >
            <v-icon>mdi-fullscreen</v-icon>
          </v-btn>

          <v-btn
            icon
            size="small"
            class="video-control-btn"
            @click="captureSnapshot"
          >
            <v-icon>mdi-camera</v-icon>
          </v-btn>
        </div>

        <!-- 影像資訊疊加 -->
        <div class="video-info" v-if="hasVideo && videoInfo">
          <v-chip x-small color="black" text-color="white" class="opacity-80">
            {{ videoInfo.width }}x{{ videoInfo.height }} @
            {{ videoInfo.frameRate }}fps
          </v-chip>
        </div>
      </div>
    </v-card-text>

    <!-- 影像設定 -->
    <v-card-actions class="px-4 pb-2">
      <v-menu offset-y>
        <template v-slot:activator="{ props: menuProps }">
          <v-btn
            text
            v-bind="menuProps"
            prepend-icon="mdi-cog"
            :disabled="!hasVideo"
          >
            Quality Settings
          </v-btn>
        </template>

        <v-list>
          <v-list-item
            v-for="quality in videoQualities"
            :key="quality.label"
            @click="changeVideoQuality(quality)"
          >
            <v-list-item-title>{{ quality.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-spacer></v-spacer>

      <v-btn
        text
        @click="$emit('refresh')"
        prepend-icon="mdi-refresh"
        :disabled="!hasVideo"
      >
        Reload
      </v-btn>
    </v-card-actions>

    <!-- People Detection Info Panel -->
    <v-card-text class="pt-0">
      <!-- Detection Info -->
      <v-alert
        type="info"
        variant="tonal"
        color="orange"
        density="compact"
        class="mb-3"
      >
        <strong
          >{{ detectedCount }}
          {{ detectedCount === 1 ? "Visitor" : "Visitors" }} Detected</strong
        >
      </v-alert>

      <!-- Detection Details -->
      <v-card color="orange-lighten-5" variant="flat" class="pa-3">
        <div class="d-flex align-center">
          <div class="text-caption text-brown-darken-1 mr-2">Status :</div>
          <v-chip
            :color="isActive ? 'green' : 'grey'"
            variant="flat"
            size="small"
            label
            rounded="xl"
          >
            <v-icon start size="x-small">
              {{ isActive ? "mdi-check-circle" : "mdi-pause-circle" }}
            </v-icon>
            {{ isActive ? "Active Monitoring" : "Standby" }}
          </v-chip>
        </div>
      </v-card>
    </v-card-text>

    <!-- Settings Dialog -->
    <v-dialog v-model="showSettings" max-width="400">
      <v-card>
        <v-card-title>Detection Settings</v-card-title>
        <v-card-text>
          <v-select
            v-model="localSensitivity"
            label="Sensitivity"
            :items="['Low', 'Medium', 'High']"
            variant="outlined"
            density="compact"
          />
          <v-select
            v-model="localRange"
            label="Detection Range"
            :items="['1m', '1.5m', '2m', '3m']"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSettings = false">Cancel</v-btn>
          <v-btn color="orange" @click="saveSettings">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from "vue";

// Props
const props = defineProps({
  stream: {
    type: MediaStream,
    default: null,
  },
  hasVideo: {
    type: Boolean,
    default: false,
  },
  detectedCount: {
    type: Number,
    default: 0,
  },
  detectionRange: {
    type: String,
    default: "1.5m",
  },
  sensitivity: {
    type: String,
    default: "Medium",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Emits
const emit = defineEmits(["refresh"]);

// Template refs
const videoElement = ref(null);

// 狀態
const videoInfo = ref(null);

// Settings state
const showSettings = ref(false);
const localSensitivity = ref(props.sensitivity);
const localRange = ref(props.detectionRange);

// 影像品質選項
const videoQualities = [
  { label: "HD (1280x720)", width: 1280, height: 720 },
  { label: "Full HD (1920x1080)", width: 1920, height: 1080 },
  { label: "4K (3840x2160)", width: 3840, height: 2160 },
];

// 監聽串流變化
watch(
  () => props.stream,
  (newStream) => {
    if (newStream && videoElement.value) {
      videoElement.value.srcObject = newStream;
    }
  },
  { immediate: true }
);

/**
 * 影像載入完成處理
 */
const onVideoLoaded = () => {
  if (videoElement.value) {
    const video = videoElement.value;
    videoInfo.value = {
      width: video.videoWidth,
      height: video.videoHeight,
      frameRate: 30, // 預設值，實際可從 track 設定取得
    };
  }
};

/**
 * 影像錯誤處理
 */
const onVideoError = (error) => {
  console.error("Video error:", error);
  videoInfo.value = null;
};

/**
 * 切換全螢幕
 */
const toggleFullscreen = async () => {
  if (!videoElement.value) return;

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await videoElement.value.requestFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen error:", error);
  }
};

/**
 * 截圖功能
 */
const captureSnapshot = () => {
  if (!videoElement.value) return;

  const canvas = document.createElement("canvas");
  const video = videoElement.value;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  // 下載截圖
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `people-detection-snapshot-${new Date().toISOString()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
};

/**
 * 改變影像品質
 */
const changeVideoQuality = async (quality) => {
  // 這裡需要與父組件的媒體管理邏輯整合
  console.log("Change video quality to:", quality);
  // TODO: 實作品質切換邏輯
  emit("refresh");
};

// Settings methods
const saveSettings = () => {
  console.log("Settings saved:", {
    sensitivity: localSensitivity.value,
    range: localRange.value,
  });
  showSettings.value = false;
};

onMounted(() => {
  // 如果已有串流，立即設定
  if (props.stream && videoElement.value) {
    videoElement.value.srcObject = props.stream;
  }
});

onUnmounted(() => {
  // 清理影像串流
  if (videoElement.value) {
    videoElement.value.srcObject = null;
  }
});

// Watch for prop changes
watch(
  () => props.sensitivity,
  (newVal) => {
    localSensitivity.value = newVal;
  }
);

watch(
  () => props.detectionRange,
  (newVal) => {
    localRange.value = newVal;
  }
);
</script>

<style scoped>
.detection-card {
  height: 100%;
  background: rgba(255, 255, 255, 0.95) !important;
}

.video-container {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 比例 */
  background: #000;
  overflow: hidden;
  border-radius: 8px;
  border: 2px solid #ffd54f;
}

.video-preview {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease;
}

.video-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 1;
}

.detection-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  padding: 8px;
}

.detection-indicator {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

.video-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.video-container:hover .video-controls {
  opacity: 1;
}

.video-control-btn {
  background: rgba(0, 0, 0, 0.6) !important;
  color: white !important;
}

.video-info {
  position: absolute;
  top: 12px;
  left: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.video-container:hover .video-info {
  opacity: 1;
}

.opacity-80 {
  opacity: 0.8;
}

.opacity-70 {
  opacity: 0.7;
}
</style>
