# Edge-TTS Service API

A Text-to-Speech (TTS) service based on Microsoft Edge, providing RESTful API endpoints with support for multiple languages and output formats.

## Features

- Multi-language text-to-speech support (Chinese, English, Traditional Chinese)
- Multiple output formats (file download, streaming, URL link)
- Custom voice selection
- Automatic cleanup of expired temporary files
- Comprehensive error handling and logging
- CORS support for cross-origin requests

## Directory Structure

```
service-tts/
├── app.py                  # Main application file, Flask API service
├── requirements.txt        # Python package dependencies
├── run_tts_service.bat    # Windows startup script
├── audio_output/          # Audio output directory
└── temp_audio/            # Temporary audio files directory (auto-created)
```

## API Documentation

### 1. Health Check
- **Endpoint**: `GET /health`
- **Description**: Check service status
- **Response Example**:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "supported_languages": ["en", "zh", "zh-tw", "zh-cn"],
  "timestamp": 1693388400.123
}
```

### 2. Text-to-Speech
- **Endpoint**: `POST /tts`
- **Description**: Convert text to speech
- **Request Example**:
```json
{
  "text": "Hello, World!",
  "lang": "en",
  "format": "file",
  "voice_id": "en-US-AriaNeural"
}
```
- **Parameters**:
  - `text` (required): Text to convert (max 5000 characters)
  - `lang` (optional): Language code, default "en"
    - `en`: English
    - `zh` / `zh-cn`: Simplified Chinese
    - `zh-tw`: Traditional Chinese
  - `format` (optional): Output format, default "file"
    - `file`: Direct file download
    - `stream`: Streaming output
    - `link`: Return download link
  - `voice_id` (optional): Specify voice character

### 3. Get Supported Languages
- **Endpoint**: `GET /languages`
- **Description**: Get list of all supported languages
- **Response Example**:
```json
{
  "supported_languages": ["en", "zh", "zh-tw", "zh-cn"],
  "total_count": 4
}
```

### 4. Get Available Voices
- **Endpoint**: `GET /voices`
- **Description**: Get available voice characters for each language
- **Response Example**:
```json
{
  "voices": {
    "en": ["en-US-AriaNeural", "en-US-GuyNeural", "en-US-JennyNeural"],
    "zh": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-CN-YunjianNeural"]
  },
  "total_count": 12
}
```

### 5. Download File
- **Endpoint**: `GET /download/<file_id>`
- **Description**: Download temporarily generated audio file
- **Parameter**: `file_id` - File ID returned by `/tts` endpoint

### 6. Cleanup Temporary Files
- **Endpoint**: `POST /cleanup`
- **Description**: Manually trigger cleanup of expired temporary files
- **Response Example**:
```json
{
  "status": "success",
  "cleaned_files": 5,
  "timestamp": 1693388400.123
}
```

## Installation

### System Requirements
- Python 3.8 or higher
- Windows / Linux / macOS

### Installation Steps

1. Clone the project locally:
```bash
git clone <repository-url>
cd Backend/service-tts
```

2. Create virtual environment (recommended):
```bash
# Windows
python -m venv venv-tts
venv-tts\Scripts\activate

# Linux/macOS
python3 -m venv venv-tts
source venv-tts/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Starting the Service

#### Windows
Use the provided batch file:
```bash
run_tts_service.bat
```

Or start manually:
```bash
python app.py
```

#### Linux/macOS
```bash
python3 app.py
```

### Environment Variables

- `PORT`: Service listening port (default: 5004)
- `DEBUG`: Enable debug mode (default: false)

Example:
```bash
# Windows
set PORT=8080
set DEBUG=true
python app.py

# Linux/macOS
PORT=8080 DEBUG=true python3 app.py
```

### Usage Examples

#### Python
```python
import requests

# Text-to-speech
response = requests.post('http://localhost:5004/tts', json={
    'text': 'Hello, World!',
    'lang': 'en',
    'format': 'file'
})

# Save audio file
if response.status_code == 200:
    with open('output.wav', 'wb') as f:
        f.write(response.content)
```

#### JavaScript (Fetch API)
```javascript
// Text-to-speech
fetch('http://localhost:5004/tts', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        text: 'Hello, World!',
        lang: 'en',
        format: 'link'
    })
})
.then(response => response.json())
.then(data => {
    console.log('Download URL:', data.download_url);
});
```

#### cURL
```bash
# Text-to-speech and download
curl -X POST http://localhost:5004/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello World","lang":"en","format":"file"}' \
  --output output.wav
```

## Error Handling

The service uses standard HTTP status codes and JSON format error messages:

- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `413 Request Entity Too Large`: Request too large
- `500 Internal Server Error`: Internal server error
- `503 Service Unavailable`: Service temporarily unavailable

Error response format:
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "message": "Detailed error message"
}
```

## Important Notes

1. The service stores temporary files in the `temp_audio` directory and automatically cleans files older than 1 hour every hour
2. Single text conversion is limited to 5000 characters
3. File upload size limit is 16MB
4. When using `format: "link"`, generated links are valid for 1 hour

## License

This project uses the [Edge-TTS](https://github.com/rany2/edge-tts) package, which has dual licensing:
- `src/edge_tts/srt_composer.py` uses MIT License
- All other files use LGPLv3 License

For detailed license information, please refer to the Edge-TTS license documentation.

## Related Links

- [Edge-TTS GitHub](https://github.com/rany2/edge-tts)
- [Edge-TTS Documentation](https://github.com/rany2/edge-tts#usage)

## Issue Reporting

For any issues or suggestions, please submit them on the project's Issues page.