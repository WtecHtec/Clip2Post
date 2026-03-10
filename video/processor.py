import ffmpeg
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import tempfile
import shutil
from config.settings import DEFAULT_AUDIO_SAMPLE_RATE, DEFAULT_AUDIO_CHANNELS

def extract_audio(video_path: Path, output_audio_path: Path) -> Path:
    """
    Extract audio from a video file and save it as WAV.
    Command equivalent: ffmpeg -i source.mp4 -ar 16000 -ac 1 audio.wav
    """
    try:
        (
            ffmpeg
            .input(str(video_path))
            .output(
                str(output_audio_path),
                acodec='pcm_s16le',
                ac=DEFAULT_AUDIO_CHANNELS,
                ar=DEFAULT_AUDIO_SAMPLE_RATE
            )
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        return output_audio_path
    except ffmpeg.Error as e:
        print(f"FFmpeg error: {e.stderr.decode()}")
        raise

def cut_video_segments(video_path: Path, clips: list[dict], output_dir: Path, add_overlay: bool = False) -> list[Path]:
    """
    Cut video into segments based on the clips list.
    Optionally, add text overlay using the 'summary' field.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    output_paths = []
    
    for i, clip in enumerate(clips):
        start_time = clip.get('start')
        end_time = clip.get('end')
        title = clip.get('title', f"clip_{i+1}")
        
        if not start_time or not end_time:
            print(f"Skipping clip {i+1} due to missing timestamps")
            continue
            
        # Clean title for filename safely
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_title = safe_title.replace(' ', '_')
        
        output_path = output_dir / f"{i+1:02d}_{safe_title}.mp4"
        
        try:
            # First, cut the video quickly (stream copy) to a temporary file
            temp_cut_video = output_dir / f"temp_{i}_cut.mp4"
            (
                ffmpeg
                .input(str(video_path), ss=start_time, to=end_time)
                .output(str(temp_cut_video), c='copy')
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )

            if add_overlay and clip.get('summary'):
                summary_text = clip['summary']
                
                # Burn text into video frames using OpenCV and Pillow
                temp_video_only = output_dir / f"temp_{i}_video_only.mp4"
                _burn_text_to_video(str(temp_cut_video), str(temp_video_only), summary_text)
                
                # Mux the original audio from temp_cut_video with the new temp_video_only
                (
                    ffmpeg
                    .output(
                        ffmpeg.input(str(temp_video_only)).video,
                        ffmpeg.input(str(temp_cut_video)).audio,
                        str(output_path),
                        vcodec='libx264',
                        pix_fmt='yuv420p',
                        acodec='copy'
                    )
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
                
                # Clean up temp files
                temp_cut_video.unlink(missing_ok=True)
                temp_video_only.unlink(missing_ok=True)
                
            else:
                # No overlay needed, just rename/move the temp cut to final output
                shutil.move(str(temp_cut_video), str(output_path))
                
            output_paths.append(output_path)
            print(f"      Saved clip: {output_path.name}")
            
        except ffmpeg.Error as e:
            print(f"FFmpeg error for clip {i+1}: {e.stderr.decode() if e.stderr else 'Unknown Error'}")
        except Exception as e:
            print(f"Error processing clip {i+1}: {e}")
            
    return output_paths

def _get_wrapped_text(text: str, font, max_width: int, draw) -> str:
    """Helper to wrap text by character width"""
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

def _burn_text_to_video(input_path: str, output_path: str, text: str):
    """
    Reads a video, burns text onto the bottom using Pillow, and writes it back.
    Doesn't handle audio.
    """
    cap = cv2.VideoCapture(input_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # type: ignore
    
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    # Use the downloaded custom font or fallback to system font
    font_path = "fonts/NotoSansSC-Bold.otf"
    try:
        # Scale font size relative to video height (e.g. 5% of height)
        font_size = max(int(height * 0.05), 30)
        font = ImageFont.truetype(font_path, font_size)
    except IOError:
        try:
            # Fallback to macOS default Chinese font
            font = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", font_size)
        except IOError:
            font = ImageFont.load_default()
        
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        # Convert CV2 BGR to RGB, then to RGBA for alpha compositing
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb).convert("RGBA")
        
        # Create an overlay image for the semi-transparent background
        overlay = Image.new("RGBA", pil_img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Calculate text wrapping
        max_text_width = int(width * 0.85)
        wrapped_text = _get_wrapped_text(text, font, max_text_width, draw)
        
        # Calculate text dimensions
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
        
        # Draw background rectangle (full width, dynamic height, 60% opacity = ~150 alpha)
        draw.rectangle(
            [0, pad_top, width, pad_top + bg_height],
            fill=(0, 0, 0, 150)
        )
        
        # Draw text fully opaque (255 alpha)
        draw.multiline_text((x, y), wrapped_text, font=font, fill=(255, 255, 255, 255), align='center')
        
        # Composite the overlay onto the original frame
        pil_img = Image.alpha_composite(pil_img, overlay)
        
        # Convert RGBA back to RGB, then to CV2 BGR
        res_frame = cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)
        out.write(res_frame)
        
    cap.release()
    out.release()
