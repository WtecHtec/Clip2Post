import json
from pathlib import Path
from openai import OpenAI
from config.settings import OPENAI_API_KEY, OPENAI_BASE_URL, LLM_MODEL

class ClipGenerator:
    def __init__(self):
        self.client = OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )

    def generate(self, subtitle_path: Path, output_json_path: Path):
        """
        Read subtitles, call LLM to identify high-value clips and return start/end times.
        """
        with open(subtitle_path, 'r', encoding='utf-8') as f:
            subtitles = f.read()

        prompt = f"""
        你是一个专业的视频剪辑师和内容提炼专家。我将给你一段带有时间戳的视频字幕。
        请根据提取视频中对话内容，提炼出有深度价值的连续片段。

        要求：
        - 提炼的片段应该语义完整、具有吸引力、包含核心观点或金句。
        - 给出每个片段的起始时间戳（start）和终止时间戳（end），格式为 "HH:MM:SS"。
        - 为每个片段提供一个简短的标题（title）。
        - 为每个片段提供一段简短的自媒体运营文案或金句总结（summary），适合作为视频的醒目字幕或标题展示（约10-20字以内）。
        
        请严格按照以下JSON格式返回你的完整输出，不要包含任何Markdown代码块符号（如```json）：
        {{
            "clips": [
                {{
                    "start": "00:00:05",
                    "end": "00:01:20",
                    "title": "片段主题1",
                    "summary": "一句简短有力的金句总结或自媒体运营文案"
                }}
            ]
        }}

        以下是视频字幕内容：
        {subtitles}
        """

        response = self.client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "你是一个严谨且富有创造力的内容提炼系统，只输出合法的纯JSON结构。"},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }
        )

        content = response.choices[0].message.content
        
        try:
            result = json.loads(content)
            clips_json = result.get('clips', [])

            with open(output_json_path, 'w', encoding='utf-8') as f:
                json.dump(clips_json, f, ensure_ascii=False, indent=2)
                
            return output_json_path
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM response: {content}")
            raise e
