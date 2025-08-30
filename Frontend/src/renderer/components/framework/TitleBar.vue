<template>
  <div class="title-bar">
    <div class="logo-area">
      <!-- EdgeExpo AI Assistant X Logo and Title -->
      <v-img
        src="/src/assets/logo.png"
        class="mr-2"
        width="180"
        height="auto"
      ></v-img>
      <span class="app-title ml-4">EdgeExpo AI Assistant X</span>

      <!-- System Status Indicators -->
      <div class="status-indicators ml-6">
        <v-chip
          color="orange-lighten-4"
          variant="flat"
          size="small"
          prepend-icon="mdi-circle"
          class="mr-2"
        >
          <template v-slot:prepend>
            <v-icon color="orange-darken-1" size="10" class="pulse-animation" />
          </template>
          System Running
        </v-chip>

        <v-chip color="orange-lighten-4" variant="flat" size="small">
          Auto Mode
        </v-chip>
      </div>
    </div>

    <div class="window-controls">
      <v-btn
        icon
        size="small"
        @click="minimize"
        class="control-btn"
        variant="text"
      >
        <v-icon>mdi-window-minimize</v-icon>
      </v-btn>

      <v-btn
        icon
        size="small"
        @click="maximize"
        class="control-btn"
        variant="text"
      >
        <v-icon>{{
          isMaximized ? "mdi-window-restore" : "mdi-window-maximize"
        }}</v-icon>
      </v-btn>

      <v-btn
        icon
        size="small"
        @click="close"
        class="control-btn close-btn"
        variant="text"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const isMaximized = ref(false);

const minimize = () => {
  window.electron?.windowControls?.minimize();
};

const maximize = () => {
  window.electron?.windowControls?.maximize();
  isMaximized.value = !isMaximized.value;
};

const close = () => {
  window.electron?.windowControls?.close();
};
</script>

<style scoped>
.title-bar {
  -webkit-app-region: drag;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px 0 10px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.08);
  height: 56px;
  width: 100%;
  overflow: hidden;
}

.logo-area {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 8px;
}

.app-title {
  font-weight: bold;
  font-size: 20px;
  color: #8b4513;
}

.status-indicators {
  display: flex;
  align-items: center;
  gap: 12px;
  -webkit-app-region: no-drag;
}

:deep(.v-chip) {
  background: rgba(255, 234, 167, 0.5) !important;
  color: #8b4513 !important;
  font-size: 12px !important;
  height: 26px !important;
}

.window-controls {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 4px;
}

.control-btn {
  border-radius: 4px;
}

.control-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.close-btn:hover {
  background-color: #e81123;
  color: white;
}

.close-btn:hover :deep(.v-icon) {
  color: white;
}

/* Pulse animation for system status */
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
  animation: pulse 2s infinite;
}
</style>
