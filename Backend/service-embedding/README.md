# Embedding Service

A lightweight, high-performance text embedding service compatible with Ollama API, using ONNXRuntime for inference. This service provides fast text-to-vector conversion suitable for RAG applications, semantic search, and other NLP tasks.

## Features

- ✅ **Ollama API Compatible** - Drop-in replacement for Ollama embedding endpoints
- ⚡ **High Performance** - Uses ONNXRuntime for optimized CPU inference
- 🔌 **RESTful API** - Simple HTTP endpoints with JSON responses
- 🎯 **Batch Processing** - Support for single and batch text embedding
- 🚀 **Production Ready** - Built with FastAPI for robust async handling

## Project Structure

```
service-embedding/
├── api_server.py                # FastAPI server with REST endpoints
├── inference_engine.py          # ONNXRuntime inference engine
├── base_model.py               # Base model definitions and types
├── start_service.py            # Service startup script
├── client_example.py           # Python client usage example
├── load_existing_model.py      # Model loading utility
├── check_qnn_paths.py          # QNN path verification utility
├── run_embedding_service.bat   # Windows startup batch file
├── requirements.txt            # Python dependencies
├── requirements-qnn.txt        # QNN-specific dependencies
└── models/                     # Model directory
    ├── models.json             # Model registry
    ├── nomic-embed_config.json # Model configuration
    └── nomic_embed_text/       # Model files (need to download)
        ├── model.onnx          # ONNX model file
        └── model.data          # Model data file
```

## Model Setup

### Download Model

Download the Nomic Embed Text model from Qualcomm AI Hub:
```bash
# Download model from:
# https://aihub.qualcomm.com/models/nomic_embed_text

# Or use wget/curl:
wget https://aihub.qualcomm.com/models/nomic_embed_text/nomic_embed_text.onnx
```

### Place Model Files

After downloading, organize the model files as follows:

1. Create the model directory:
```bash
mkdir -p models/nomic_embed_text
```

2. Place the downloaded files:
```
models/
├── models.json                 # (already included)
├── nomic-embed_config.json     # (already included)
└── nomic_embed_text/
    ├── model.onnx              # Downloaded ONNX model
    └── model.data              # Downloaded data file (if provided)
```

**Note**: The model files (`.onnx` and `.data`) are not included in this repository due to size. You must download them separately from Qualcomm AI Hub.

## Installation

### Prerequisites

- Python 3.9 or higher
- pip package manager

### Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd service-embedding

# Create virtual environment (recommended)
python -m venv venv-embedding

# Activate virtual environment
# Windows:
venv-embedding\Scripts\activate
# Linux/Mac:
source venv-embedding/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Install QNN dependencies if using Qualcomm Neural Network SDK
pip install -r requirements-qnn.txt
```

## Usage

### Start the Service

#### Windows (with UTF-8 support)
```bash
# Use the provided batch file for proper UTF-8 encoding
run_embedding_service.bat
```

#### Linux/Mac
```bash
python start_service.py
```

#### Alternative startup method
```bash
# Using the API server directly
python api_server.py
```

The service will start on `http://127.0.0.1:11434`

### Test the Service

Run the example client to test:
```bash
python client_example.py
```

## API Documentation

### Endpoints

#### 1. Generate Embeddings (Ollama Compatible)
```http
POST /api/embeddings
```

**Request:**
```json
{
  "model": "nomic-embed",
  "input": "Your text here"
}
```

**Response:**
```json
{
  "model": "nomic-embed",
  "embeddings": [[0.1, 0.2, ...]],
  "total_duration": 50000000
}
```

#### 2. Simple Embed
```http
POST /embed
```

**Request:**
```json
{
  "text": "Your text here",
  "model": "nomic-embed"
}
```

**Response:**
```json
{
  "embedding": [0.1, 0.2, ...],
  "model": "nomic-embed",
  "dim": 768
}
```

#### 3. Batch Embedding
```http
POST /embed/batch
```

**Request:**
```json
{
  "texts": ["Text 1", "Text 2", "Text 3"],
  "model": "nomic-embed"
}
```

**Response:**
```json
{
  "embeddings": [[...], [...], [...]],
  "model": "nomic-embed",
  "count": 3
}
```

#### 4. List Models
```http
GET /api/tags
```

**Response:**
```json
{
  "models": [
    {
      "name": "nomic-embed",
      "modified_at": "2024-01-01T00:00:00Z",
      "size": 137000000
    }
  ]
}
```

#### 5. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "available_models": ["nomic-embed"]
}
```

### Usage Examples

#### cURL
```bash
# Generate embedding
curl -X POST http://127.0.0.1:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed",
    "input": "Hello, world!"
  }'

# Batch embedding
curl -X POST http://127.0.0.1:11434/embed/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["First text", "Second text"],
    "model": "nomic-embed"
  }'
```

#### Python
```python
import requests

# Single embedding
response = requests.post(
    "http://127.0.0.1:11434/embed",
    json={
        "text": "Your text here",
        "model": "nomic-embed"
    }
)
embedding = response.json()["embedding"]

# Batch embedding
response = requests.post(
    "http://127.0.0.1:11434/embed/batch",
    json={
        "texts": ["Text 1", "Text 2"],
        "model": "nomic-embed"
    }
)
embeddings = response.json()["embeddings"]
```

#### JavaScript/Node.js
```javascript
// Single embedding
const response = await fetch('http://127.0.0.1:11434/embed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Your text here',
    model: 'nomic-embed'
  })
});
const { embedding } = await response.json();
```

## Configuration

### Model Configuration

The model configuration is stored in `models/nomic-embed_config.json`:
```json
{
  "name": "nomic-embed",
  "model_path": "models/nomic_embed_text/model.onnx",
  "embedding_dim": 768,
  "max_seq_length": 128,
  "normalize": true
}
```

### Service Configuration

Modify `start_service.py` to change:
- Port number (default: 11434)
- Host address (default: 127.0.0.1)
- Number of workers
- Logging level

## Performance

- **Latency**: ~50ms per request (CPU)
- **Throughput**: 100+ requests/second
- **Memory**: ~500MB RAM
- **Embedding Dimension**: 768
- **Max Sequence Length**: 128 tokens

## Requirements

```
onnxruntime>=1.16.0
fastapi>=0.68.0
uvicorn[standard]>=0.15.0
pydantic>=1.8.0
numpy>=1.21.0
transformers>=4.20.0
```

## Troubleshooting

### Model Not Found
If you get a "model not found" error:
1. Ensure model files are downloaded from Qualcomm AI Hub
2. Check file paths in `models/nomic-embed_config.json`
3. Verify `model.onnx` exists in `models/nomic_embed_text/`

### Port Already in Use
If port 11434 is busy:
1. Change port in `start_service.py`
2. Or stop the conflicting service

### Out of Memory
If running on limited RAM:
1. Reduce batch size in requests
2. Consider using smaller sequence length

## License

Apache License 2.0 - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- **Model**: [Nomic Embed Text](https://aihub.qualcomm.com/models/nomic_embed_text) from Qualcomm AI Hub
- **Architecture Reference**: Based on [Qualcomm AI Hub Models](https://github.com/quic/ai-hub-models/blob/main/qai_hub_models/models/nomic_embed_text) (BSD 3-Clause License)
- **Frameworks & Libraries**:
  - [FastAPI](https://fastapi.tiangolo.com/) - MIT License
  - [ONNXRuntime](https://onnxruntime.ai/) - MIT License
  - [PyTorch](https://pytorch.org/) - BSD License
  - [Transformers](https://github.com/huggingface/transformers) - Apache License 2.0
  - [NumPy](https://numpy.org/) - BSD License
  - [Uvicorn](https://www.uvicorn.org/) - BSD License
  - [Pydantic](https://pydantic-docs.helpmanual.io/) - MIT License
  - [Sentence Transformers](https://www.sbert.net/) - Apache License 2.0

## License Compatibility

All dependencies use permissive licenses (MIT, BSD, Apache 2.0) that are compatible with the Apache License 2.0 used by this project. The core architecture is inspired by Qualcomm's AI Hub Models implementation, which uses BSD 3-Clause License.