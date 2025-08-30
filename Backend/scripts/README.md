# EdgExpo AI Assistant - Scripts Guide

## Quick Start

**For first-time setup, run:**
```bash
setup-guide.bat
```

## Individual Scripts

### Setup Scripts (Run in order)
1. **check-dependencies.bat** - Check Python 3.12 x64 installation
2. **setup-microservice-env.bat** - Setup main backend environment
3. **setup-tts-env.bat** - Setup TTS (Text-to-Speech) service
4. **setup-stt-env.bat** - Setup STT (Speech-to-Text) service  
5. **setup-embedding-env.bat** - Setup Embedding service

### Testing Scripts
- **test-services.bat** - Quick test of all service health endpoints
- **check-microservices-status.bat** - Detailed service status with monitoring options

### Service Management
- **start-all-microservices.bat** - Start all services in correct order
- **stop-all-microservices.bat** - Stop all running services

## Recommended Workflow

### First Time Setup
```bash
cd scripts
setup-guide.bat
```

### Daily Operations
```bash
# Start services
start-all-microservices.bat

# Check status
test-services.bat

# Stop services when done
stop-all-microservices.bat
```

### Troubleshooting
```bash
# Check individual service health
check-microservices-status.bat

# Rebuild problematic service environment
setup-[service]-env.bat
```

## Service Ports
- **Backend API**: 5000
- **TTS Service**: 5004
- **STT Service**: 5003
- **Embedding Service**: 11434
- **LLM Service**: 8910

## Notes
- All setup scripts will remove and recreate virtual environments
- Dependencies are automatically downloaded during setup
- Status files are stored in `%APPDATA%\EdgExpo-AI-Assistant-X\`