import asyncio
import edge_tts
import json
from pathlib import Path

class TTSProcessor:
    def __init__(self, voice="zh-CN-XiaoxiaoNeural"):
        self.voice = voice

    async def generate(self, text, output_base_path):
        """
        Generate MP3 and JSON timestamps using edge-tts.
        """
        output_mp3 = f"{output_base_path}.mp3"
        output_json = f"{output_base_path}.json"
        
        from tts.utils import split_text_into_segments
        from pydub import AudioSegment
        import io
        
        segments = split_text_into_segments(text)
        
        final_audio = AudioSegment.empty()
        all_boundaries = []
        current_ms = 0
        
        for i, seg in enumerate(segments):
            # Skip empty or punctuation-only segments that edge-tts might reject
            import re
            if not re.search(r'[\w\u4e00-\u9fff]', seg):
                continue

            # Generate audio for segment with retries
            max_retries = 3
            audio_data = b""
            success = False
            
            for attempt in range(max_retries):
                try:
                    communicate = edge_tts.Communicate(seg, self.voice)
                    audio_data = b"" # Reset audio_data for each attempt
                    # We don't use boundary events from edge-tts here because we want the whole 
                    # segment as one block for the video, as requested ("not just one block").
                    # This makes the captions much cleaner.
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            audio_data += chunk["data"]
                    
                    if audio_data:
                        success = True
                        break
                except Exception as e:
                    print(f"  [EdgeTTS] Attempt {attempt + 1} failed for segment '{seg[:20]}...': {str(e)}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(1) # Wait before retry
                    else:
                        print(f"  [EdgeTTS] All retries failed for segment.")
            
            if not success or not audio_data:
                print(f"  [EdgeTTS] Skipping failed segment: {seg[:20]}")
                continue
            
            # Load into pydub
            try:
                seg_audio = AudioSegment.from_file(io.BytesIO(audio_data), format="mp3")
                seg_duration_ms = len(seg_audio)
                
                # Clean text for captions (strip punctuation)
                clean_seg = re.sub(r'[，。！？、,.\?!\-"\']', '', seg).strip()
                
                all_boundaries.append({
                    "text": clean_seg,
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
                        final_audio += AudioSegment.silent(duration=pause_ms)
                        current_ms += pause_ms
            except Exception as e:
                print(f"  [EdgeTTS] Error processing audio data: {e}")
                continue

        # Export final audio
        if len(final_audio) > 0:
            final_audio.export(output_mp3, format="mp3")
        else:
            raise ValueError("Failed to generate any audio using Edge TTS")

        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(all_boundaries, f, ensure_ascii=False, indent=2)

        return output_mp3, output_json

def run_tts_sync(text, output_base_path, voice="zh-CN-XiaoxiaoNeural"):
    """
    Synchronous wrapper to run the async TTS generation.
    """
    processor = TTSProcessor(voice=voice)
    return asyncio.run(processor.generate(text, output_base_path))
