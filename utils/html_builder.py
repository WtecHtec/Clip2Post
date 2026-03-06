from pathlib import Path

def build_html_article(article_md_path: Path, images_data: list, output_html_path: Path):
    """
    Reads the markdown file, replaces the [IMAGE_PLACEHOLDER] string with 
    HTML image tags sequentially, and outputs the final HTML.
    """
    with open(article_md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Markdown to basic HTML (Extremely naive implementation for MVP)
    # We will simply replace the placeholders directly in the Markdown/plain text,
    # and wrap everything in a basic HTML structure. 
    # For a real implementation, we would use exactly `markdown` library.
    
    import markdown
    html_content = markdown.markdown(content)

    # Insert images
    for img in images_data:
        img_tag = f"""
        <div class="image-container">
            <img src="../images/{img['path']}" alt="{img['desc']}" style="max-width: 100%; height: auto; border-radius: 8px;">
            <p style="text-align: center; color: #666; font-size: 0.9em; margin-top: 5px;">{img['desc']}</p>
        </div>
        """
        # Replace the first occurrence of [IMAGE_PLACEHOLDER]
        html_content = html_content.replace("[IMAGE_PLACEHOLDER]", img_tag, 1)

    template = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clip2Post 生成文章</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        img {{
            display: block;
            margin: 20px auto;
        }}
        h1, h2, h3 {{
            color: #2c3e50;
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>"""

    with open(output_html_path, 'w', encoding='utf-8') as f:
        f.write(template)

    return output_html_path
