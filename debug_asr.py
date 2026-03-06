from asr.recognizer import ASRRecognizer
from pathlib import Path
import json

def test():
    print("Loading model...")
    asr = ASRRecognizer()
    audio_path = Path("/Users/shenruqi/Desktop/code/wtechtec/Clip2Post/tasks/20260306_163030_adaf/audio/audio.wav")
    
    print("\n--- Test 1: Default ---")
    res1 = asr.model.generate(input=str(audio_path))
    print(res1[0].keys())
    
    print("\n--- Test 2: sentence_timestamp=True ---")
    res2 = asr.model.generate(input=str(audio_path), sentence_timestamp=True, word_timestamp=True)
    print(res2[0].keys())

    print("\n--- Test 3: batch_size_s=300 ---")
    res3 = asr.model.generate(input=str(audio_path), batch_size_s=300)
    print(res3[0].keys())

if __name__ == '__main__':
    test()
