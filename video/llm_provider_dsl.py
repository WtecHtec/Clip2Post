import os
import json
import requests
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from .llm_provider import LLMProvider, format_detailed_error

class StreamingCurlProvider(LLMProvider):
    """
    A provider that manually hits the LLM API endpoint with stream=True
    and prints tokens to standard output in real-time.
    """
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("LLM_API_KEY")
        self.base_url = base_url or os.environ.get("LLM_BASE_URL")
        self.model = model or os.environ.get("LLM_MODEL", "gpt-4o")
        
        if not self.api_key:
            raise ValueError("LLM_API_KEY environment variable is not set for StreamingCurlProvider.")
        if not self.base_url:
            raise ValueError("LLM_BASE_URL environment variable is not set for StreamingCurlProvider.")
            
        # Ensure endpoint is correctly formed
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
            "messages": messages,
            "max_completion_tokens": kwargs.get("max_completion_tokens", 16384),
            "stream": True
        }
        
        # Override with any explicit kwargs provided
        for k, v in kwargs.items():
            if k not in ["log_dir"]:
                data[k] = v
                
        try:
            print(f"      [StreamingCurlProvider] Requesting stream from {self.endpoint} using {self.model}...")
            response = requests.post(self.endpoint, headers=headers, json=data, stream=True, timeout=120)
            response.raise_for_status()
            
            full_content = []
            
            for line in response.iter_lines():
                if not line:
                    continue
                
                # Decode SSE line
                line_str = line.decode("utf-8").strip()
                
                if line_str.startswith("data:"):
                    data_str = line_str[5:].strip()
                    if data_str == "[DONE]":
                        break
                        
                    try:
                        chunk_json = json.loads(data_str)
                        if "error" in chunk_json:
                            error_msg = chunk_json["error"].get("message", "Unknown API error")
                            raise ValueError(f"LLM Stream Error: {error_msg}")
                            
                        choices = chunk_json.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content_chunk = delta.get("content", "")
                            if content_chunk:
                                full_content.append(content_chunk)
                                # Stream print chunk to console immediately
                                sys.stdout.write(content_chunk)
                                sys.stdout.flush()
                    except Exception as inner_e:
                        if isinstance(inner_e, ValueError) and "LLM Stream Error" in str(inner_e):
                            raise inner_e
                        pass
            
            print() # Insert a final newline after streaming is done
            accumulated_response = "".join(full_content)
            self._log_interaction(data, accumulated_response, log_dir)
            return accumulated_response
            
        except Exception as e:
            detailed_msg = format_detailed_error(e)
            print(f"\nError during Streaming Curl LLM API call: {detailed_msg}")
            if hasattr(e, 'response') and getattr(e, 'response') is not None:
                print(f"Response details: {e.response.text}")
            raise RuntimeError(f"Streaming Curl LLM API call failed: {detailed_msg}") from e
