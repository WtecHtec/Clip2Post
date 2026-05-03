import os
import json
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv
import time
from pathlib import Path

load_dotenv()

class LLMProvider(ABC):
    @abstractmethod
    def generate(self, messages: List[Dict[str, str]], log_dir: Optional[str] = None, **kwargs) -> str:
        """
        Generate a response from the LLM based on the provided messages.
        """
        pass

    def _log_interaction(self, request_args: Dict[str, Any], response_content: str, log_dir: Optional[str] = None):
        """Helper to save LLM request and response to a JSON log file."""
        try:
            if log_dir:
                actual_log_dir = Path(log_dir)
            else:
                actual_log_dir = Path(__file__).parent.parent / "llm_logs"
            
            actual_log_dir.mkdir(parents=True, exist_ok=True)
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            log_file = actual_log_dir / f"llm_log_{timestamp}.json"
            log_data = {
                "request": request_args,
                "response": response_content
            }
            with open(log_file, "w", encoding="utf-8") as f:
                json.dump(log_data, f, ensure_ascii=False, indent=2)
        except Exception as log_e:
            print(f"Warning: Failed to write LLM log: {log_e}")


class MiMoProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: str = "mimo-v2.5-pro"):
        self.api_key = api_key or os.environ.get("MIMO_API_KEY")
        if not self.api_key:
            raise ValueError("MIMO_API_KEY environment variable is not set.")
        
        self.model = model
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://token-plan-sgp.xiaomimimo.com/v1"
        )

    def generate(self, messages: List[Dict[str, str]], log_dir: Optional[str] = None, **kwargs) -> str:
        # Provide some default arguments if not specified in kwargs
        request_args = {
            "model": self.model,
            "messages": messages,
            "max_completion_tokens": kwargs.get("max_completion_tokens", 14096),
            "temperature": kwargs.get("temperature", 0.7),
            "top_p": kwargs.get("top_p", 0.95),
            "stream": False,
            "stop": None,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "extra_body": {
                "thinking": {"type": "disabled"}
            }
        }
        
        # Override with any explicit kwargs provided
        for k, v in kwargs.items():
            if k not in ["max_completion_tokens", "temperature", "top_p"]:
                request_args[k] = v

        try:
            completion = self.client.chat.completions.create(**request_args)
            content = completion.choices[0].message.content
            self._log_interaction(request_args, content, log_dir)
            return content
        except Exception as e:
            print(f"Error during MiMo API call: {e}")
            raise e

class MinimaxProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: str = "MiniMax-M2.7"):
        self.api_key = api_key or os.environ.get("MINIMAX_API_KEY")
        if not self.api_key:
            raise ValueError("MINIMAX_API_KEY environment variable is not set.")
        
        self.model = model
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.minimaxi.com/v1"
        )

    def generate(self, messages: List[Dict[str, str]], log_dir: Optional[str] = None, **kwargs) -> str:
        request_args = {
            "model": self.model,
            "messages": messages,
            "max_completion_tokens": kwargs.get("max_completion_tokens", 16384),
            "temperature": kwargs.get("temperature", 0.7),
            "top_p": kwargs.get("top_p", 0.95),
            "stream": False,
        }
        
        # Override with any explicit kwargs provided
        for k, v in kwargs.items():
            request_args[k] = v

        try:
            completion = self.client.chat.completions.create(**request_args)
            content = completion.choices[0].message.content
            self._log_interaction(request_args, content, log_dir)
            return content
        except Exception as e:
            print(f"Error during Minimax API call: {e}")
            raise e

# Factory or simple registry for providers can be added here if needed
def get_llm_provider(provider_name: Optional[str] = None, **kwargs) -> LLMProvider:
    if provider_name is None:
        provider_name = os.environ.get("LLM_VENDOR", "mimo")
    
    if provider_name.lower() == "mimo":
        return MiMoProvider(**kwargs)
    elif provider_name.lower() == "minimax":
        return MinimaxProvider(**kwargs)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")
