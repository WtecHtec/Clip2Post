import os
import json
import soundfile as sf
import numpy as np
from pathlib import Path

try:
    from kokoro_onnx import Kokoro
except ImportError:
    Kokoro = None

class KokoroProcessor:
    def __init__(self, model_path="models/kokoro/kokoro-v1.0.onnx", voices_path="models/kokoro/voices-v1.0.bin"):
        self.model_path = Path(model_path)
        self.voices_path = Path(voices_path)
        self.kokoro = None
        
        if self.model_path.exists() and self.voices_path.exists():
            self.kokoro = Kokoro(str(self.model_path), str(self.voices_path))
        else:
            print(f"Warning: Kokoro model files not found at {self.model_path}. Please run download script.")

    def generate(self, text, output_base_path, voice="af_heart"):
        """
        Generate WAV and JSON timestamps using Kokoro-82M ONNX with segmentation and pauses.
        """
        if not self.kokoro:
            raise RuntimeError("Kokoro model not initialized. Check model paths.")

        output_wav = f"{output_base_path}.wav"
        output_json = f"{output_base_path}.json"

        from tts.utils import split_text_into_segments, is_chinese
        from pydub import AudioSegment
        import io
        
        segments = split_text_into_segments(text)

        final_audio = AudioSegment.empty()
        word_boundaries = []
        current_ms = 0
        latest_sr = 24000 

        for i, seg in enumerate(segments):
            # Skip empty or punctuation-only segments that TTS might reject
            import re
            if not re.search(r'[\w\u4e00-\u9fff]', seg):
                continue

            lang = "en-us"
            samples, sr = None, None
            
            if is_chinese(seg):
                try:
                    lang = "zh"
                    samples, sr = self.kokoro.create(seg, voice=voice, speed=1.0, lang=lang)
                except Exception as e:
                    print(f"Warning: Kokoro 'zh' failed ({e}). Falling back to 'en-us'.")
                    lang = "en-us"
                    samples, sr = self.kokoro.create(seg, voice=voice, speed=1.0, lang=lang)
            else:
                samples, sr = self.kokoro.create(seg, voice=voice, speed=1.0, lang=lang)
            
            latest_sr = sr
            
            # Convert numpy samples to pydub AudioSegment
            # Kokoro outputs float32 samples between -1 and 1
            # pydub likes int16
            audio_int16 = (samples * 32767).astype(np.int16)
            seg_audio = AudioSegment(
                audio_int16.tobytes(), 
                frame_rate=sr,
                sample_width=2, 
                channels=1
            )
            
            seg_duration_ms = len(seg_audio)
            
            word_boundaries.append({
                "text": seg,
                "startMs": current_ms,
                "endMs": current_ms + seg_duration_ms
            })
            
            final_audio += seg_audio
            current_ms += seg_duration_ms
            
            # Add silence between segments
            if i < len(segments) - 1:
                # Only add pause for major punctuation. Comma/minor already handled by TTS flow.
                if any(p in seg for p in '。.!?！？'):
                    pause_ms = 300
                    final_audio += AudioSegment.silent(duration=pause_ms, frame_rate=sr)
                    current_ms += pause_ms

        # Save final audio
        final_audio.export(output_wav, format="wav")

        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(word_boundaries, f, ensure_ascii=False, indent=2)

        return output_wav, output_json

def run_kokoro_tts_sync(text, output_base_path, voice="af_heart"):
    processor = KokoroProcessor()
    return processor.generate(text, output_base_path, voice=voice)
