# Whisper Speech-to-Text Service

A high-performance offline speech recognition API service based on Qualcomm AI Hub optimized Whisper Large V3 Turbo model.

## Features

- **High-Performance Speech Recognition**: Uses Qualcomm QNN optimized Whisper Large V3 Turbo model
- **Multi-Language Support**: Automatic language detection, supports Chinese, English and multiple languages
- **REST API Interface**: Provides simple and easy-to-use HTTP API
- **Audio Format Conversion**: Automatically handles M4A, MP3, WAV and other formats
- **Request Queue Management**: Supports concurrent request queue processing
- **UTF-8 Encoding Support**: Complete Chinese character support

## Directory Structure

```
service-stt/
├── build/                          # Model files directory
│   └── whisper-large-v3-turbo/
│       ├── HfWhisperEncoder/
│       │   └── model.onnx         # Encoder model
│       └── HfWhisperDecoder/
│           └── model.onnx         # Decoder model
├── ffmpeg/                         # FFmpeg executable directory
│   └── bin/
│       └── ffmpeg.exe             # Windows FFmpeg executable
├── whisper_api_server.py          # Main API service program
├── test_api_client.py             # API test client
├── requirements.txt               # Python dependencies
├── run_stt_service.bat            # Windows startup script
├── API_DOCUMENTATION.md          # Detailed API documentation
└── README.md                      # This documentation
```

## API Documentation

### 1. Health Check
- **Endpoint**: `GET /health`
- **Description**: Check service status and model loading status
- **Response Example**:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "queue_size": 0,
  "timestamp": "2025-01-01 12:00:00.000000+08:00"
}
```

### 2. Speech-to-Text
- **Endpoint**: `POST /transcribe`
- **Parameters**:
  - `audio`: Audio file (required, form-data)
  - `language`: Language code (optional, e.g. "zh", "en")
- **Response Example**:
```json
{
  "success": true,
  "transcription": "Recognized text content",
  "language": "zh",
  "request_id": "abc12345"
}
```

### 3. Processing Status
- **Endpoint**: `GET /status`
- **Description**: Query current processing status and queue size
- **Response Example**:
```json
{
  "is_processing": false,
  "queue_size": 0,
  "model_loaded": true,
  "timestamp": "2025-01-01 12:00:00.000000+08:00"  
}
```

## Installation

### 1. Download Model Files

1. Go to [Qualcomm AI Hub - Whisper Large V3 Turbo](https://aihub.qualcomm.com/models/whisper_large_v3_turbo)
2. Download the following two ONNX model files:
   - `HfWhisperEncoder.onnx`
   - `HfWhisperDecoder.onnx`
3. Create directory structure and place models:
```bash
# Create directories
mkdir -p build/whisper-large-v3-turbo/HfWhisperEncoder
mkdir -p build/whisper-large-v3-turbo/HfWhisperDecoder

# Rename and place downloaded models to corresponding directories
# HfWhisperEncoder.onnx → build/whisper-large-v3-turbo/HfWhisperEncoder/model.onnx
# HfWhisperDecoder.onnx → build/whisper-large-v3-turbo/HfWhisperDecoder/model.onnx
```

### 2. Download FFmpeg

1. Go to [FFmpeg Official Website](https://ffmpeg.org/download.html)
2. Download Windows pre-compiled executable (choose "Windows builds by BtbN")
3. After extraction, place `ffmpeg.exe` at:
```
service-stt/ffmpeg/bin/ffmpeg.exe
```

### 3. Install Python Dependencies

**Important**: Must install in the following order to avoid onnxruntime version conflicts

```bash
# Create virtual environment
python -m venv venv-stt

# Activate virtual environment (Windows)
venv-stt\Scripts\activate

# Install qai_hub_models (includes whisper dependencies)
venv-stt\Scripts\python.exe -m pip install "qai_hub_models[whisper-base]==0.36"

# Remove conflicting onnxruntime versions
venv-stt\Scripts\python.exe -m pip uninstall --yes onnxruntime onnxruntime-qnn

# Install correct onnxruntime-qnn version
venv-stt\Scripts\python.exe -m pip install onnxruntime-qnn==1.22.0

# Install other dependencies
venv-stt\Scripts\python.exe -m pip install -r requirements.txt
```

## Usage

### Starting the Service

#### Windows
```bash
# Use batch file to start
run_stt_service.bat

# Or start manually
python whisper_api_server.py
```

#### Linux/Mac
```bash
python whisper_api_server.py
```

The service will start at `http://127.0.0.1:5003`

### Testing the API

#### Using Test Client
```bash
python test_api_client.py
```

#### Using curl
```bash
# Health check
curl http://127.0.0.1:5003/health

# Speech-to-text
curl -X POST -F "audio=@your_audio.m4a" http://127.0.0.1:5003/transcribe

# Specify language
curl -X POST -F "audio=@your_audio.m4a" -F "language=zh" http://127.0.0.1:5003/transcribe
```

#### Using Python
```python
import requests

# Speech-to-text
with open('audio.m4a', 'rb') as f:
    files = {'audio': f}
    response = requests.post('http://127.0.0.1:5003/transcribe', files=files)
    print(response.json())
```

## System Requirements

- Python 3.8 or above
- Windows 10/11 (supports Qualcomm NPU)
- At least 4GB RAM
- Approximately 3GB disk space (model files)

## Performance Notes

- First model loading takes about 10-30 seconds
- Transcription speed depends on audio length and hardware configuration
- Supports GPU/NPU acceleration (if supported hardware is available)

## Important Notes

1. **Model Files**: Ensure model files are correctly placed in the `build` directory structure
2. **FFmpeg**: Audio format conversion requires FFmpeg, please ensure it's correctly installed
3. **Encoding Issues**: UTF-8 encoding handling is included for Windows environment
4. **Concurrency Limitation**: Only processes one request at a time, other requests will queue

## Troubleshooting

### Model Loading Failed
- Check if model files exist in the correct path
- Confirm file name is `model.onnx`

### Audio Conversion Failed
- Confirm FFmpeg is correctly installed in the `ffmpeg/bin/` directory
- Check if audio file format is supported

### Chinese Character Encoding Issues
- Use the provided `run_stt_service.bat` to start in Windows environment
- Ensure terminal supports UTF-8 encoding

## License

This project uses Whisper model, please comply with relevant license terms.

## References

- [Qualcomm AI Hub Models](https://github.com/quic/ai-hub-models/tree/main/qai_hub_models/models/whisper_large_v3_turbo)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [FFmpeg](https://ffmpeg.org/)