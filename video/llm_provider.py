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
    def generate(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """
        Generate a response from the LLM based on the provided messages.
        messages format: [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
        """
        pass


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

    def generate(self, messages: List[Dict[str, str]], **kwargs) -> str:
        # Provide some default arguments if not specified in kwargs
        request_args = {
            "model": self.model,
            "messages": messages,
            "max_completion_tokens": kwargs.get("max_completion_tokens", 4096),
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
            
            # Save log to llm_logs directory
            try:
                log_dir = Path(__file__).parent.parent / "llm_logs"
                log_dir.mkdir(parents=True, exist_ok=True)
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                log_file = log_dir / f"llm_log_{timestamp}.json"
                log_data = {
                    "request": request_args,
                    "response": content
                }
                with open(log_file, "w", encoding="utf-8") as f:
                    json.dump(log_data, f, ensure_ascii=False, indent=2)
            except Exception as log_e:
                print(f"Warning: Failed to write LLM log: {log_e}")

            return content
        except Exception as e:
            print(f"Error during MiMo API call: {e}")
            raise e

# Factory or simple registry for providers can be added here if needed
def get_llm_provider(provider_name: str = "mimo", **kwargs) -> LLMProvider:
    if provider_name.lower() == "mimo":
        return MiMoProvider(**kwargs)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")
