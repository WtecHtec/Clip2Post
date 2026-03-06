from funasr import AutoModel
import sys
from pathlib import Path

def test():
    print("Initializing FA model...")
    fa_model = AutoModel(model="fa-zh", model_revision="v2.0.4")
    
    audio_path = "/Users/shenruqi/Desktop/code/wtechtec/Clip2Post/tasks/20260306_163030_adaf/audio/audio.wav"
    text = "呃，我已经不年轻了，他说但是感觉还很年轻，所以给年轻人一些一些建议哈。一个呢就是说这个嗯要管好自己的现金流，不要让自己负债好吧，不要亏损，不要亏。就是人生刚刚开始，你要现在一负负上债的话，你真的是这辈子很难翻身。在在这个阶段能把现金流管好，不要增加特别高杠杆的这种负债，如果这样子去做的话有可能能攒下一笔积蓄。如果能挣到钱，如果挣不到钱千万不要轻易负债，不要借各种花呗借呗所有的这些东西千万不要借。我觉得这个是很很关键因为一旦信誉没有了这辈子就完了。"
    
    # Save text to a temp file
    txt_path = "temp_text.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(text)
        
    print("Running alignment...")
    res = fa_model.generate(input=(audio_path, txt_path), data_type=("sound", "text"))
    print(res)

if __name__ == '__main__':
    test()
