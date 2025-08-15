# edgexpo-ai-assistant-x
EdgExpo AI public/OpenSource Version

## 痛點描述

在國際展覽與商務活動中，參展商常面臨：

- 人手不足，無法同時服務多組訪客
- 跨國溝通障礙，需即時中英文甚至多語切換
- 名片與後續聯絡管理耗時、容易遺漏

這導致參展效率低、潛在商機流失。

## 場景

- **語音互動流程**：訪客語音輸入 → Edge ASR（Qualcomm AI Hub 模型） → 語言識別 & 翻譯(LLM) → 知識庫檢索（展品資料） → Edge TTS 回應
- **名片處理流程**：名片圖像輸入 → Edge OCR（開源或 Qualcomm AI Hub 模型） → 資料結構化 → 本地 CRM/CSV 儲存

### 技術架構
- **語音處理**：Whisper → Snapdragon NPU with ONNX Runtime + QNN
- **文字識別**：EasyOCR/TrOCR → Snapdragon NPU with ONNX Runtime + QNN  
- **大語言模型**：llama.cpp/ollama → Snapdragon CPU/GPU with OpenCL
- **推理後端**：ONNX Runtime + QNN/DirectML → Snapdragon NPU

## 環境安裝步驟

### 1. Python 3.12 安裝 (Windows)

建議從 Microsoft Store 安裝 Python 3.12，以獲得最佳的 Windows 整合體驗：

1. 開啟 **Microsoft Store**
2. 搜尋 **Python 3.12**
3. 點擊 **取得** 安裝
4. 驗證安裝：
   ```powershell
   python --version
   # 應顯示: Python 3.12.x
   ```

### 2. 建立虛擬環境

使用 Python 內建的 venv 模組建立獨立的開發環境：

```powershell
# 在專案根目錄建立虛擬環境
python -m venv venv

# 啟動虛擬環境
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows Command Prompt:
venv\Scripts\activate.bat

# 確認虛擬環境已啟動（提示符號會顯示 (venv)）
(venv) C:\Users\paste\Documents\Github\edgexpo-ai-assistant-x>
```

### 3. Qualcomm AI Engine Direct (QNN SDK) 安裝

#### 3.1 下載與安裝 QAIRT

1. 前往 [Qualcomm AI Engine Direct](https://www.qualcomm.com/developer/software/neural-processing-sdk-for-ai) 下載頁面
2. 註冊/登入 Qualcomm 開發者帳號
3. 下載適用於 Windows 的 QAIRT SDK (版本 2.37.1 或更新)
4. 執行安裝程式，預設安裝路徑：
   ```
   C:\Qualcomm\AIStack\QAIRT\2.37.1.250807\
   ```

#### 3.2 設定環境變數

參考 [Windows Setup Guide](https://docs.qualcomm.com/bundle/publicresource/topics/80-63442-50/windows_setup.html) 設定以下環境變數：

**方法一：使用 PowerShell (臨時設定)**
```powershell
# 設定 QAIRT_SDK_ROOT
$env:QAIRT_SDK_ROOT = "C:\Qualcomm\AIStack\QAIRT\2.37.1.250807"

# 設定 QNN_SDK_ROOT (相同路徑)
$env:QNN_SDK_ROOT = "C:\Qualcomm\AIStack\QAIRT\2.37.1.250807"

# 添加必要的 DLL 路徑到 PATH
$env:PATH = "$env:QAIRT_SDK_ROOT\lib\arm64x-windows-msvc;$env:PATH"
$env:PATH = "$env:QAIRT_SDK_ROOT\bin\x86_64-windows-msvc;$env:PATH"
```

**方法二：永久設定 (系統環境變數)**
1. 開啟 **系統內容** → **進階系統設定** → **環境變數**
2. 在 **系統變數** 中新增：
   - 變數名稱：`QAIRT_SDK_ROOT`
   - 變數值：`C:\Qualcomm\AIStack\QAIRT\2.37.1.250807`
3. 同樣新增 `QNN_SDK_ROOT` 變數（相同值）
4. 編輯 `PATH` 變數，新增以下路徑：
   - `%QAIRT_SDK_ROOT%\lib\arm64x-windows-msvc`
   - `%QAIRT_SDK_ROOT%\bin\x86_64-windows-msvc`

#### 3.3 驗證安裝

```powershell
# 檢查環境變數
echo $env:QAIRT_SDK_ROOT

# 檢查 QNN 工具是否可用
qnn-net-run --version

# 列出支援的後端
qnn-platform-validator --list-backends
```

### 4. 安裝 Python 套件

在虛擬環境中安裝必要的套件：

```powershell
# 確保虛擬環境已啟動
(venv) > pip install --upgrade pip

# 安裝專案依賴
(venv) > pip install -r requirements.txt

# 或手動安裝核心套件
(venv) > pip install onnxruntime-qnn qai-hub numpy psutil
```

### 5. 驗證完整環境

執行以下 Python 腳本驗證環境設定：

```python
import os
import sys
import onnxruntime as ort

# 檢查 Python 版本
print(f"Python 版本: {sys.version}")

# 檢查 QAIRT 環境變數
qairt_root = os.environ.get('QAIRT_SDK_ROOT')
print(f"QAIRT_SDK_ROOT: {qairt_root}")

# 檢查 ONNX Runtime QNN Provider
providers = ort.get_available_providers()
if 'QNNExecutionProvider' in providers:
    print("✓ QNN Provider 可用")
else:
    print("✗ QNN Provider 不可用，請檢查 QAIRT 安裝")

print(f"可用的 Providers: {providers}")
```

### 故障排除

#### 常見問題

1. **PowerShell 執行政策錯誤**
   ```powershell
   # 如果無法執行 Activate.ps1
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **QNN Provider 不可用**
   - 確認 Snapdragon X Elite 處理器
   - 檢查 QAIRT SDK 安裝路徑
   - 確認環境變數正確設定
   - 重新啟動終端機或電腦

3. **DLL 載入錯誤**
   - 確保 ARM64X 庫路徑在 PATH 最前面
   - 檢查是否安裝了 Visual C++ Redistributable

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
