# edgexpo-ai-assistant-x
EdgExpo AI public/OpenSource Version

## Profiling 工具

本專案包含針對 Snapdragon X Elite NPU 優化的深度學習模型性能分析工具集。

### 支援模型
- **Whisper**: 語音識別模型 (tiny-en版本)
- **OCR**: 文字識別模型 (EasyOCR, TrOCR)

### 快速開始

```bash
# 進入profiling目錄
cd profiling/

# 安裝依賴
pip install -r requirements.txt

# 執行Whisper profiling (雲端)
python whisper/profile_whisper_npu.py

# 執行OCR profiling
python ocr/profile_ocr_models.py
```

### 主要功能
- NPU硬體加速性能分析
- 模型推理時間測量
- 記憶體使用追蹤
- QAI Hub雲端profiling支援
- 支援DLC和ONNX格式

### 環境需求
- Snapdragon X Elite處理器
- QAIRT 2.37.1.250807 或更新版本
- Python 3.8+
- onnxruntime-qnn

詳細使用說明請參考 [profiling/readme.md](profiling/readme.md)
