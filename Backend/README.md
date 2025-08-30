# EdgeExpo AI Assistant X - Backend

## 🎯 Project Overview

EdgeExpo AI Assistant X is a distributed AI microservices backend system that provides speech recognition, text-to-speech, large language model inference, and vector embedding services. The system adopts a microservices architecture design where each service can be independently deployed and managed, while supporting unified management scripts for centralized control.

## 🏗️ System Architecture

### Four Core Microservices

#### 1. **Backend Service** (Main Backend Service) - Port 5000
- Unified API gateway and business logic processing
- Knowledge base (RAG) management system
- CRM customer relationship management
- WebSocket real-time communication
- Frontend resource serving

#### 2. **STT Service** (Speech-to-Text) - Port 5003  
- Based on OpenAI Whisper model
- Supports multiple audio formats (WAV/MP3/WebM)
- Quantized inference acceleration
- Chinese and English speech recognition

#### 3. **TTS Service** (Text-to-Speech) - Port 5004
- Based on Edge-TTS engine
- Supports multilingual speech synthesis
- High-quality audio output
- Asynchronous processing mechanism

#### 4. **Embedding Service** (Vector Embedding) - Port 11434
- Compatible with Ollama API format
- Efficient vector computation
- Supports batch processing
- Core component of RAG system

#### 5. **LLM Service** (Large Language Model) - Port 8910
- Based on Genie model inference engine
- Local LLM inference
- QNN acceleration support
- Scalable model architecture

## 📁 Directory Structure

```
Backend/
├── backend/                    # Main backend service
│   └── app.py                 # Flask main application
├── service-stt/               # Speech-to-text service
│   ├── whisper_api_server.py  # Whisper API server
│   ├── build/                 # Model files directory
│   └── requirements.txt       # Python dependencies
├── service-tts/               # Text-to-speech service
│   ├── app.py                # TTS API server
│   └── requirements.txt      # Python dependencies
├── service-embedding/         # Vector embedding service
│   ├── api_server.py         # FastAPI server
│   ├── inference_engine.py   # Inference engine
│   └── models/               # Embedding models directory
├── service-llm/              # Large language model service
│   ├── Genie.dll            # Inference engine
│   ├── models/              # LLM models directory
│   └── *.exe                # Executable files
├── scripts/                  # Management scripts
│   ├── setup-guide.bat      # One-click setup guide
│   ├── start-all-microservices.bat  # Start all services
│   ├── stop-all-microservices.bat   # Stop all services
│   └── check-microservices-status.bat  # Status check
├── frontend/                 # Frontend resources
├── knowledge_base/           # Knowledge base files
│   ├── company_info.json    # Company information
│   ├── qa_pairs.json        # Q&A dialogues
│   └── custom_kb.json       # Custom knowledge base
├── data/                     # Data files
│   └── contacts.json        # CRM contact data
├── logs/                     # Log files
└── requirements_microservice.txt  # Main dependencies list
```

## 🚀 Quick Start

### System Requirements

- **Operating System**: Windows 11 (primary support)
- **Python**: 3.12.x (x64 version)
- **Memory**: 32GB+ RAM (recommended)
- **Processor**: Qualcomm X Series
- **Storage**: At least 20GB available space

### Installation Methods

#### Method 1: One-Click Installation (Recommended)

```bash
# Enter scripts directory
cd scripts

# Run one-click setup guide
setup-guide.bat
```

#### Method 2: Manual Installation

```bash
# 1. Check dependency environment
scripts\check-dependencies.bat

# 2. Setup service environments (execute in order)
scripts\setup-microservice-env.bat      # Main backend service
scripts\setup-tts-env.bat              # TTS service
scripts\setup-stt-env.bat              # STT service  
scripts\setup-embedding-env.bat        # Embedding service

# 3. Test service status
scripts\test-services.bat
```

### Starting the System

#### Start All Services
```bash
# One-click start all microservices
scripts\start-all-microservices.bat
```

#### Stop All Services  
```bash
# Stop all running services
scripts\stop-all-microservices.bat
```

#### Check Service Status
```bash  
# Check the running status of all services
scripts\check-microservices-status.bat
```

## 📖 Usage Guide

### Service Port Configuration

After successful startup, each service can be accessed through the following ports:

- **Backend Service**: http://localhost:5000
  - Homepage: http://localhost:5000/
  - Admin panel: http://localhost:5000/admin.html  
  - API health check: http://localhost:5000/api/health
  
- **STT Service**: http://localhost:5003
  - Health check: http://localhost:5003/health
  - Speech-to-text: http://localhost:5003/transcribe
  
- **TTS Service**: http://localhost:5004  
  - Health check: http://localhost:5004/health
  - Text-to-speech: http://localhost:5004/tts
  
- **Embedding Service**: http://localhost:11434
  - Health check: http://localhost:11434/health
  - Vector embedding: http://localhost:11434/api/embeddings
  
- **LLM Service**: http://localhost:8910 (auto-start)

### Independent Service Management

Each service can be started and managed independently:

```bash
# STT Service
cd service-stt
run_stt_service.bat

# TTS Service  
cd service-tts
run_tts_service.bat

# Embedding Service
cd service-embedding
run_embedding_service.bat

# LLM Service
cd service-llm
run_llm_service.bat

# Main Backend Service
cd backend
python app.py
```

## 🔌 API Documentation

### Backend Service API (Port 5000)

#### Health Check
```http  
GET /api/health
```

#### Speech-to-Text
```http
POST /api/asr
Content-Type: multipart/form-data

Parameters:
- audio: Audio file (WAV/MP3/WebM)
- language: Language code (optional)
```

#### Text-to-Speech
```http
POST /api/tts  
Content-Type: application/json

{
  "text": "Text to synthesize",
  "language": "zh-TW"
}
```

#### RAG Knowledge Base Query
```http
POST /api/rag
Content-Type: application/json

{
  "query": "Your question",
  "language": "zh-TW" 
}
```

#### Knowledge Base Management
```http
GET    /api/kb/list              # List all knowledge items
POST   /api/kb/update            # Update/add knowledge items  
DELETE /api/kb/delete?id=xxx     # Delete knowledge items
```

#### CRM Customer Management
```http
GET    /api/crm/contacts         # Get contact list
POST   /api/crm/contacts         # Add contact
PUT    /api/crm/contacts/<id>    # Update contact
DELETE /api/crm/contacts/<id>    # Delete contact  
GET    /api/crm/statistics       # Get statistics
```

### STT Service API (Port 5003)

```http
GET  /health                     # Service health check
POST /transcribe                 # Speech-to-text
GET  /status                     # Service status
```

### TTS Service API (Port 5004)

```http
GET  /health                     # Service health check  
POST /tts                        # Text-to-speech
GET  /languages                  # Supported languages list
GET  /voices                     # Available voices list
GET  /download/<file_id>         # Download audio file
```

### Embedding Service API (Port 11434)

```http
GET  /health                     # Service health check
GET  /api/tags                   # Available models list
POST /api/embeddings             # Vector embedding (Ollama format)
POST /embed                      # Single text embedding
POST /embed/batch               # Batch text embedding
```

## ⚙️ Management Scripts Description

### Setup Scripts

- **setup-guide.bat**: One-click setup guide to complete all environment configurations
- **check-dependencies.bat**: Check Python 3.12 x64 installation status  
- **setup-microservice-env.bat**: Setup main backend service environment
- **setup-tts-env.bat**: Setup TTS service environment
- **setup-stt-env.bat**: Setup STT service environment
- **setup-embedding-env.bat**: Setup embedding service environment

### Runtime Management Scripts

- **start-all-microservices.bat**: Start all services in correct order
- **stop-all-microservices.bat**: Stop all running services
- **check-microservices-status.bat**: Detailed check of each service status
- **test-services.bat**: Quick test of all service health status

### Service Configuration

Configuration file locations for each service:

- **Backend Service**: Uses environment variables and built-in configuration
- **STT Service**: Built-in configuration in whisper_api_server.py  
- **TTS Service**: Built-in configuration in app.py
- **Embedding Service**: models/models.json, models/nomic-embed_config.json
- **LLM Service**: htp_backend_ext_config.json

### Hardware Requirements Recommendations

| Service Type | Memory Requirements | Processor | Description |
|--------------|-------------------|-----------|-------------|
| Backend | 2-4GB | Standard CPU | Main business logic |
| STT | 4-8GB | NPU | Whisper model inference |
| TTS | 2-4GB | Standard CPU | Edge-TTS engine |
| Embedding | 4-6GB | CPU/NPU | Vector computation |
| LLM | 8-16GB | NPU recommended | Large language model inference |

## 🔧 Development Guide

### Microservice Extension

#### Adding New Microservice

1. Create new service directory `service-newservice/` in root directory
2. Implement service API (recommended using Flask/FastAPI)
3. Create corresponding startup script `run_newservice_service.bat`
4. Create environment setup script in `scripts/`
5. Update `start-all-microservices.bat` and `stop-all-microservices.bat`

#### Service Communication

Inter-service communication mainly through HTTP API:

```python
# Example: Backend calling STT service
import requests

response = requests.post('http://localhost:5003/transcribe', 
                        files={'audio': audio_file})
result = response.json()
```

### Knowledge Base Management

#### Adding Knowledge Content

1. **Using Web Admin Panel** (Recommended)
   - Visit http://localhost:5000/admin.html
   
2. **Directly Editing JSON Files**
   ```json
   // knowledge_base/qa_pairs.json
   {
     "qa_pairs": [
       {
         "id": "qa_001",
         "question": "Question content", 
         "answer": "Answer content",
         "keywords": ["keyword1", "keyword2"],
         "category": "product"
       }
     ]
   }
   ```

### Model Configuration

#### Replacing STT Model
Modify model path in `service-stt/whisper_api_server.py`

#### Replacing TTS Engine  
Modify TTS configuration in `service-tts/app.py`

#### Replacing Embedding Model
Edit `service-embedding/models/models.json`

## ❓ Troubleshooting

### Common Issues

#### 1. Service Cannot Start
```bash
# Check port usage
netstat -ano | findstr :5000

# Check service status
scripts\check-microservices-status.bat

# Reinstall service environment
scripts\setup-microservice-env.bat
```

#### 2. Python Environment Issues
```bash
# Check Python version and architecture  
scripts\check-dependencies.bat

# Ensure using Python 3.12 x64 version
python --version
python -c "import platform; print(platform.architecture())"
```

#### 3. Model Loading Failed
- **Insufficient Memory**: Close other programs, keep at least 8GB available memory
- **Missing Model Files**: Re-run corresponding setup scripts
- **Path Issues**: Confirm model files are in correct directories

#### 4. Service Communication Errors
```bash
# Test health status of each service
scripts\test-services.bat

# Check if firewall is blocking local ports
# Confirm all services are running on correct ports
```

#### 5. Knowledge Base Cannot Update
- Check `knowledge_base/` directory permissions
- Confirm JSON format correctness
- Restart Backend service to reload

### Log Check Locations

- **Backend Service Logs**: `logs/` directory
- **Microservice Logs**: Check corresponding service output windows
- **Windows Event Logs**: View system-level errors
- **Service Status Files**: `%APPDATA%\EdgExpo-AI-Assistant-X\`

### Performance Optimization Suggestions

#### Memory Optimization
- Choose appropriate model sizes based on hardware configuration
- Avoid running multiple heavy model services simultaneously
- Regularly restart long-running services

#### Inference Acceleration  
- Prioritize NPU acceleration (if supporting Qualcomm QNN)
- Consider model quantization and compression
- Adjust batch processing size

## 🚀 Deployment Recommendations

### Development Environment
Recommended to use provided batch scripts for local development:
```bash
scripts\start-all-microservices.bat
```

### Production Environment Deployment

#### Windows Service Deployment
1. Use Windows Service Manager to register microservices as system services
2. Configure automatic restart and monitoring mechanisms  
3. Set appropriate resource limits and log rotation

#### Docker Containerization (Future Planning)
Consider containerizing microservices for better isolation and scalability

### Load Balancing
For high-load scenarios, deploy multiple identical service instances and use load balancers to distribute requests

## 📄 License Information

This project is licensed under the Apache-2.0 License, see LICENSE file for details.


## 🙏 Acknowledgments

This project uses the following open-source technologies:

- **OpenAI Whisper** - Speech recognition model
- **Edge-TTS** - Text-to-speech engine  
- **LangChain** - RAG framework
- **FastAPI/Flask** - Web service frameworks
- **ChromaDB** - Vector database

---

<div align="center">

**EdgeExpo AI Assistant X Backend**

*High Performance • Microservices • Local AI*

</div>