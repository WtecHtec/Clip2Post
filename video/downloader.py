import yt_dlp
from pathlib import Path

class VideoDownloader:
    """Handles downloading videos from URLs using yt-dlp."""
    
    @staticmethod
    def download(url: str, output_path: Path) -> Path:
        """
        Downloads the best video and audio stream from the given URL and 
        saves it to output_path.
        
        Args:
            url (str): The video URL (e.g., YouTube, Bilibili, X).
            output_path (Path): The exact file path to save the downloaded video to 
                                (e.g., Path("/tmp/source.mp4")).
        
        Returns:
            Path: The path to the downloaded video (should be output_path unless overridden).
        """
        
        ydl_opts = {
            'outtmpl': str(output_path),
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'merge_output_format': 'mp4',
            'quiet': False,
            'no_warnings': True,
        }

        print(f"Downloading video from: {url}")
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            print(f"Video downloaded successfully to: {output_path}")
            return output_path
        except Exception as e:
            raise RuntimeError(f"Failed to download video from {url}: {str(e)}")
