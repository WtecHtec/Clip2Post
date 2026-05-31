import os
import re
import json
import torch
import numpy as np
from pydub import AudioSegment


# Preset voice descriptions for VoxCPM Voice Design.
# When a preset name is passed as the voice parameter, it resolves to this description.
VOXCPM_VOICE_PRESETS = {
    "biaoge": "成熟男性，声音磁性沉稳，语调自然",
    "boniu": "成熟男性，播音腔调，清晰有力，标准普通话",
    "liuxi": "年轻女性，声音温柔甜美，语调清新",
}


class VoxCPMProcessor:
    _instance = None

    def __new__(cls, model_id="openbmb/VoxCPM-0.5B"):
        if cls._instance is None:
            cls._instance = super(VoxCPMProcessor, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, model_id="openbmb/VoxCPM-0.5B"):
        if self._initialized:
            return

        try:
            from voxcpm import VoxCPM
        except ImportError:
            raise ImportError("Please install voxcpm: pip install voxcpm")

        # Automatically determine device
        device = "cpu"
        if torch.cuda.is_available():
            device = "cuda:0"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"

        print(f"Loading VoxCPM model {model_id} on {device}...")

        # Disable denoiser and torch.compile on MPS/CPU for compatibility and memory.
        load_denoiser = device.startswith("cuda")
        optimize = device.startswith("cuda")

        self.model = VoxCPM.from_pretrained(
            model_id,
            device=device,
            load_denoiser=load_denoiser,
            optimize=optimize,
        )
        print("VoxCPM model loaded completely.")
        self.sample_rate = (
            self.model.tts_model.sample_rate
            if hasattr(self.model, "tts_model")
            else 16000
        )
        self._initialized = True

    def generate(self, text, output_base_path, voice="", inference_timesteps=10, cfg_value=2.0):
        """
        Generate WAV and JSON timestamps using VoxCPM Voice Design.

        voice: A text description of the desired voice style, e.g. "年轻男性，声音沉稳低沉".
               Preset shorthand names (biaoge / boniu / liuxi) are automatically resolved
               to their corresponding descriptions. Leave empty for the model's default voice.
        """
        output_wav = f"{output_base_path}.wav"
        output_json = f"{output_base_path}.json"

        from tts.utils import split_text_into_segments

        segments = split_text_into_segments(text)

        final_audio = AudioSegment.empty()
        word_boundaries = []
        current_ms = 0

        # Resolve preset name → description, or use the value as a raw description.
        voice_desc = VOXCPM_VOICE_PRESETS.get(voice.strip(), voice).strip() if voice else ""
        if voice_desc:
            print(f"  [VoxCPM] Using voice design: {voice_desc!r}")

        for i, seg in enumerate(segments):
            # Skip empty or punctuation-only segments
            if not re.search(r'[\w\u4e00-\u9fff]', seg):
                continue

            # Prepend voice design description in parentheses if a style is specified
            seg_text = f"({voice_desc}){seg}" if voice_desc else seg

            kwargs = {
                "text": seg_text,
                "cfg_value": cfg_value,
                "inference_timesteps": inference_timesteps,
            }

            try:
                print(f"  [VoxCPM] Generating: {seg_text[:50]!r}...")
                wav = self.model.generate(**kwargs)

                wav_clipped = np.clip(wav, -1.0, 1.0)
                audio_int16 = (wav_clipped * 32767).astype(np.int16)

                seg_audio = AudioSegment(
                    audio_int16.tobytes(),
                    frame_rate=self.sample_rate,
                    sample_width=2,
                    channels=1,
                )

                seg_duration_ms = len(seg_audio)
                print(f"  [VoxCPM] Done: {seg[:30]!r}... ({seg_duration_ms}ms)")

                clean_seg = re.sub(r'^[，。！？、,.\?!\-"\'\s]+', '', seg).strip()
                word_boundaries.append({
                    "text": clean_seg,
                    "startMs": current_ms,
                    "endMs": current_ms + seg_duration_ms,
                })

                final_audio += seg_audio
                current_ms += seg_duration_ms

                # Add a short pause after sentence-ending punctuation
                if i < len(segments) - 1 and any(p in seg for p in '。.!?！？'):
                    pause_ms = 300
                    final_audio += AudioSegment.silent(duration=pause_ms, frame_rate=self.sample_rate)
                    current_ms += pause_ms

            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"  [VoxCPM] Error generating segment '{seg}': {e}")
                continue

        if len(final_audio) > 0:
            final_audio.export(output_wav, format="wav")
        else:
            raise ValueError("Failed to generate any audio using VoxCPM")

        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(word_boundaries, f, ensure_ascii=False, indent=2)

        return output_wav, output_json


# Global singleton — avoids reloading the model on every request.
_global_voxcpm_processor = None


def run_voxcpm_tts_sync(text, output_base_path, voice="", inference_timesteps=10, cfg_value=2.0):
    global _global_voxcpm_processor
    model_id = (
        "openbmb/VoxCPM-0.5B"
        if os.environ.get("VOXCPM_LIGHTWEIGHT", "1") == "1"
        else "openbmb/VoxCPM2"
    )
    if _global_voxcpm_processor is None:
        _global_voxcpm_processor = VoxCPMProcessor(model_id=model_id)

    return _global_voxcpm_processor.generate(
        text,
        output_base_path,
        voice=voice,
        inference_timesteps=inference_timesteps,
        cfg_value=cfg_value,
    )
