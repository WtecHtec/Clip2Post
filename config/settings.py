import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file in the root directory
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)
TASKS_DIR = BASE_DIR / "tasks"
MODELS_DIR = BASE_DIR / "models"

# Ensure directories exist
TASKS_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# LLM Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4-turbo")
HF_TOKEN = os.getenv("HF_TOKEN", "")
HF_ENDPOINT = os.getenv("HF_ENDPOINT", "")

# ASR Configuration
# Options: "funasr", "faster-whisper", "whisperx", "qwen3-asr"
ASR_TYPE = os.getenv("ASR_TYPE", "funasr")

# FunASR Configuration
ASR_MODEL_DIR = os.getenv("ASR_MODEL_DIR", "iic/Speech2Text-Paraformer-Large-16k")
ASR_MODEL_REVISION = os.getenv("ASR_MODEL_REVISION", "v2.0.4")
VAD_MODEL = os.getenv("VAD_MODEL", "damo/speech_fsmn_vad_zh-cn-16k-common-pytorch")
VAD_MODEL_REVISION = os.getenv("VAD_MODEL_REVISION", "v2.0.4")
PUNC_MODEL = os.getenv("PUNC_MODEL", "damo/punc_ct-transformer_zh-cn-common-vocab272727-pytorch")
PUNC_MODEL_REVISION = os.getenv("PUNC_MODEL_REVISION", "v2.0.4")

# Whisper Configuration (Faster-Whisper / WhisperX)
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
# Device: "cuda", "cpu", "mps" (for Mac)
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "float32")
# 允许指定本地模型路径（如从魔塔下载到 models 目录下的路径）
WHISPER_MODEL_PATH = os.getenv("WHISPER_MODEL_PATH", "")

# Qwen3-ASR Configuration
QWEN_ASR_MODEL = os.getenv("QWEN_ASR_MODEL", "Qwen/Qwen3-ASR-0.6B")
QWEN_FORCED_ALIGNER = os.getenv("QWEN_FORCED_ALIGNER", "Qwen/Qwen3-ForcedAligner-0.6B")

# Video & Audio processing config
DEFAULT_AUDIO_SAMPLE_RATE = 16000
DEFAULT_AUDIO_CHANNELS = 1
