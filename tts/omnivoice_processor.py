import os
import json
import torch
import torchaudio
import numpy as np
from pathlib import Path

class OmniVoiceProcessor:
    def __init__(self, model_id="k2-fsa/OmniVoice"):
        self.model_id = model_id
        self.model = None
        self.load_model()

    def load_model(self):
        if self.model is not None:
            return
        
        try:
            from omnivoice import OmniVoice
        except ImportError:
            raise ImportError("Please install omnivoice: pip install omnivoice")

        # Automatically determine device
        device = "cpu"
        if torch.cuda.is_available():
            device = "cuda:0"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"

        print(f"Loading OmniVoice model {self.model_id} on {device}...")
        self.model = OmniVoice.from_pretrained(
            self.model_id,
            device_map=device,
            dtype=torch.float16 if device != "cpu" else torch.float32
        )
        print("OmniVoice model loaded completely.")

    def generate(self, text, output_base_path, voice_instruct="", ref_audio=None, ref_text=None):
        """
        Generate WAV and JSON timestamps using OmniVoice.
        """
        if not self.model:
            self.load_model()

        output_wav = f"{output_base_path}.wav"
        output_json = f"{output_base_path}.json"

        from tts.utils import split_text_into_segments
        from pydub import AudioSegment
        import io
        import tempfile
        
        segments = split_text_into_segments(text)

        final_audio = AudioSegment.empty()
        word_boundaries = []
        current_ms = 0
        target_sr = 24000 

        for i, seg in enumerate(segments):
            import re
            if not re.search(r'[\w\u4e00-\u9fff]', seg):
                continue
            
            # Prepare generation kwargs
            kwargs = {
                "text": seg,
            }
            if ref_audio:
                kwargs["ref_audio"] = ref_audio
            if ref_text:
                kwargs["ref_text"] = ref_text
            if voice_instruct:
                kwargs["instruct"] = voice_instruct

            try:
                audio_tensor_list = self.model.generate(**kwargs)
                # audio_tensor_list is a list of Tensors with shape (1, T)
                audio_tensor = audio_tensor_list[0].cpu().to(torch.float32)
                
                # torchaudio doesn't support BytesIO well with some backends, use a temporary file instead
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                    tmp_path = tmp_file.name
                
                try:
                    torchaudio.save(tmp_path, audio_tensor, target_sr, format="wav")
                    seg_audio = AudioSegment.from_file(tmp_path, format="wav")
                finally:
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
                    
                seg_duration_ms = len(seg_audio)
                print(f"  [OmniVoice] Generated segment: {seg[:30]!r}... duration: {seg_duration_ms}ms")
                
                word_boundaries.append({
                    "text": seg,
                    "startMs": current_ms,
                    "endMs": current_ms + seg_duration_ms
                })
                
                final_audio += seg_audio
                current_ms += seg_duration_ms
                
                # Add silence between segments
                if i < len(segments) - 1:
                    if any(p in seg for p in '。.!?！？'):
                        pause_ms = 300
                        final_audio += AudioSegment.silent(duration=pause_ms, frame_rate=target_sr)
                        current_ms += pause_ms
                        
            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"  [OmniVoice] Error generating segment '{seg}': {e}")
                continue

        # Save final audio
        if len(final_audio) > 0:
            final_audio.export(output_wav, format="wav")
        else:
            raise ValueError("Failed to generate any audio using OmniVoice")

        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(word_boundaries, f, ensure_ascii=False, indent=2)

        return output_wav, output_json

# Global instance to avoid reloading
_global_omnivoice_processor = None

def run_omnivoice_tts_sync(text, output_base_path, voice_instruct="", ref_audio=None, ref_text=None):
    global _global_omnivoice_processor
    if _global_omnivoice_processor is None:
        _global_omnivoice_processor = OmniVoiceProcessor()

    # Map preset names to their wav paths
    preset_wavs = {
        "biaoge": "tts/voxcpmwav/biaoge.wav",
        "boniu": "tts/voxcpmwav/boniu.wav",
        "liuxi": "tts/voxcpmwav/liuxi.wav"
    }

    if voice_instruct:
        voice_instruct_stripped = voice_instruct.strip()
        if voice_instruct_stripped in preset_wavs:
            voice_instruct = preset_wavs[voice_instruct_stripped]

    # Auto-detect cloning mode: if voice_instruct is an existing .wav file path,
    # route it to ref_audio (zero-shot voice cloning) instead of style instruction.
    # This lets the frontend simply upload a file and put its path in the `voice` field
    # without requiring any API schema changes.
    if voice_instruct and not ref_audio:
        candidate = Path(voice_instruct.strip())
        if not candidate.is_absolute():
            project_root = Path(__file__).resolve().parent.parent
            resolved_candidate = project_root / candidate
            if resolved_candidate.is_file():
                candidate = resolved_candidate

        if candidate.suffix.lower() == ".wav" and candidate.is_file():
            ref_audio = str(candidate.resolve())
            voice_instruct = ""
            print(f"  [OmniVoice] Auto-detected ref_audio from path: {ref_audio}")

    return _global_omnivoice_processor.generate(
        text,
        output_base_path,
        voice_instruct=voice_instruct,
        ref_audio=ref_audio,
        ref_text=ref_text,
    )
