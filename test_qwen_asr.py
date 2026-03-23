import sys
from pathlib import Path
from asr.recognizer import ASRRecognizer
from config.settings import ASR_TYPE

def test_qwen3_asr(audio_path):
    print("Loading model via ASRRecognizer...")
    # Initialize forcing qwen3-asr
    recognizer = ASRRecognizer(asr_type="qwen3-asr")
    
    audio_p = Path(audio_path)
    out_sub = audio_p.parent / "test_subtitle.txt"
    raw_sub = audio_p.parent / "test_raw.txt"
    
    print(f"Transcribing {audio_path}...")
    _, sentences = recognizer.recognize(audio_p, out_sub, raw_sub)
    
    print("\n--- Transcription Results (with punctuation and proper timestamps) ---")
    for s in sentences:
        start_t = recognizer.format_time(s['startMs'])
        end_t = recognizer.format_time(s['endMs'])
        print(f"[{start_t} -> {end_t}] {s['text']}")
        
    print(f"\nSubtitles saved to {out_sub}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_qwen_asr.py <path_to_audio_file>")
        sys.exit(1)
    
    test_qwen3_asr(sys.argv[1])
