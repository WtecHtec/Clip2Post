from pathlib import Path
from funasr import AutoModel
from config.settings import (
    ASR_MODEL_DIR, ASR_MODEL_REVISION, 
    VAD_MODEL, VAD_MODEL_REVISION,
    PUNC_MODEL, PUNC_MODEL_REVISION
)

class ASRRecognizer:
    def __init__(self):
        # Initialize FunASR ASR pipeline (Text generation with VAD + PUNC)
        self.asr_model = AutoModel(
            model=ASR_MODEL_DIR,
            model_revision=ASR_MODEL_REVISION,
            vad_model=VAD_MODEL,
            vad_model_revision=VAD_MODEL_REVISION,
            punc_model=PUNC_MODEL,
            punc_model_revision=PUNC_MODEL_REVISION,
        )

    def format_time(self, milliseconds: int) -> str:
        """Convert milliseconds to HH:MM:SS format."""
        if not milliseconds:
            return "00:00:00"
        seconds = int(milliseconds) // 1000
        m, s = divmod(seconds, 60)
        h, m = divmod(m, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    def recognize(self, audio_path: Path, output_subtitle_path: Path, raw_output_path: Path = None) -> Path:
        """
        Recognize audio and generate transcription using FunASR + Aeneas for alignment.
        Optionally save the raw unaligned text.
        """
        import re
        import time
        
        try:
            from aeneas.executetask import ExecuteTask
            from aeneas.task import Task
            aeneas_available = True
        except ImportError:
            aeneas_available = False
        
        # Debug: print output paths
        print(f"[recognize] output_subtitle_path = {output_subtitle_path.resolve()}")
        if raw_output_path:
            print(f"[recognize] raw_output_path = {raw_output_path.resolve()}")

        # Step 1: Run standard ASR to get the punctuated text with timestamps
        res_asr = self.asr_model.generate(input=str(audio_path), output_timestamp=True)
        
        text = ""
        if res_asr and isinstance(res_asr, list) and len(res_asr) > 0:
            result = res_asr[0]
            text = result.get('text', '').strip()
        
        if not text:
            output_subtitle_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_subtitle_path, 'w', encoding='utf-8') as f:
                f.write("00:00:00\n\n\n")
            if raw_output_path:
                raw_output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(raw_output_path, 'w', encoding='utf-8') as f:
                    f.write("00:00:00\n\n\n")
            return output_subtitle_path

        # Step 2: Save raw transcribed text if path provided
        if raw_output_path:
            raw_output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(raw_output_path, 'w', encoding='utf-8') as f:
                f.write(text)

        # Split text into fragments loosely based on punctuation for aeneas
        fragments = re.split(r'([。！？，；,.])', text)
        sentences_text = []
        for i in range(0, len(fragments) - 1, 2):
            frag = fragments[i] + fragments[i+1]
            if frag.strip():
                sentences_text.append(frag.strip())
        if len(fragments) % 2 == 1 and fragments[-1].strip():
            sentences_text.append(fragments[-1].strip())
            
        if not sentences_text:
            sentences_text = [text]

        # Step 2: Write temporary text file for aeneas
        temp_txt_path = output_subtitle_path.with_name(f"temp_aeneas_input_{int(time.time())}.txt")
        with open(temp_txt_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(sentences_text))

        aeneas_succeeded = False
        if aeneas_available:
            try:
                import json as _json
                # Step 3: Let aeneas do forced alignment, outputting a JSON sync map
                temp_json_path = output_subtitle_path.with_name(f"temp_aeneas_out_{int(time.time())}.json")
                output_subtitle_path.parent.mkdir(parents=True, exist_ok=True)

                config_string = u"task_language=zh|is_text_type=plain|os_task_file_format=json"
                task = Task(config_string=config_string)
                task.audio_file_path_absolute = str(audio_path)
                task.text_file_path_absolute = str(temp_txt_path)
                task.sync_map_file_path_absolute = str(temp_json_path)

                ExecuteTask(task).execute()
                task.output_sync_map_file()

                # Step 4: Parse the JSON output { fragments: [{begin, end, lines}] }
                with open(temp_json_path, 'r', encoding='utf-8') as f:
                    sync_data = _json.load(f)

                fragments = sync_data.get('fragments', [])
                with open(output_subtitle_path, 'w', encoding='utf-8') as f:
                    for frag in fragments:
                        begin_sec = float(frag.get('begin', 0))
                        lines = frag.get('lines', [])
                        segment_text = ' '.join(lines).strip()
                        if not segment_text:
                            continue
                        time_str = self.format_time(int(begin_sec * 1000))
                        f.write(f"[{time_str}] {segment_text}\n\n")

                if temp_json_path.exists():
                    temp_json_path.unlink()

                aeneas_succeeded = True
                print(f"Aeneas alignment written to: {output_subtitle_path}")
            except Exception as e:
                print(f"Aeneas alignment failed: {e}. Falling back to FunASR timestamps.")

        # Remove temporary aeneas text
        if temp_txt_path.exists():
            temp_txt_path.unlink()

        # If aeneas already wrote the output file, we're done
        if aeneas_succeeded:
            return output_subtitle_path

        # Fallback: use FunASR timestamps to build subtitle
        print("Aeneas is not available or failed. Using FunASR timestamps as fallback.")
        sentences = []
        if res_asr and isinstance(res_asr, list) and len(res_asr) > 0:
            result = res_asr[0]
            funasr_text = result.get('text', '')
            timestamps = result.get('timestamp', [])
            
            if not timestamps or len(timestamps) == 0:
                for s_txt in sentences_text:
                    sentences.append({"start": 0, "text": s_txt})
            else:
                # FunASR timestamps roughly match tokens. Punctuation-based reconstruction.
                punctuations = set("。！？，；,.")
                current_sentence = ""
                current_start_ms = None
                aligned_text = funasr_text.replace(" ", "")
                min_len = min(len(aligned_text), len(timestamps))
                
                for i in range(min_len):
                    char = aligned_text[i]
                    ts = timestamps[i]
                    
                    if current_start_ms is None and ts:
                        current_start_ms = ts[0]
                    
                    current_sentence += char
                    
                    if char in punctuations or i == min_len - 1:
                        sentences.append({
                            "start": current_start_ms or 0,
                            "text": current_sentence.strip()
                        })
                        current_sentence = ""
                        current_start_ms = None
        
        if not sentences:
            for s_txt in sentences_text:
                sentences.append({"start": 0, "text": s_txt})

        output_subtitle_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_subtitle_path, 'w', encoding='utf-8') as f:
            for sentence in sentences:
                if not sentence['text']:
                    continue
                time_str = self.format_time(sentence['start'])
                f.write(f"[{time_str}] {sentence['text']}\n\n")
                    
        return output_subtitle_path
