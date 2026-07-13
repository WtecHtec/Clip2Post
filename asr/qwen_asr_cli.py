# coding=utf-8
import sys
import json
import torch
from pathlib import Path

# Add project root to sys.path to access config
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from config.settings import QWEN_ASR_MODEL, QWEN_FORCED_ALIGNER
from qwen_asr import Qwen3ASRModel

def run_qwen_asr(audio_path_str: str, output_subtitle_path_str: str, raw_output_path_str: str = None, json_output_path_str: str = None):
    audio_path = Path(audio_path_str)
    output_subtitle_path = Path(output_subtitle_path_str)
    
    device = "mps" if torch.backends.mps.is_available() else ("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"Loading Qwen3ASRModel on device: {device}...")
    model = Qwen3ASRModel.from_pretrained(
        QWEN_ASR_MODEL,
        dtype=torch.float32 if device == "cpu" else torch.bfloat16,
        device_map=device,
        max_new_tokens=256,
        forced_aligner=QWEN_FORCED_ALIGNER,
        forced_aligner_kwargs=dict(
            dtype=torch.float32 if device == "cpu" else torch.bfloat16,
            device_map=device,
        ),
    )
    
    print(f"Transcribing {audio_path}...")
    results = model.transcribe(
        audio=str(audio_path),
        language=None,
        return_time_stamps=True,
    )
    
    full_text = []
    sentences = []
    
    if results and len(results) > 0:
        result = results[0]
        full_text_str = result.text
        full_text.append(full_text_str)
        
        # Combine characters/words into sentences
        if result.time_stamps:
            punctuations = set("。！？，；,.!?,;")
            current_sentence = ""
            current_start_ms = None
            current_end_ms = None
            
            ts_idx = 0
            ts_list = result.time_stamps
            
            char_idx = 0
            while char_idx < len(full_text_str):
                char = full_text_str[char_idx]
                
                if char == ' ':
                    current_sentence += char
                    char_idx += 1
                    continue
                    
                if char in punctuations:
                    current_sentence += char
                    if current_sentence.strip():
                        sentences.append({
                            "startMs": current_start_ms if current_start_ms is not None else 0,
                            "endMs": current_end_ms if current_end_ms is not None else ((current_start_ms or 0) + 500),
                            "text": current_sentence.strip()
                        })
                    current_sentence = ""
                    current_start_ms = None
                    char_idx += 1
                    continue
                    
                # Now match a token from ts_list
                if ts_idx < len(ts_list):
                    ts = ts_list[ts_idx]
                    if current_start_ms is None:
                        current_start_ms = int(ts.start_time * 1000)
                    current_end_ms = int(ts.end_time * 1000)
                    
                    current_sentence += ts.text
                    char_idx += len(ts.text)
                    ts_idx += 1
                else:
                    current_sentence += char
                    char_idx += 1

            if current_sentence.strip():
                sentences.append({
                    "startMs": current_start_ms if current_start_ms is not None else 0,
                    "endMs": current_end_ms if current_end_ms is not None else ((current_start_ms or 0) + 500),
                    "text": current_sentence.strip()
                })
        else:
            # Fallback if no timestamps returned
            sentences.append({
                "startMs": 0,
                "endMs": 1000,
                "text": full_text_str.strip()
            })
            
    if raw_output_path_str and raw_output_path_str != "None":
        raw_output_path = Path(raw_output_path_str)
        raw_output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(raw_output_path, 'w', encoding='utf-8') as f:
            f.write(" ".join(full_text))

    output_subtitle_path.parent.mkdir(parents=True, exist_ok=True)
    
    def format_time(milliseconds: int) -> str:
        if not milliseconds:
            return "00:00:00"
        seconds = int(milliseconds) // 1000
        m, s = divmod(seconds, 60)
        h, m = divmod(m, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    with open(output_subtitle_path, 'w', encoding='utf-8') as f:
        for sentence in sentences:
            time_str = format_time(sentence['startMs'])
            f.write(f"[{time_str}] {sentence['text']}\n\n")
            
    if json_output_path_str and json_output_path_str != "None":
        json_output_path = Path(json_output_path_str)
        json_output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(json_output_path, 'w', encoding='utf-8') as f:
            json.dump(sentences, f, ensure_ascii=False, indent=2)

    print("ASR transcription finished successfully.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python qwen_asr_cli.py <audio_path> <output_subtitle_path> [raw_output_path] [json_output_path]")
        sys.exit(1)
        
    audio = sys.argv[1]
    subtitle = sys.argv[2]
    raw = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "None" else None
    js = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "None" else None
    
    run_qwen_asr(audio, subtitle, raw, js)
