from pathlib import Path
import os
import json
import time
import re
from config.settings import (
    ASR_TYPE, ASR_MODEL_DIR, ASR_MODEL_REVISION, 
    VAD_MODEL, VAD_MODEL_REVISION,
    PUNC_MODEL, PUNC_MODEL_REVISION,
    WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE
)

class ASRRecognizer:
    # Class-level cache for models to avoid reloading
    _MODEL_CACHE = {}

    def __init__(self, asr_type=None):
        self.asr_type = asr_type or ASR_TYPE

    def _ensure_model_loaded(self):
        """Lazy load the model only when needed."""
        if self.asr_type not in ASRRecognizer._MODEL_CACHE:
            print(f"--- Loading ASR model: {self.asr_type} ---")
            if self.asr_type == "funasr":
                from funasr import AutoModel
                ASRRecognizer._MODEL_CACHE[self.asr_type] = AutoModel(
                    model=ASR_MODEL_DIR,
                    model_revision=ASR_MODEL_REVISION,
                    vad_model=VAD_MODEL,
                    vad_model_revision=VAD_MODEL_REVISION,
                    punc_model=PUNC_MODEL,
                    punc_model_revision=PUNC_MODEL_REVISION,
                )
            elif self.asr_type == "faster-whisper":
                from faster_whisper import WhisperModel
                ASRRecognizer._MODEL_CACHE[self.asr_type] = WhisperModel(
                    WHISPER_MODEL_SIZE, 
                    device=WHISPER_DEVICE, 
                    compute_type=WHISPER_COMPUTE_TYPE
                )
            elif self.asr_type == "whisperx":
                import whisperx
                model = whisperx.load_model(
                    WHISPER_MODEL_SIZE, 
                    device=WHISPER_DEVICE, 
                    compute_type=WHISPER_COMPUTE_TYPE
                )
                align_model, metadata = whisperx.load_align_model(
                    language_code="zh", 
                    device=WHISPER_DEVICE
                )
                ASRRecognizer._MODEL_CACHE[self.asr_type] = {
                    "model": model,
                    "align_model": align_model,
                    "metadata": metadata
                }
        else:
            print(f"--- Using cached ASR model: {self.asr_type} ---")

    def format_time(self, milliseconds: int) -> str:
        """Convert milliseconds to HH:MM:SS format."""
        if not milliseconds:
            return "00:00:00"
        seconds = int(milliseconds) // 1000
        m, s = divmod(seconds, 60)
        h, m = divmod(m, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    def recognize(self, audio_path: Path, output_subtitle_path: Path, raw_output_path: Path = None) -> Path:
        """Dispatch recognition based on asr_type with lazy loading."""
        self._ensure_model_loaded()
        if self.asr_type == "funasr":
            return self._recognize_funasr(audio_path, output_subtitle_path, raw_output_path)
        elif self.asr_type == "faster-whisper":
            return self._recognize_faster_whisper(audio_path, output_subtitle_path, raw_output_path)
        elif self.asr_type == "whisperx":
            return self._recognize_whisperx(audio_path, output_subtitle_path, raw_output_path)
        else:
            raise ValueError(f"Unsupported ASR_TYPE: {self.asr_type}")

    def _recognize_funasr(self, audio_path: Path, output_subtitle_path: Path, raw_output_path: Path = None) -> Path:
        """Original FunASR logic (updated for modern use)."""
        model = ASRRecognizer._MODEL_CACHE["funasr"]
        res_asr = model.generate(input=str(audio_path), output_timestamp=True)
        
        text = ""
        if res_asr and isinstance(res_asr, list) and len(res_asr) > 0:
            result = res_asr[0]
            text = result.get('text', '').strip()
        
        if raw_output_path:
            raw_output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(raw_output_path, 'w', encoding='utf-8') as f:
                f.write(text)

        # Fallback alignment logic (FunASR's native timestamps)
        sentences = []
        if res_asr and isinstance(res_asr, list) and len(res_asr) > 0:
            result = res_asr[0]
            funasr_text = result.get('text', '')
            timestamps = result.get('timestamp', [])
            
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

        output_subtitle_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_subtitle_path, 'w', encoding='utf-8') as f:
            for sentence in sentences:
                if not sentence['text']: continue
                time_str = self.format_time(sentence['start'])
                f.write(f"[{time_str}] {sentence['text']}\n\n")
                    
        return output_subtitle_path

    def _recognize_faster_whisper(self, audio_path: Path, output_subtitle_path: Path, raw_output_path: Path = None) -> Path:
        """Faster-Whisper implementation."""
        model = ASRRecognizer._MODEL_CACHE["faster-whisper"]
        segments, info = model.transcribe(str(audio_path), beam_size=5)
        
        full_text = []
        sentences = []
        for segment in segments:
            full_text.append(segment.text)
            sentences.append({
                "start": int(segment.start * 1000),
                "text": segment.text.strip()
            })
            
        if raw_output_path:
            raw_output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(raw_output_path, 'w', encoding='utf-8') as f:
                f.write(" ".join(full_text))

        output_subtitle_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_subtitle_path, 'w', encoding='utf-8') as f:
            for sentence in sentences:
                time_str = self.format_time(sentence['start'])
                f.write(f"[{time_str}] {sentence['text']}\n\n")
        
        return output_subtitle_path

    def _recognize_whisperx(self, audio_path: Path, output_subtitle_path: Path, raw_output_path: Path = None) -> Path:
        """WhisperX implementation with word-level alignment."""
        import whisperx
        cache = ASRRecognizer._MODEL_CACHE["whisperx"]
        model = cache["model"]
        align_model = cache["align_model"]
        metadata = cache["metadata"]
        
        audio = whisperx.load_audio(str(audio_path))
        result = model.transcribe(audio, batch_size=16)
        
        # Align whisper output
        result = whisperx.align(result["segments"], align_model, metadata, audio, WHISPER_DEVICE, return_char_alignments=False)
        
        full_text = []
        sentences = []
        for segment in result["segments"]:
            full_text.append(segment["text"])
            sentences.append({
                "start": int(segment["start"] * 1000),
                "text": segment["text"].strip()
            })
            
        if raw_output_path:
            raw_output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(raw_output_path, 'w', encoding='utf-8') as f:
                f.write(" ".join(full_text))

        output_subtitle_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_subtitle_path, 'w', encoding='utf-8') as f:
            for sentence in sentences:
                time_str = self.format_time(sentence['start'])
                f.write(f"[{time_str}] {sentence['text']}\n\n")
        
        return output_subtitle_path
