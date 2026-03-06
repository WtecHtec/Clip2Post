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
