# OCR Model Profiling Documentation

## 概述
光學字符識別(OCR)模型在Snapdragon X Elite NPU上的性能分析工具。

## 可用腳本

### profile_ocr_models.py
**OCR模型NPU性能分析工具**

#### 功能
- 支援EasyOCR和TrOCR模型profiling
- 使用QAI Hub雲端服務
- 支援DLC和ONNX格式
- 自動生成樣本輸入數據
- 組件化分析(encoder/decoder分別測試)

#### 支援的OCR模型

##### 1. EasyOCR
- **Detector**: 文字區域檢測
- **Recognizer**: 文字內容識別

##### 2. TrOCR (Transformer-based OCR)
- **Encoder**: 影像特徵提取
- **Decoder**: 文字序列生成

#### 使用方法

##### 基本使用
```bash
# 分析所有模型和格式
python profile_ocr_models.py

# 指定模型類型
python profile_ocr_models.py --model easyocr
python profile_ocr_models.py --model trocr
python profile_ocr_models.py --model both

# 指定格式
python profile_ocr_models.py --format dlc
python profile_ocr_models.py --format onnx
python profile_ocr_models.py --format both

# 禁用樣本輸入
python profile_ocr_models.py --no-sample-inputs
```

##### 完整範例
```bash
# EasyOCR DLC格式profiling
python profile_ocr_models.py --model easyocr --format dlc

# TrOCR ONNX格式profiling
python profile_ocr_models.py --model trocr --format onnx
```

## 模型檔案結構

### EasyOCR檔案
```
easyocr/
├── easyocr-easyocrdetector.dlc                    # DLC格式檢測器
├── easyocr-easyocrrecognizer.dlc                  # DLC格式識別器
└── easyocr-easyocrrecognizer.onnx/               # ONNX格式識別器
    └── model.onnx/
        ├── model.onnx
        └── model.data
```

### TrOCR檔案
```
trocr/
├── trocr-trocrencoder.dlc                         # DLC格式編碼器
├── trocr-trocrdecoder.dlc                         # DLC格式解碼器
├── trocr-trocrencoder.onnx/                      # ONNX格式編碼器
│   └── model.onnx/
│       ├── model.onnx
│       └── model.data
└── trocr-trocrdecoder.onnx/                      # ONNX格式解碼器
    └── model.onnx/
        ├── model.onnx
        └── model.data
```

## 輸入數據配置

### EasyOCR輸入
```python
# Detector輸入 (完整影像)
detector_input = {
    "image": np.random.rand(1, 3, 640, 640).astype(np.float32)
}

# Recognizer輸入 (文字區域)
recognizer_input = {
    "image": np.random.rand(1, 3, 32, 128).astype(np.float32)
}
```

### TrOCR輸入
```python
# Encoder輸入 (影像patch)
encoder_input = {
    "pixel_values": np.random.rand(1, 3, 384, 384).astype(np.float32)
}

# Decoder輸入 (編碼特徵 + token)
decoder_input = {
    "encoder_hidden_states": np.random.rand(1, 577, 768).astype(np.float32),
    "decoder_input_ids": np.array([[0]], dtype=np.int64)
}
```

## 性能指標

### 主要測量指標
- **推理時間**: 模型前向傳播耗時(ms)
- **記憶體使用**: 峰值記憶體占用(MB)
- **組件性能**: 各組件獨立性能表現
- **端到端性能**: 完整OCR流程性能

### 輸出範例
```
[DETECTOR] Profiling easyocr-easyocrdetector.dlc
    Component: detector
    ✅ Profile downloaded successfully
    
    Performance Metrics for detector:
    - Inference Time: 15.234 ms
    - Peak Memory: 45.67 MB
    - Throughput: 65.65 inferences/sec

[RECOGNIZER] Profiling easyocr-easyocrrecognizer.dlc
    Component: recognizer
    ✅ Profile downloaded successfully
    
    Performance Metrics for recognizer:
    - Inference Time: 8.912 ms
    - Peak Memory: 23.45 MB
    - Throughput: 112.21 inferences/sec
```

## OCR工作流程

### EasyOCR流程
```
1. 影像輸入 → 
2. Detector (文字檢測) → 
3. 文字區域擷取 → 
4. Recognizer (文字識別) → 
5. 文字輸出
```

### TrOCR流程
```
1. 影像輸入 → 
2. Encoder (特徵提取) → 
3. Decoder (序列生成) → 
4. 文字輸出
```

## 性能最佳化

### NPU最佳化策略
1. **DLC格式優先**: DLC格式針對NPU優化
2. **批次處理**: 合適的批次大小設定
3. **影像尺寸**: 標準化輸入影像尺寸
4. **記憶體管理**: 避免記憶體峰值

### 模型選擇建議
- **EasyOCR**: 適合多語言文字識別
- **TrOCR**: 適合複雜文檔結構
- **格式選擇**: DLC > ONNX (NPU性能)

## 應用場景

### 實際使用案例
1. **文檔數字化**: 掃描文檔轉換
2. **名片識別**: 商務名片資訊提取
3. **表單處理**: 自動表單填寫
4. **多語言文字**: 國際化文字識別

### 性能需求
- **即時處理**: < 50ms per image
- **批量處理**: > 20 images/sec
- **記憶體限制**: < 100MB peak usage

## 故障排除

### 常見問題

1. **模型檔案未找到**
   ```bash
   錯誤: Model files are missing
   解決: 檢查檔案路徑和下載完整性
   ```

2. **QAI Hub連接失敗**
   ```bash
   錯誤: QAI Hub connection failed
   解決: 檢查網路連接和帳戶認證
   ```

3. **記憶體不足**
   ```bash
   錯誤: Out of memory
   解決: 減小輸入影像尺寸或使用量化模型
   ```

### 除錯建議
1. **檢查檔案完整性**: 確認所有模型檔案存在
2. **驗證輸入格式**: 確認輸入數據格式正確
3. **監控資源使用**: 追踪CPU、GPU、NPU使用情況
4. **段落式測試**: 分別測試各組件性能