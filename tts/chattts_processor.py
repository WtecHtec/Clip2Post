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

    def generate(self, text, output_base_path, voice="", 
                 temperature=0.3, top_p=0.7, top_k=20, 
                 speed=5, refine_text_flag=True):
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

        # Use seed/voice if provided
        # ChatTTS uses random vectors or seeds. 
        # If voice is a seed, we can sample it.
        # We sample ONCE per generation to ensure consistency across segments.
        spk_smp = None
        if voice and voice.isdigit():
            try:
                # Use torch.manual_seed to fix the random sampling result
                torch.manual_seed(int(voice))
                spk_smp = self.chat.sample_random_speaker()
            except:
                pass
        
        if spk_smp is None:
            # Sample a random speaker once for this entire video if no seed is provided
            import random
            random_seed = random.randint(1, 1000000)
            torch.manual_seed(random_seed)
            spk_smp = self.chat.sample_random_speaker()

        # ChatTTS infer can take a list of texts
        # But for timing control and potential memory issues, we process segments
        for i, seg in enumerate(segments):
            # Skip empty or punctuation-only segments
            import re
            if not re.search(r'[\w\u4e00-\u9fff]', seg):
                continue

            print(f"  [ChatTTS] Processing segment: {seg[:30]}...")
            
            # Clarity Optimization: Add internal breaks for literal mode to prevent swallowing
            processed_seg = seg
            if not refine_text_flag:
                # Insert [uv_break] at natural pauses (commas, etc.) if they exist, 
                # or just add one at the end to ensure the last word is fully rendered.
                processed_seg = re.sub(r'([，,。！？!?；;])', r'\1[uv_break]', seg)
                if not processed_seg.endswith('[uv_break]'):
                    processed_seg += '[uv_break]'
            
            # Determine refinement prompt based on content
            if refine_text_flag:
                # If user already used manual tags, use a lighter prompt to avoid conflict
                has_manual_tags = bool(re.search(r'\[(laugh|laughter|uv_break|oral_.*?)\]', processed_seg))
                refine_prompt = '[oral_2][laugh_0][break_4]' if not has_manual_tags else ''
            else:
                # Literal mode: no extra tokens besides the pacing we added
                refine_prompt = ''
            
            params_refine_text = self.chat.RefineTextParams(
                prompt=refine_prompt,
                temperature=temperature,
                top_P=top_p,
                top_K=top_k
            )
            
            # Speed mapping: Handle relative values (e.g., 0.9, 1.1) vs absolute (5, 9)
            try:
                speed_val = float(speed)
                if speed_val <= 2.5:
                    # Map 1.0 to 5, 0.2 to 1, 1.8 to 9
                    speed_level = int(min(9, max(1, speed_val * 5)))
                else:
                    # Treat as absolute level 1-9
                    speed_level = int(min(9, max(1, speed_val)))
            except:
                speed_level = 5
                
            speed_prompt = f"[speed_{speed_level}]"
            params_infer_code = self.chat.InferCodeParams(
                spk_emb=spk_smp,
                prompt=speed_prompt,
                temperature=temperature,
                top_P=top_p,
                top_K=top_k
            )

            wavs = self.chat.infer([processed_seg], params_refine_text=params_refine_text, params_infer_code=params_infer_code)
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
            
            # Clean text for display (remove [laugh], [uv_break] etc, and common punctuation)
            display_text = re.sub(r'\[.*?\]', '', seg)
            display_text = re.sub(r'[^\w\u4e00-\u9fff]', '', display_text).strip()
            
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

def run_chattts_sync(text, output_base_path, voice="", 
                     temperature=0.3, top_p=0.7, top_k=20, 
                     speed=5, refine_text_flag=True):
    processor = ChatTTSProcessor()
    return processor.generate(text, output_base_path, voice=voice,
                              temperature=temperature, top_p=top_p, top_k=top_k,
                              speed=speed, refine_text_flag=refine_text_flag)
