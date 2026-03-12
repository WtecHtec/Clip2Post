import os
import json
import torch
import numpy as np
from pathlib import Path
from pydub import AudioSegment
import io
import ChatTTS

class ChatTTSProcessor:
    def __init__(self):
        self.chat = ChatTTS.Chat()
        # Download models if not present, then load. 
        # compile=False for better compatibility.
        # Check if models are loaded/present
        self.chat.load(compile=False)

    def generate(self, text, output_base_path, voice=""):
        """
        Generate WAV and JSON timestamps using ChatTTS with segmentation.
        """
        output_wav = f"{output_base_path}.wav"
        output_json = f"{output_base_path}.json"

        from tts.utils import split_text_into_segments
        
        segments = split_text_into_segments(text)

        final_audio = AudioSegment.empty()
        word_boundaries = []
        current_ms = 0
        sr = 24000 # ChatTTS default sample rate

        # ChatTTS infer can take a list of texts
        # But for timing control and potential memory issues, we process segments
        for i, seg in enumerate(segments):
            # Skip empty or punctuation-only segments
            import re
            if not re.search(r'[\w\u4e00-\u9fff]', seg):
                continue

            print(f"  [ChatTTS] Processing segment: {seg[:30]}...")
            
            # Determine refinement prompt based on content
            # If user already used manual tags, use a lighter prompt to avoid conflict
            has_manual_tags = bool(re.search(r'\[(laugh|laughter|uv_break|oral_.*?)\]', seg))
            refine_prompt = '[oral_2][laugh_0][break_4]' if not has_manual_tags else ''
            
            params_refine_text = self.chat.RefineTextParams(prompt=refine_prompt)
            
            # Use seed/voice if provided
            # ChatTTS uses random vectors or seeds. 
            # If voice is a seed, we can sample it.
            params_infer_code = self.chat.InferCodeParams(spk_smp=None)
            if voice and voice.isdigit():
                try:
                    std_voice = self.chat.sample_random_speaker(seed=int(voice))
                    params_infer_code.spk_smp = std_voice
                except:
                    pass

            wavs = self.chat.infer([seg], params_refine_text=params_refine_text, params_infer_code=params_infer_code)
            samples = wavs[0] # First (and only) result

            # Convert float32 [-1, 1] to int16
            samples = np.clip(samples, -1.0, 1.0)
            audio_int16 = (samples * 32767).astype(np.int16)
            
            seg_audio = AudioSegment(
                audio_int16.tobytes(), 
                frame_rate=sr,
                sample_width=2, 
                channels=1
            )
            
            seg_duration_ms = len(seg_audio)
            
            # Clean text for display (remove [laugh], [uv_break] etc)
            display_text = re.sub(r'\[.*?\]', '', seg).strip()
            
            if display_text:
                word_boundaries.append({
                    "text": display_text,
                    "startMs": current_ms,
                    "endMs": current_ms + seg_duration_ms
                })
           
            final_audio += seg_audio
            current_ms += seg_duration_ms
            
            # Add silence between segments for natural flow
            if i < len(segments) - 1:
                if any(p in seg for p in '。.!?！？'):
                    pause_ms = 400
                    final_audio += AudioSegment.silent(duration=pause_ms, frame_rate=sr)
                    current_ms += pause_ms

        # Save final audio
        final_audio.export(output_wav, format="wav")

        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(word_boundaries, f, ensure_ascii=False, indent=2)

        return output_wav, output_json

def run_chattts_sync(text, output_base_path, voice=""):
    processor = ChatTTSProcessor()
    return processor.generate(text, output_base_path, voice=voice)
