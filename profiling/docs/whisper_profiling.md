# Whisper Model Profiling Documentation

## 概述
Whisper模型性能分析工具集，支援多種推理方法和環境配置。

## 可用腳本

### 1. profile_whisper_npu.py
**雲端NPU性能分析 (QAI Hub)**

#### 功能
- 使用Qualcomm AI Hub雲端服務進行NPU性能分析
- 支援Whisper Encoder和Decoder分別分析
- 提供詳細的性能指標和記憶體使用情況
- 支援自定義輸入數據測試

#### 使用方法
```bash
python profile_whisper_npu.py
```

#### 環境需求
- qai_hub套件
- 有效的QAI Hub帳戶
- 網路連接

#### 輸出結果
- 推理時間(ms)
- 吞吐量(inferences/sec)
- 記憶體使用量(MB)
- 詳細性能報告下載至對應資料夾

---

### 2. profile_whisper_local.py
**本地NPU性能分析 (ONNX Runtime + QNN)**

#### 功能
- 本地Snapdragon X Elite NPU性能測試
- 支援ONNX Runtime + QNN執行提供者
- 支援SNPE SDK直接調用
- 支援Phi-3.5模型profiling
- 命令行參數控制

#### 使用方法
```bash
# 基本Whisper模型分析
python profile_whisper_local.py

# 指定模型和方法
python profile_whisper_local.py --model whisper --method onnx
python profile_whisper_local.py --model phi35 --method onnx
```

#### 環境需求
- ONNX Runtime QNN
- QAIRT 2.37.1.250807
- Snapdragon X Elite設備

#### 配置要求
- QNN_SDK_ROOT環境變數
- ARM64X庫路徑設定
- QnnHtp.dll後端可用

---

### 3. profile_snpe_simple.py
**SNPE SDK性能分析**

#### 功能
- 直接使用SNPE SDK進行模型分析
- 命令行工具snpe-net-run調用
- 支援DLC格式模型
- 詳細的NPU/DSP性能指標

#### 使用方法
```bash
python profile_snpe_simple.py
```

#### 環境需求
- SNPE SDK
- SNPE_ROOT環境變數
- snpe-net-run工具可用

---

### 4. profile_onnx_local.py
**ONNX本地性能分析**

#### 功能
- 純ONNX Runtime本地推理測試
- 支援CPU和GPU後端
- 適用於對比測試

#### 使用方法
```bash
python profile_onnx_local.py
```

## 模型檔案需求

### Whisper模型檔案
```
whisper_tiny_en-whisperencoderinf.dlc          # DLC格式編碼器
whisper_tiny_en-whisperdecoderinf.dlc          # DLC格式解碼器
whisper_tiny_en-whisperencoderinf.onnx/        # ONNX格式編碼器
whisper_tiny_en-whisperdecoderinf.onnx/        # ONNX格式解碼器
```

## 性能指標說明

### 關鍵指標
- **推理時間**: 單次模型推理所需時間(毫秒)
- **吞吐量**: 每秒可處理的推理次數
- **記憶體使用**: 峰值記憶體占用量(MB)
- **NPU利用率**: NPU資源使用效率

### 最佳化建議
1. **使用ARM64X庫**: 確保最佳NPU性能
2. **DLC格式**: DLC格式比ONNX格式NPU優化更好
3. **批次大小**: NPU通常batch_size=1效果最佳
4. **預熱運行**: 進行3-5次預熱運行再測量性能

## 故障排除

### 常見問題
1. **QNN Provider不可用**
   - 檢查QAIRT安裝
   - 確認環境變數設定
   - 驗證ARM64X庫路徑

2. **DLC檔案未找到**
   - 確認工作目錄
   - 檢查檔案路徑
   - 重新下載或轉換模型

3. **記憶體不足**
   - 減小輸入尺寸
   - 使用INT8量化
   - 關閉其他應用程式