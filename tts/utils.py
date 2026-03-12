import re

def split_text_into_segments(text):
    """
    Split text into segments based on all punctuation to allow for natural pauses
    and manageable caption blocks.
    """
    if not text:
        return []

    # Clean text: remove newlines, tabs, and normalize quotes
    # Newlines are often the cause of TTS repetition or crashes
    text = text.replace('\r\n', ' ').replace('\n', ' ').replace('\t', ' ')
    text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text).strip()

    # Split by any punctuation: ，。！？、,.;!?
    pattern = r'[^，。！？、,.;!?]+([，。！？、,.;!?]*)'
    matches = list(re.finditer(pattern, text))
    segments = [m.group().strip() for m in matches if m.group().strip()]
    
    if not segments:
        return [text]
    
    return segments

def is_chinese(text):
    return any('\u4e00' <= c <= '\u9fff' for c in text)
