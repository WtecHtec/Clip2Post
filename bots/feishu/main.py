import sys
import os

# Add project root to sys.path to enable imports from the main project
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import lark_oapi as lark
from bots.feishu.config import LARK_APP_ID, LARK_APP_SECRET
from bots.feishu.handlers import event_handler

# Create Lark WS Client for event listening using long-connection (WebSocket)
wsClient = lark.ws.Client(
    LARK_APP_ID,
    LARK_APP_SECRET,
    event_handler=event_handler,
    log_level=lark.LogLevel.DEBUG,
)

def main():
    print("Starting Feishu bot...")
    wsClient.start()

if __name__ == "__main__":
    main()
