<template>
  <v-app>
    <AppFrame>
      <router-view></router-view>
    </AppFrame>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn text @click="snackbar.show = false"> Close </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { ref, onMounted, provide } from "vue";
import AppFrame from "./components/framework/AppFrame.vue";

const snackbar = ref({
  show: false,
  text: "",
  color: "info",
  timeout: 3000,
});

const showMessage = (text, color = "info") => {
  snackbar.value = {
    show: true,
    text,
    color,
    timeout: 3000,
  };
};

// 創建應用標題狀態並提供給子組件
const appTitle = ref("Expo");
provide("appTitle", appTitle);

// 其他現有代碼...
const sidebarCollapsed = ref(false);
provide("sidebarCollapsed", sidebarCollapsed);

onMounted(() => {
  const savedLocale = localStorage.getItem("locale");
  if (savedLocale) {
    locale.value = savedLocale;
  }
});
</script>

<style>
/* 全局樣式 */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

/* 移除所有滾動條 */
::-webkit-scrollbar {
  display: none;
}

/* 如果只想移除特定元素的滾動條，但保留滾動功能 */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
.no-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}
</style>
