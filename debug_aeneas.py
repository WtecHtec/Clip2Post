import sys
from pathlib import Path
from asr.recognizer import ASRRecognizer

def test_aeneas():
    print("Initializing ASR Recognizer with Aeneas support...")
    recognizer = ASRRecognizer()
    
    # Use the same audio and task folder
    audio_path = Path("/Users/shenruqi/Desktop/code/wtechtec/Clip2Post/tasks/20260306_163030_adaf/audio/audio.wav")
    output_json = Path("/Users/shenruqi/Desktop/code/wtechtec/Clip2Post/tasks/20260306_163030_adaf/subtitle/aeneas_alignment.json")
    
    print(f"Running Aeneas alignment on {audio_path.name}...")
    try:
        res_json_path = recognizer.recognize_with_aeneas(audio_path, output_json)
        print(f"Alignment successful! Data saved to: {res_json_path}")
        
        # Display some results
        import json
        with open(res_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print("\nAeneas Alignment Results Preview:")
            for item in data[:5]:
                print(f"[{item['start']}ms - {item['end']}ms] {item['text']}")
            if len(data) > 5:
                print("...")
                
    except Exception as e:
        print(f"Error during Aeneas alignment: {e}")
        print("\nNote: Please ensure 'aeneas' is fully installed in your Python environment.")

if __name__ == '__main__':
    test_aeneas()
