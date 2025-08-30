<template>
  <div class="app-frame">
    <div class="app-content">
      <div class="main-container">
        <TitleBar />
        <div class="main-content no-scrollbar">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from "vue";
import TitleBar from "./TitleBar.vue";

// 創建一個共享的側邊欄狀態
const sidebarCollapsed = ref(false);
provide("sidebarCollapsed", sidebarCollapsed);
</script>
<style scoped>
.app-frame {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08),
    0 9px 28px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
}

.app-content {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  padding: 0;
  background-color: #f9f9f9;
}
</style>
