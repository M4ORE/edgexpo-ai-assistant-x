# Service-LLM

Local LLM inference service based on Qualcomm AI Engine Direct, providing OpenAI-compatible API interface.

## Features

This service provides local large language model inference capabilities with:
- OpenAI-compatible REST API interface
- Support for multiple model configurations (default: Phi-3.5-mini)
- Streaming and non-streaming response modes
- Local execution without internet connection required

## Directory Structure

```
service-llm/
├── GenieAPIService/          # API service related files
├── include/                  # Header files
├── models/                   # Model files directory
│   └── [model_name]/        # Individual model folders
│       ├── config.json      # Model configuration file
│       └── *.bin            # Model weight files
├── GenieAPIService.exe       # Main API service executable
├── GenieAPIClient.exe        # API client testing tool
├── genie-t2t-run.exe        # Text generation executable
├── Genie.dll                # Core library
├── QnnHtp*.dll              # Qualcomm Neural Network libraries
├── run_llm_service.bat      # Windows startup script
└── test-llm.py              # Python test script

```

## API Documentation

The service runs by default at `http://127.0.0.1:8910` and provides the following endpoints:

### List Available Models
```
GET /v1/models
```

### Chat Completions
```
POST /v1/chat/completions
```

Request example:
```json
{
  "model": "Phi-3.5-mini",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello"}
  ],
  "stream": false,
  "extra_body": {
    "size": 4096,
    "temp": 1.5,
    "top_k": 13,
    "top_p": 0.6
  }
}
```

## Installation

### 1. System Requirements
- Windows 10/11 x64
- Hardware with Qualcomm AI Engine support
- Python 3.8+ (only required for test scripts)

### 2. Download Models

Download required models from Qualcomm AIHub:
- Phi-3.5 Mini Instruct: https://aihub.qualcomm.com/models/phi_3_5_mini_instruct

### 3. Model Installation Steps

1. Download model files from the above link
2. Extract the downloaded files
3. Create a subfolder with the model name in the `models` directory (e.g., `models/phi_3_5_mini_instruct/`)
4. Copy the following files to the model folder:
   - `config.json` - Model configuration file
   - All `.bin` files - Model weight files
   - Other model-related files

**Note:** 
- Tokenizer files will be downloaded automatically when running `GenieAPIService.py`
- For **Phi-3.5-Mini-Instruct** model: To see appropriate spaces in the output, you need to modify `tokenizer.json`:
  - If downloading manually: Remove lines 192-197 (Strip rule) and the extra comma on line 191
  - If downloading through `GenieAPIService.py`: The script will modify it automatically

The required change for `tokenizer.json`:
```diff
-      },
-      {
-        "type": "Strip",
-        "content": " ",
-        "start": 1,
-        "stop": 0
-      }
+      }
```

Example directory structure:
```
models/
└── phi_3_5_mini_instruct/
    ├── config.json
    ├── model.bin
    ├── tokenizer.json
    └── [other model files]
```

### 4. Install Python Dependencies (for testing)

```bash
pip install openai
```

## Usage

### Starting the Service

Using default model (Phi-3.5-mini):
```bash
run_llm_service.bat
```

Using a specific model:
```bash
run_llm_service.bat phi_3_5_mini_instruct
```

### Python Test Example

```python
from openai import OpenAI

# Connect to local service
client = OpenAI(
    base_url="http://127.0.0.1:8910/v1",
    api_key="123"  # Local service doesn't require real API key
)

# List available models
models = client.models.list()
print(models)

# Send chat request
response = client.chat.completions.create(
    model="Phi-3.5-mini",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ]
)
print(response.choices[0].message.content)
```

### Using Test Script

Non-streaming mode:
```bash
python test-llm.py --prompt "Your question here"
```

Streaming mode:
```bash
python test-llm.py --stream --prompt "Your question here"
```

## References

This implementation is based on:
- [Qualcomm AI Engine Direct Helper - Genie Python Sample](https://github.com/quic/ai-engine-direct-helper/blob/main/samples/genie/python/README.md)
- [Qualcomm AI Hub Apps - LLM on Genie Tutorial](https://github.com/quic/ai-hub-apps/tree/main/tutorials/llm_on_genie)

## License Information

This project depends on components from [Qualcomm AI Engine Direct Helper](https://github.com/quic/ai-engine-direct-helper).

### License Terms (BSD-3-Clause)

```
Copyright (c) 2023, Qualcomm Innovation Center, Inc. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

SPDX-License-Identifier: BSD-3-Clause

## Notes

- Keep the command window open while the service is running
- Initial model loading may take some time
- The service listens on local port 8910 by default; modify configuration if there's a conflict