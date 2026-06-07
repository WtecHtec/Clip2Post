import os
import json
import numpy as np
from pathlib import Path
from pydub import AudioSegment
import re

class MLXAudioProcessor:
    _instance_list = {}

    def __new__(cls, model_id="mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16"):
        if model_id not in cls._instance_list:
            instance = super(MLXAudioProcessor, cls).__new__(cls)
            instance._initialized = False
            cls._instance_list[model_id] = instance
        return cls._instance_list[model_id]

    def __init__(self, model_id="mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16"):
        if self._initialized:
            return

        try:
            from mlx_audio.tts.utils import load_model
        except ImportError:
            raise ImportError("Please install mlx-audio: pip install mlx-audio")

        print(f"Loading MLX Audio model {model_id}...")
        self.model_id = model_id
        self.model = load_model(model_id)
        print("MLX Audio model loaded completely.")
        self.sample_rate = 24000
        self._initialized = True

    def generate(self, text, output_base_path, voice="Vivian", speed=1.0):
        """
        Generate WAV and JSON timestamps using mlx-audio.
        """
        import tempfile
        from tts.utils import split_text_into_segments
        from mlx_audio.tts.generate import generate_audio

        output_wav = f"{output_base_path}.wav"
        output_json = f"{output_base_path}.json"

        segments = split_text_into_segments(text)
        final_audio = AudioSegment.empty()
        word_boundaries = []
        current_ms = 0

        # Loop through each segment and generate audio
        for i, seg in enumerate(segments):
            if not re.search(r'[\w\u4e00-\u9fff]', seg):
                continue

            with tempfile.TemporaryDirectory() as tmp_dir:
                file_prefix = Path(tmp_dir) / "seg_temp"
                
                is_zh = any('\u4e00' <= c <= '\u9fff' for c in seg)
                lang_code = "zh" if is_zh else "en"

                kwargs = {
                    "text": seg,
                    "model": self.model,
                    "speed": speed,
                    "file_prefix": str(file_prefix),
                    "audio_format": "wav",
                    "sample_rate": self.sample_rate,
                    "join_audio": True,
                    "lang_code": lang_code,
                    "verbose": False
                }
                
                if "Kokoro" in self.model_id:
                    # Kokoro style voice names: af_heart, af_alloy, etc.
                    kwargs["voice"] = voice or "af_heart"
                else:
                    # Qwen3-TTS style voice names
                    kwargs["voice"] = voice or "Vivian"

                try:
                    generate_audio(**kwargs)
                    
                    generated_wav_path = Path(tmp_dir) / "seg_temp.wav"
                    if not generated_wav_path.exists():
                        generated_wav_path = Path(tmp_dir) / "seg_temp_000.wav"
                        
                    if generated_wav_path.exists():
                        seg_audio = AudioSegment.from_file(str(generated_wav_path), format="wav")
                        seg_duration_ms = len(seg_audio)
                        
                        clean_seg = re.sub(r'^[，。！？、,.\?!\-"\'\s]+', '', seg).strip()
                        word_boundaries.append({
                            "text": clean_seg,
                            "startMs": current_ms,
                            "endMs": current_ms + seg_duration_ms,
                        })
                        
                        final_audio += seg_audio
                        current_ms += seg_duration_ms
                        
                        # Add silence between segments
                        if i < len(segments) - 1 and any(p in seg for p in '。.!?！？'):
                            pause_ms = 300
                            final_audio += AudioSegment.silent(duration=pause_ms, frame_rate=self.sample_rate)
                            current_ms += pause_ms
                    else:
                        print(f"  [MLX Audio] Expected output file {generated_wav_path} not found.")
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    print(f"  [MLX Audio] Error generating segment '{seg}': {e}")
                    continue

        if len(final_audio) > 0:
            final_audio.export(output_wav, format="wav")
        else:
            raise ValueError("Failed to generate any audio using MLX Audio")

        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(word_boundaries, f, ensure_ascii=False, indent=2)

        return output_wav, output_json

# We use a cache of processors by model_id to support selecting different models
_global_mlx_processors = {}

def run_mlx_tts_sync(text, output_base_path, voice="", speed=1.0):
    global _global_mlx_processors
    
    # Defaults
    model_id = "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16"
    voice_name = "Vivian"

    # Decode voice parameter format: [ModelID]:[VoiceName]
    voice_str = voice.strip() if voice else ""
    if voice_str and ":" in voice_str:
        parts = voice_str.split(":", 1)
        # Check if the first part looks like a Hugging Face model id
        if "/" in parts[0] or parts[0].startswith("mlx-"):
            model_id = parts[0]
            voice_name = parts[1]
        else:
            voice_name = voice_str
    elif voice_str:
        voice_name = voice_str

    if model_id not in _global_mlx_processors:
        _global_mlx_processors[model_id] = MLXAudioProcessor(model_id=model_id)

    # Make sure we use the correct default voice per model
    if not voice_name:
        if "Kokoro" in model_id:
            voice_name = "af_heart"
        else:
            voice_name = "Vivian"

    return _global_mlx_processors[model_id].generate(
        text,
        output_base_path,
        voice=voice_name,
        speed=speed
    )
