import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from project root .env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)

# Lark App configurations
LARK_APP_ID = os.getenv("LARK_APP_ID")
LARK_APP_SECRET = os.getenv("LARK_APP_SECRET")
LARK_ENCRYPT_KEY = os.getenv("LARK_ENCRYPT_KEY", "")
LARK_VERIFICATION_TOKEN = os.getenv("LARK_VERIFICATION_TOKEN", "")

# Custom Card IDs
TOPIC_CONFIRM_CARD_ID = os.getenv("TOPIC_CONFIRM_CARD_ID")
DISTRIBUTE_CARD_ID = os.getenv("DISTRIBUTE_CARD_ID")
