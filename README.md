# edgexpo-ai-assistant-x
EdgExpo AI public/OpenSource Version

> 🏆 **2025 Qualcomm Taiwan AI Hackathon Project**  
> Competition URL: https://contest.bhuntr.com/tw/Qualcomm_TW_AIHackathon/home/

## Project Overview

This is an open-source AI exhibition assistant that leverages Qualcomm Snapdragon X Elite NPU for edge computing capabilities, solving language communication and customer management challenges in international exhibitions.

## Team Composition

EdgExpo Team is formed by participants from multiple organizations competing together:
- **M4ORE** (from MOOOORE-MITSUSEN Group): Peggy, Anna
- **Shuttle**: Mark, Anya  
- **Shih Chien University AI Center**: Fei

## Problem Description

In international exhibitions and business events, exhibitors often face:

- Insufficient staffing, unable to serve multiple visitors simultaneously
- Cross-cultural communication barriers, requiring real-time Chinese-English or multilingual switching
- Time-consuming business card and follow-up contact management, prone to omissions

This leads to low exhibition efficiency and loss of potential business opportunities.

## Use Cases

- **Voice Interaction Workflow**: Visitor voice input → Edge ASR (Whisper-V3-Turbo from Qualcomm AI Hub model) → LLM: Language recognition & translation (Phi-3.5-mini instruct from Qualcomm AI Hub model) → Knowledge base search (FAISS/Chroma + Nomic-Embed-Text from Qualcomm AI Hub model) → Edge TTS response (edge-tts)
- **Business Card Processing Workflow**: Business card image input → VLM: Qwen2.5-VL (open-source and inferenced by own computing infrastructure) → Data structuring → Local CRM/JSON storage → Send EDM (through Email)

## Project Directory Structure

```
edgexpo-ai-assistant-x/
├── Backend/                    # Backend services
│   ├── backend/               # Main backend application
│   │   ├── app.py            # Flask main application
│   │   ├── models/           # Data models
│   │   ├── services/         # Business logic services
│   │   └── utils/            # Utility functions
│   ├── service-stt/          # Speech-to-text microservice
│   ├── service-tts/          # Text-to-speech microservice  
│   ├── service-llm/          # Large language model microservice
│   ├── service-embedding/    # Vector embedding microservice
│   ├── knowledge_base/       # Knowledge base files
│   ├── data/                 # Data storage
│   └── frontend/             # Backend embedded frontend interface
├── Frontend/                  # React frontend application
│   ├── src/                  # Source code
│   ├── public/               # Static resources
│   └── package.json          # Frontend dependency configuration
├── Profiling/                # Performance analysis tools
│   ├── whisper/              # Whisper model analysis
│   ├── ocr/                  # OCR model analysis
│   └── docs/                 # Analysis documentation
└── environment_setup.md      # Environment setup guide
```

## Environment Setup

For technical architecture and environment installation instructions, please refer to [environment_setup.md](environment_setup.md)

## License

This project is licensed under the Apache License 2.0.

For detailed license content, please refer to the [LICENSE](LICENSE) file.
