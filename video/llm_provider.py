import os
import json
import requests
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv
import time
from pathlib import Path

load_dotenv()

def format_detailed_error(e: Exception) -> str:
    """Helper to extract detailed message from nested/chained exceptions (e.g. connection errors)."""
    parts = [f"{type(e).__name__}: {str(e)}"]
    curr = e
    visited = set()
    while True:
        if curr in visited:
            break
        visited.add(curr)
        
        next_err = getattr(curr, "__cause__", None) or getattr(curr, "__context__", None)
        if next_err:
            parts.append(f"-> {type(next_err).__name__}: {str(next_err)}")
            curr = next_err
        else:
            break
    return " | ".join(parts)

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
            detailed_msg = format_detailed_error(e)
            print(f"Error during MiMo API call: {detailed_msg}")
            raise RuntimeError(f"MiMo API call failed: {detailed_msg}") from e

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
            detailed_msg = format_detailed_error(e)
            print(f"Error during Minimax API call: {detailed_msg}")
            raise RuntimeError(f"Minimax API call failed: {detailed_msg}") from e

class DirectProvider(LLMProvider):
    """A provider that directly uses LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL from environment."""
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("LLM_API_KEY")
        self.base_url = base_url or os.environ.get("LLM_BASE_URL")
        self.model = model or os.environ.get("LLM_MODEL", "gpt-4o")
        
        if not self.api_key:
            raise ValueError("LLM_API_KEY environment variable is not set for Direct mode.")
        if not self.base_url:
            raise ValueError("LLM_BASE_URL environment variable is not set for Direct mode.")
        
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

    def generate(self, messages: List[Dict[str, str]], log_dir: Optional[str] = None, **kwargs) -> str:
        request_args = {
            "model": self.model,
            "messages": messages,
            # "max_completion_tokens": kwargs.get("max_completion_tokens", 16384),
            # "temperature": kwargs.get("temperature", 0.7),
            # "top_p": kwargs.get("top_p", 0.95),
            # "stream": False,
        }
        
        # Override with any explicit kwargs provided
        for k, v in kwargs.items():
            if k not in ["log_dir"]: # Avoid passing internal args to OpenAI
                request_args[k] = v

        try:
            completion = self.client.chat.completions.create(**request_args)
            content = completion.choices[0].message.content
            self._log_interaction(request_args, content, log_dir)
            return content
        except Exception as e:
            detailed_msg = format_detailed_error(e)
            print(f"Error during Direct LLM API call: {detailed_msg}")
            raise RuntimeError(f"Direct LLM API call failed: {detailed_msg}") from e

class CurlProvider(LLMProvider):
    """A provider that uses requests to manually hit the LLM API endpoint."""
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("LLM_API_KEY")
        self.base_url = base_url or os.environ.get("LLM_BASE_URL")
        self.model = model or os.environ.get("LLM_MODEL", "gpt-4o")
        
        if not self.api_key:
            raise ValueError("LLM_API_KEY environment variable is not set for Curl mode.")
        if not self.base_url:
            raise ValueError("LLM_BASE_URL environment variable is not set for Curl mode.")
            
        # Ensure the URL points to the completions endpoint if it's just a base URL
        if not self.base_url.endswith("/chat/completions"):
            self.endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        else:
            self.endpoint = self.base_url

    def generate(self, messages: List[Dict[str, str]], log_dir: Optional[str] = None, **kwargs) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        data = {
            "model": self.model,
            "messages": messages
        }
        
        # Override with any explicit kwargs provided
        for k, v in kwargs.items():
            if k not in ["log_dir"]:
                data[k] = v
                
        try:
            response = requests.post(self.endpoint, headers=headers, json=data, timeout=120)
            response.raise_for_status()  # Raise an exception for bad status codes
            
            resp_json = response.json()
            content = resp_json["choices"][0]["message"]["content"]
            self._log_interaction(data, content, log_dir)
            return content
        except Exception as e:
            detailed_msg = format_detailed_error(e)
            print(f"Error during Curl LLM API call: {detailed_msg}")
            if hasattr(e, 'response') and getattr(e, 'response') is not None:
                print(f"Response details: {e.response.text}")
            raise RuntimeError(f"Curl LLM API call failed: {detailed_msg}") from e

# Factory or simple registry for providers can be added here if needed
def get_llm_provider(provider_name: Optional[str] = None, **kwargs) -> LLMProvider:
    if provider_name is None:
        provider_name = os.environ.get("LLM_VENDOR", "mimo")
    
    name = provider_name.lower()
    if name == "mimo":
        return MiMoProvider(**kwargs)
    elif name == "minimax":
        return MinimaxProvider(**kwargs)
    elif name == "direct":
        return DirectProvider(**kwargs)
    elif name == "curl":
        return CurlProvider(**kwargs)
    elif name == "curlstream":
        from video.llm_provider_dsl import StreamingCurlProvider
        return StreamingCurlProvider(**kwargs)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")
