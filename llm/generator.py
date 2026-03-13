import json
from pathlib import Path
from openai import OpenAI
from config.settings import OPENAI_API_KEY, OPENAI_BASE_URL, LLM_MODEL

class ArticleGenerator:
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        self.api_key = api_key or OPENAI_API_KEY
        self.base_url = base_url or OPENAI_BASE_URL
        self.model = model or LLM_MODEL
        
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

    def generate(self, subtitle_path: Path, output_article_path: Path, output_image_json_path: Path, custom_prompt: str = ""):
        """
        Read subtitles, call LLM to generate article and image timestamps.
        """
        with open(subtitle_path, 'r', encoding='utf-8') as f:
            subtitles = f.read()

        custom_prompt_section = ""
        if custom_prompt.strip():
            custom_prompt_section = f"\n额外用户要求：\n{custom_prompt.strip()}\n"

        prompt = f"""
        你是一个专业的自媒体文章编辑。我将给你一段带有时间戳的视频字幕。
        请根据这段字幕，完成以下两个任务：

        任务1：将字幕内容改写成一篇结构完整、吸引人的图文排版文章正文（Markdown格式）。
        要求：
        - 包含一个吸引人的主标题（# 标题）
        - 段落清晰，适合阅读
        - 在你认为适合插入说明性图片的地方，加入特殊的占位符：[IMAGE_PLACEHOLDER]
        {custom_prompt_section}
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
            model=self.model,
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
    def generate_script(self, context_text: str, user_prompt: str) -> str:
        """
        Generate a new video script based on context and prompt.
        """
        prompt = f"""
        你是一个专业的视频脚本策划。
        {"我将给你一段视频的原始转录内容作为参考背景。" if context_text else ""}
        请根据{"这些背景以及" if context_text else ""}用户的特定要求，创作一段适合朗读的视频脚本。
        
        要求：
        - 脚本应当口语化，适合短视频表达。
        - 只输出脚本正文内容，不要包含任何多余的解释、Markdown 标记或标题。
        
        {"原始参考内容：" if context_text else ""}
        {context_text if context_text else ""}
        
        用户特定创作/改写要求：
        {user_prompt}
        """

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个专业的短视频脚本编剧，直接输出脚本文本。"},
                {"role": "user", "content": prompt}
            ]
        )

        return response.choices[0].message.content.strip()
    def match_images_to_script(self, captions: list, image_descriptions: list) -> list:
        """
        Use LLM to decide where to place images based on captions and descriptions.
        captions: [{"text": "...", "startMs": 0, "endMs": 1000}, ...]
        image_descriptions: [{"id": "img1.jpg", "desc": "description"}, ...]
        Returns: list of {src, startMs, endMs, inFlow}
        """
        prompt = f"""
        你是一个视频剪辑助手。我将给你一段视频的字幕（带时间戳）和一些图片的描述。
        请根据字幕的内容，决定把这些图片放在视频的哪个时间段。
        
        要求：
        - 图片应当出现在与描述内容最相关的字幕时间段。
        - 每张图片建议显示 2-4 秒。
        - 每张提供的图片尽量只能使用一次。
        - 优先使用 inFlow: true (作为图文混排的一部分， false 不需要图文混排)。
        
        字幕内容：
        {json.dumps(captions, ensure_ascii=False)}
        
        图片描述：
        {json.dumps(image_descriptions, ensure_ascii=False)}
        
        请严格按照以下 JSON list 格式返回结果：
        [
            {{
                "src": "图片ID/文件名",
                "startMs": 1000,
                "endMs": 4000,
                "inFlow": true
            }}
        ]
        """

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个视频剪辑专家，只输出合法的纯JSON数组。"},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" } if "gpt-4-o" in self.model or "gpt-4-turbo" in self.model else None
        )

        content = response.choices[0].message.content.strip()
        # Some models might not support json_object mode or might wrap it
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        
        try:
            # If the model returned a dict with a key, try to extract the list
            data = json.loads(content)
            if isinstance(data, dict):
                for key in data:
                    if isinstance(data[key], list):
                        return data[key]
            return data
        except:
            print(f"Failed to parse LLM image matching: {content}")
            return []
