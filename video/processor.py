import ffmpeg
from pathlib import Path
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

def cut_video_segments(video_path: Path, clips: list[dict], output_dir: Path) -> list[Path]:
    """
    Cut video into segments based on the clips list.
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
            (
                ffmpeg
                .input(str(video_path), ss=start_time, to=end_time)
                .output(str(output_path), c='copy')
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            output_paths.append(output_path)
            print(f"      Saved clip: {output_path.name}")
        except ffmpeg.Error as e:
            print(f"FFmpeg error for clip {i+1}: {e.stderr.decode() if e.stderr else 'Unknown Error'}")
            # Continue with other clips even if one fails
            
    return output_paths
