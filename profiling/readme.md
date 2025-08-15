# NPU Model Profiling 工具集

## 概述

本工具集提供了在Snapdragon X Elite NPU上進行深度學習模型性能分析的完整解決方案。支援Whisper和OCR模型的專業化profiling。

## 目錄結構

```
profiling/
├── README.md                    # 本文件 - 操作手冊
├── requirements.txt             # Python套件依賴清單
├── docs/                        # 詳細文檔
│   ├── whisper_profiling.md     # Whisper模型profiling說明
│   └── ocr_profiling.md         # OCR模型profiling說明
├── whisper/                     # Whisper相關腳本
│   └── profile_whisper_npu.py   # QAI Hub雲端profiling
├── ocr/                         # OCR相關腳本
│   └── profile_ocr_models.py    # OCR模型profiling
└── venv/                        # 虛擬環境目錄 (自動生成，不納入版控)
```

## 快速開始

### 1. 環境準備

#### 使用虛擬環境 (推薦)
```bash
# 建立虛擬環境
python -m venv venv

# 啟動虛擬環境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安裝所有依賴套件
pip install -r requirements.txt

# 或者只安裝核心套件
pip install onnxruntime-qnn qai-hub numpy psutil
```

#### 必需軟體
```bash
# QAIRT安裝
C:\Qualcomm\AIStack\QAIRT\2.37.1.250807\
```

#### 環境變數設定
```bash
set QNN_SDK_ROOT=C:\Qualcomm\AIStack\QAIRT\2.37.1.250807
set PATH=%PATH%;C:\Qualcomm\AIStack\QAIRT\2.37.1.250807\lib\arm64x-windows-msvc
set PATH=%PATH%;C:\Qualcomm\AIStack\QAIRT\2.37.1.250807\bin\x86_64-windows-msvc
```

### 2. 模型準備

#### Whisper模型檔案
```
whisper_tiny_en-whisperencoderinf.dlc
whisper_tiny_en-whisperdecoderinf.dlc
whisper_tiny_en-whisperencoderinf.onnx/
whisper_tiny_en-whisperdecoderinf.onnx/
```

#### OCR模型檔案
```
easyocr/easyocr-easyocrdetector.dlc
easyocr/easyocr-easyocrrecognizer.dlc
trocr/trocr-trocrencoder.dlc
trocr/trocr-trocrdecoder.dlc
```

## 使用指南

### Whisper模型Profiling (純雲端)

```bash
cd profiling/whisper
python profile_whisper_npu.py
```

此工具專注於使用 QAI Hub 進行雲端 profiling，無需本地 NPU 設置。

### OCR模型Profiling

#### 全套OCR分析
```bash
cd profiling/ocr
python profile_ocr_models.py

# 指定模型
python profile_ocr_models.py --model easyocr
python profile_ocr_models.py --model trocr

# 指定格式
python profile_ocr_models.py --format dlc
python profile_ocr_models.py --format onnx
```

## 故障排除

### 常見問題與解決方案

#### 1. 環境配置問題
```bash
# QNN Provider不可用
錯誤: QNNExecutionProvider not available
解決: 檢查QAIRT安裝和環境變數

# ARM64X庫問題
錯誤: Cannot load QnnHtp.dll
解決: 確認ARM64X庫路徑在PATH最前面
```

#### 2. 模型檔案問題
```bash
# 模型檔案未找到
錯誤: Model file not found
解決: 檢查工作目錄和檔案路徑

# DLC檔案損壞
錯誤: Invalid DLC format
解決: 重新轉換ONNX到DLC格式
```

#### 3. 性能問題
```bash
# NPU未使用
現象: 性能過慢
檢查: 確認在profiling輸出中看到"QnnHtp.dll"

# 記憶體不足
現象: Out of memory
解決: 減小輸入尺寸或使用量化模型
```

## 參考資源

### 官方文檔
- [QAIRT Developer Guide](https://docs.qualcomm.com/bundle/publicresource/topics/80-63442-50/introduction.html)
- [ONNX Runtime QNN Provider](https://onnxruntime.ai/docs/execution-providers/QNN-ExecutionProvider.html)
- [QAI Hub Documentation](https://app.qai-hub.com/docs/)

### 模型來源
- [Whisper Models](https://github.com/openai/whisper)
- [OCR Models](https://github.com/JaidedAI/EasyOCR)

## 支援與回饋

如有問題或建議，請參考：
1. 各模型的詳細文檔(`docs/`目錄)
2. 腳本內的註釋和錯誤訊息
3. QAIRT和ONNX Runtime官方文檔

---

**版本**: 1.0  
**更新日期**: 2025-08-15  
**適用平台**: Snapdragon X Elite with QAIRT 2.37.1.250807