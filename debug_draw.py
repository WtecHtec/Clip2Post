import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def get_wrapped_text(text, font, max_width, draw):
    lines = []
    current_line = ""
    for char in text:
        test_line = current_line + char
        try:
            w = draw.textbbox((0, 0), test_line, font=font)[2]
        except AttributeError:
            w = draw.textsize(test_line, font=font)[0]
            
        if w <= max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = char
    if current_line:
        lines.append(current_line)
    return "\n".join(lines)

def test_draw():
    # Create a dummy image (e.g. 1080x1920 vertical video)
    width, height = 1080, 1920
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Convert CV2 BGR to RGB, then to RGBA for alpha compositing
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb).convert("RGBA")
    
    # Create an overlay image with the same size, transparent background
    overlay = Image.new("RGBA", pil_img.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    
    # Use the downloaded font
    font_path = "fonts/NotoSansSC-Bold.otf"
    
    # Make font bigger for better readability
    font_size = max(int(height * 0.05), 40)
    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        font = ImageFont.load_default()
    
    text = "这是一句用来测试长文本居中和换行的金句，稍微多写一些字看看效果"
    
    # Wrap text to 80% of screen width
    wrapped_text = get_wrapped_text(text, font, int(width * 0.8), draw)
    
    try:
        bbox = draw.multiline_textbbox((0, 0), wrapped_text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        text_w, text_h = draw.textsize(wrapped_text, font=font)

    x = (width - text_w) // 2
    
    # Padding and background calculations
    pad_y = 40  # Padding around text
    pad_top = 80 # Extra padding from the very top of the screen
    bg_height = text_h + pad_y * 2
    
    y = pad_top + pad_y
    
    # Full-width background rectangle at the top with 50% transparency (128 alpha)
    draw.rectangle(
        [0, pad_top, width, pad_top + bg_height],
        fill=(0, 0, 0, 128)
    )
    
    draw.multiline_text((x, y), wrapped_text, font=font, fill=(255, 255, 255, 255), align='center')
    
    # Composite the overlay onto the original image
    pil_img = Image.alpha_composite(pil_img, overlay)
    
    # Convert RGBA back to RGB, then to CV2 BGR
    res_frame = cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)
    cv2.imwrite("test_frame.jpg", res_frame)
    print(f"Frame width: {width}, height: {height}")
    print(f"Text width: {text_w}, height: {text_h}, x: {x}, y: {y}")

test_draw()
