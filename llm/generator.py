import json
from pathlib import Path
from openai import OpenAI
from config.settings import OPENAI_API_KEY, OPENAI_BASE_URL, LLM_MODEL

class ArticleGenerator:
    def __init__(self):
        self.client = OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )

    def generate(self, subtitle_path: Path, output_article_path: Path, output_image_json_path: Path):
        """
        Read subtitles, call LLM to generate article and image timestamps.
        """
        with open(subtitle_path, 'r', encoding='utf-8') as f:
            subtitles = f.read()

        prompt = f"""
        你是一个专业的自媒体文章编辑。我将给你一段带有时间戳的视频字幕。
        请根据这段字幕，完成以下两个任务：

        任务1：将字幕内容改写成一篇结构完整、吸引人的图文排版文章正文（Markdown格式）。
        要求：
        - 包含一个吸引人的主标题（# 标题）
        - 段落清晰，适合阅读
        - 在你认为适合插入说明性图片的地方，加入特殊的占位符：[IMAGE_PLACEHOLDER]
        
        任务2：提取适合作为文章插图的关键画面时间点，生成一张图片截图列表。时间点格式必须为"HH:MM:SS"。对应你在文章中留出的每一处占位符。
        
        请严格按照以下JSON格式返回你的完整输出，不要包含任何Markdown代码块符号（如```json）：
        {{
            "article": "你的markdown文章内容...",
            "images": [
                {{
                    "time": "00:00:05",
                    "desc": "人物第一次出现"
                }}
            ]
        }}

        以下是视频字幕内容：
        {subtitles}
        """

        response = self.client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "你是一个严谨且富有创造力的内容编辑系统，只输出合法的纯JSON结构。"},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }
        )

        content = response.choices[0].message.content
        
        try:
            result = json.loads(content)
            article_md = result.get('article', '')
            images_json = result.get('images', [])

            with open(output_article_path, 'w', encoding='utf-8') as f:
                f.write(article_md)

            with open(output_image_json_path, 'w', encoding='utf-8') as f:
                json.dump(images_json, f, ensure_ascii=False, indent=2)
                
            return output_article_path, output_image_json_path
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM response: {content}")
            raise e
