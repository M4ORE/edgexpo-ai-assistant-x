# -*- coding: utf-8 -*-

import os
import sys
import io
import tempfile
import subprocess
import queue
import threading
from datetime import datetime
from flask import Flask, request, jsonify, make_response
import json
import uuid

# Force UTF-8 encoding for stdout and stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Set environment variable for UTF-8
os.environ['PYTHONIOENCODING'] = 'utf-8'

from qai_hub_models.models._shared.hf_whisper.app import HfWhisperApp
from qai_hub_models.utils.onnx_torch_wrapper import (
    OnnxModelTorchWrapper,
    OnnxSessionOptions,
)

app = Flask(__name__)

# Global variables for model and queue
whisper_app = None
transcription_queue = queue.Queue()
is_processing = False
processing_lock = threading.Lock()

def load_model():
    """Load Whisper model at startup"""
    global whisper_app
    
    print("Loading Whisper model at startup...")
    print("Before model loading: " + str(datetime.now().astimezone()))
    
    # Model paths
    encoder_path = "build\\whisper-large-v3-turbo\\HfWhisperEncoder\\model.onnx"
    decoder_path = "build\\whisper-large-v3-turbo\\HfWhisperDecoder\\model.onnx"
    model_size = "large-v3-turbo"
    
    # Disable compile caching because Stable Diffusion is Pre-Compiled
    options = OnnxSessionOptions.aihub_defaults()
    options.context_enable = False
    
    try:
        whisper_app = HfWhisperApp(
            OnnxModelTorchWrapper.OnNPU(encoder_path),
            OnnxModelTorchWrapper.OnNPU(decoder_path),
            f"openai/whisper-{model_size}",
        )
        print("After model loading: " + str(datetime.now().astimezone()))
        print("Whisper model loaded successfully!")
        return True
    except Exception as e:
        error_msg = str(e).encode('utf-8', 'replace').decode('utf-8')
        print(f"Error loading model: {error_msg}")
        return False

def convert_audio_to_wav(audio_file_path):
    """Convert audio file to wav format if needed"""
    file_ext = os.path.splitext(audio_file_path)[1].lower()
    
    if file_ext in ['.wav', '.mp3']:
        return audio_file_path, None
    
    if file_ext == '.m4a':
        print("Before ffmpeg conversion: " + str(datetime.now().astimezone()))
        print(f"Converting {file_ext} to wav...")
        
        temp_wav_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_wav_path = temp_wav_file.name
        temp_wav_file.close()
        
        try:
            # Use local ffmpeg installation
            ffmpeg_path = os.path.join(os.path.dirname(__file__), 'ffmpeg', 'bin', 'ffmpeg.exe')
            subprocess.run([
                ffmpeg_path, '-i', audio_file_path, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-y', temp_wav_path
            ], check=True, capture_output=True)
            
            print(f"Converted to: {temp_wav_path}")
            print("After ffmpeg conversion: " + str(datetime.now().astimezone()))
            return temp_wav_path, temp_wav_path
            
        except subprocess.CalledProcessError as e:
            error_msg = str(e).encode('utf-8', 'replace').decode('utf-8')
            print(f"Error converting audio: {error_msg}")
            if os.path.exists(temp_wav_path):
                os.unlink(temp_wav_path)
            raise Exception(f"Audio conversion failed: {error_msg}")
    
    raise Exception(f"Unsupported audio format: {file_ext}")

def process_transcription(audio_path, language=None, request_id=None):
    """Process transcription for a single audio file"""
    temp_file = None
    
    try:
        # Convert audio if needed
        wav_path, temp_file = convert_audio_to_wav(audio_path)
        
        # Transcribe
        print(f"[{request_id}] Before transcription: " + str(datetime.now().astimezone()))
        if language:
            print(f"[{request_id}] Language specified: {language} (Note: API may not support language parameter)")
        else:
            print(f"[{request_id}] Auto-detecting language...")
        
        # Note: HfWhisperApp.transcribe() doesn't support language parameter
        # Language detection is automatic
        transcription = whisper_app.transcribe(wav_path)
        
        # Clean up transcription - remove common Whisper artifacts
        # Remove Russian "Продолжение следует..." (To be continued...) that sometimes appears
        import re
        transcription = re.sub(r'Продолжение следует\.{0,3}', '', transcription)
        transcription = transcription.strip()
        
        print(f"[{request_id}] After transcription: " + str(datetime.now().astimezone()))
        print(f"[{request_id}] Transcription: {transcription}")
        
        return {
            "success": True,
            "transcription": transcription,
            "language": language if language else "auto-detected",
            "request_id": request_id
        }
        
    except Exception as e:
        error_msg = str(e).encode('utf-8', 'replace').decode('utf-8')
        print(f"[{request_id}] Error in transcription: {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "request_id": request_id
        }
    
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    data = {
        "status": "healthy",
        "model_loaded": whisper_app is not None,
        "queue_size": transcription_queue.qsize(),
        "timestamp": str(datetime.now().astimezone())
    }
    response = make_response(json.dumps(data, ensure_ascii=False, indent=2))
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """Main transcription endpoint"""
    global is_processing
    
    if whisper_app is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    # Check if file is provided
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Get language parameter (optional)
    language = request.form.get('language', None)
    
    # Generate request ID
    request_id = str(uuid.uuid4())[:8]
    
    # Save uploaded file temporarily
    temp_audio_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1])
    audio_file.save(temp_audio_file.name)
    temp_audio_file.close()
    
    # Check queue status
    queue_size = transcription_queue.qsize()
    
    with processing_lock:
        if is_processing or queue_size > 0:
            # Add to queue
            transcription_queue.put({
                "audio_path": temp_audio_file.name,
                "language": language,
                "request_id": request_id
            })
            data = {
                "message": "Request queued",
                "request_id": request_id,
                "queue_position": queue_size + 1,
                "status": "queued"
            }
            response = make_response(json.dumps(data, ensure_ascii=False, indent=2))
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
            return response, 202
        else:
            # Process immediately
            is_processing = True
    
    try:
        # Process transcription
        result = process_transcription(temp_audio_file.name, language, request_id)
        
        # Process any queued requests
        while not transcription_queue.empty():
            try:
                queued_request = transcription_queue.get_nowait()
                print(f"Processing queued request: {queued_request['request_id']}")
                process_transcription(
                    queued_request['audio_path'], 
                    queued_request['language'], 
                    queued_request['request_id']
                )
                # Clean up queued file
                if os.path.exists(queued_request['audio_path']):
                    os.unlink(queued_request['audio_path'])
            except queue.Empty:
                break
    
    finally:
        with processing_lock:
            is_processing = False
        
        # Clean up original file
        if os.path.exists(temp_audio_file.name):
            os.unlink(temp_audio_file.name)
    
    if result['success']:
        response = make_response(json.dumps(result, ensure_ascii=False, indent=2))
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response, 200
    else:
        response = make_response(json.dumps(result, ensure_ascii=False, indent=2))
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response, 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get current processing status"""
    data = {
        "is_processing": is_processing,
        "queue_size": transcription_queue.qsize(),
        "model_loaded": whisper_app is not None,
        "timestamp": str(datetime.now().astimezone())
    }
    response = make_response(json.dumps(data, ensure_ascii=False, indent=2))
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response

if __name__ == '__main__':
    print("Starting Whisper API Server...")
    
    # Load model at startup
    if not load_model():
        print("Failed to load model. Exiting...")
        exit(1)
    
    print("Starting Flask server on port 5003...")
    app.run(host='0.0.0.0', port=5003, debug=False, threaded=True)
