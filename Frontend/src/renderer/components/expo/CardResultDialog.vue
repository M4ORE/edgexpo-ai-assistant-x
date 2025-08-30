<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="600"
    persistent
    scrollable
  >
    <v-card class="result-dialog">
      <!-- Modal Header -->
      <v-card-title class="result-header">
        <v-row align="center" justify="space-between" no-gutters>
          <v-col>
            <div class="result-title">
              <v-icon
                icon="mdi-check-circle"
                class="mr-2"
                color="green"
              />
              Card Saved Successfully
              <v-chip
                size="small"
                color="success"
                variant="flat"
                prepend-icon="mdi-database-check"
                class="ml-2"
              >
                Auto-saved to CRM
              </v-chip>
            </div>
          </v-col>
          <v-col cols="auto">
            <div class="countdown-container">
              <v-progress-circular
                :model-value="countdownProgress"
                :size="32"
                :width="3"
                color="orange"
                class="mr-2"
              >
                <span class="countdown-text">{{ countdown }}</span>
              </v-progress-circular>
            </div>
          </v-col>
        </v-row>
      </v-card-title>

      <!-- Main Content -->
      <v-card-text class="pa-4">
        <v-row>
          <!-- OCR Results as List -->
          <v-col cols="12">
            <v-card
              color="green-lighten-5"
              variant="flat"
              class="ocr-result-card"
            >
              <v-card-title class="pb-2">
                <v-icon icon="mdi-text-recognition" class="mr-2" />
                Extracted Information
              </v-card-title>
              <v-card-text>
                <v-list class="bg-transparent">
                  <v-list-item
                    v-if="localCardData.name"
                    prepend-icon="mdi-account"
                    :title="localCardData.name"
                    subtitle="Name"
                  />
                  <v-list-item
                    v-if="localCardData.position"
                    prepend-icon="mdi-briefcase"
                    :title="localCardData.position"
                    subtitle="Position"
                  />
                  <v-list-item
                    v-if="localCardData.company"
                    prepend-icon="mdi-domain"
                    :title="localCardData.company"
                    subtitle="Company"
                  />
                  <v-list-item
                    v-if="localCardData.phone"
                    prepend-icon="mdi-phone"
                    :title="localCardData.phone"
                    subtitle="Phone"
                  />
                  <v-list-item
                    v-if="localCardData.email"
                    prepend-icon="mdi-email"
                    :title="localCardData.email"
                    subtitle="Email"
                  >
                    <template v-slot:append>
                      <v-chip
                        size="small"
                        color="info"
                        variant="tonal"
                        prepend-icon="mdi-send"
                      >
                        Catalog Sent
                      </v-chip>
                    </template>
                  </v-list-item>
                  <v-list-item
                    v-if="localCardData.address"
                    prepend-icon="mdi-map-marker"
                    :title="localCardData.address"
                    subtitle="Address"
                  />
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>

      <!-- Status Message -->
      <v-card-actions class="result-actions">
        <v-row align="center" justify="center" no-gutters>
          <v-col class="text-center">
            <div class="success-message">
              <v-icon color="green" size="large" class="mb-2">
                mdi-check-circle
              </v-icon>
              <div class="text-h6 text-green-darken-2 mb-2">
                Business Card Processed Successfully
              </div>
              <div class="text-body-2 text-grey-darken-1">
                Data saved to CRM and catalog sent automatically.
                <br>
                This dialog will close in {{ countdown }} seconds.
              </div>
            </div>
          </v-col>
        </v-row>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from "vue";

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  cardData: {
    type: Object,
    default: () => ({}),
  },
  isProcessing: {
    type: Boolean,
    default: false,
  },
  capturedImage: {
    type: String,
    default: "",
  },
});

// Emits
const emit = defineEmits(["update:modelValue", "close"]);

// Local state
const localCardData = reactive({
  name: "",
  company: "",
  position: "",
  phone: "",
  email: "",
  address: "",
});

const countdown = ref(5);
const countdownProgress = ref(100);
const countdownInterval = ref(null);

// Methods
const startCountdown = () => {
  countdown.value = 5;
  countdownProgress.value = 100;
  
  countdownInterval.value = setInterval(() => {
    countdown.value--;
    countdownProgress.value = (countdown.value / 5) * 100;
    
    if (countdown.value <= 0) {
      clearInterval(countdownInterval.value);
      emit('close');
    }
  }, 1000);
};

const stopCountdown = () => {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value);
    countdownInterval.value = null;
  }
};

const handleConfirm = () => {
  stopCountdown();
  emit('close');
};

// Watch for card data changes
watch(
  () => props.cardData,
  (newData) => {
    Object.assign(localCardData, newData);
    // 不再需要追蹤修改狀態
  },
  { immediate: true, deep: true }
);

// Watch for dialog open/close
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      startCountdown();
    } else {
      stopCountdown();
    }
  }
);

// Lifecycle
onMounted(() => {
  if (props.modelValue) {
    startCountdown();
  }
});

onUnmounted(() => {
  stopCountdown();
});
</script>

<style scoped>
.result-dialog {
  background: white !important;
  border-radius: 12px !important;
  overflow: hidden;
}

.result-header {
  background: linear-gradient(135deg, #fff7e6 0%, #ffeaa7 100%) !important;
  border-bottom: 2px solid #ffd54f !important;
  padding: 20px 24px !important;
}

.result-title {
  font-size: 18px;
  font-weight: bold;
  color: #8b4513;
  display: flex;
  align-items: center;
}

.image-preview-card {
  background: linear-gradient(135deg, #fffef7 0%, #fff8e1 100%) !important;
  border-color: #ffd54f !important;
}

.captured-image {
  border-radius: 8px;
  border: 2px solid #ffd54f;
}

.ocr-result-card {
  background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%) !important;
  border-left: 4px solid #4caf50;
}

.countdown-container {
  display: flex;
  align-items: center;
}

.countdown-text {
  font-size: 12px;
  font-weight: bold;
  color: #ff9800;
}

.success-message {
  padding: 20px;
}

.result-actions {
  background: white !important;
  border-top: 1px solid #e0e0e0 !important;
  padding: 16px 24px !important;
}
</style>