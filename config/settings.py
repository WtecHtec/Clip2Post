import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file in the root directory
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)
TASKS_DIR = BASE_DIR / "tasks"

# Ensure tasks directory exists
TASKS_DIR.mkdir(parents=True, exist_ok=True)

# LLM Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4-turbo")

# FunASR Configuration
ASR_MODEL_DIR = os.getenv("ASR_MODEL_DIR", "iic/Speech2Text-Paraformer-Large-16k")
ASR_MODEL_REVISION = os.getenv("ASR_MODEL_REVISION", "v2.0.4")
VAD_MODEL = os.getenv("VAD_MODEL", "damo/speech_fsmn_vad_zh-cn-16k-common-pytorch")
VAD_MODEL_REVISION = os.getenv("VAD_MODEL_REVISION", "v2.0.4")
PUNC_MODEL = os.getenv("PUNC_MODEL", "damo/punc_ct-transformer_zh-cn-common-vocab272727-pytorch")
PUNC_MODEL_REVISION = os.getenv("PUNC_MODEL_REVISION", "v2.0.4")

# Video & Audio processing config
DEFAULT_AUDIO_SAMPLE_RATE = 16000
DEFAULT_AUDIO_CHANNELS = 1
