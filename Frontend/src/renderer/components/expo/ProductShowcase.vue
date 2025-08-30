<template>
  <v-card
    class="product-showcase"
    color="amber-lighten-5"
    variant="outlined"
    border="dashed md"
    rounded="lg"
    height="100%"
  >
    <v-card-text class="pa-0 h-100">
      <!-- Image Carousel Section -->
      <v-carousel
        v-model="currentSlide"
        class="showcase-carousel"
        height="100%"
        cycle
        interval="4000"
        hide-delimiters
        show-arrows="hover"
      >
        <v-carousel-item
          v-for="(image, index) in images"
          :key="index"
          :src="image.src"
          cover
          class="carousel-item"
        >
          <template v-slot:placeholder>
            <div class="d-flex align-center justify-center fill-height">
              <v-progress-circular
                indeterminate
                color="orange"
              ></v-progress-circular>
            </div>
          </template>
        </v-carousel-item>
      </v-carousel>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref } from "vue";

// Import images
import EdgExpo1 from "@/assets/img/EdgExpo1.jpg";
import EdgExpo2 from "@/assets/img/EdgExpo2.jpg";
import EdgExpo3 from "@/assets/img/EdgExpo3.jpg";

// Carousel state
const currentSlide = ref(0);

// Images array
const images = ref([
  {
    src: EdgExpo1,
    alt: "EdgeExpo Product Image 1",
  },
  {
    src: EdgExpo2,
    alt: "EdgeExpo Product Image 2",
  },
  {
    src: EdgExpo3,
    alt: "EdgeExpo Product Image 3",
  },
]);
</script>

<style scoped>
.product-showcase {
  background: linear-gradient(135deg, #fffef7 0%, #fff8e1 100%) !important;
  border-color: #ffd54f !important;
  height: 100% !important;
}

.showcase-carousel {
  height: 100% !important;
  border-radius: 12px;
  overflow: hidden;
}

.carousel-item {
  height: 100% !important;
}

/* 確保圖片填滿容器 */
:deep(.v-carousel-item img) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: center !important;
}

/* 輪播指示器樣式 */
:deep(.v-carousel__controls) {
  background: rgba(0, 0, 0, 0.3) !important;
}

:deep(.v-btn--active) {
  background-color: #ff9500 !important;
}

/* 箭頭樣式 */
:deep(.v-carousel__controls__item) {
  color: rgba(255, 255, 255, 0.8) !important;
}

:deep(.v-carousel__controls__item--active) {
  color: #ff9500 !important;
}
</style>
