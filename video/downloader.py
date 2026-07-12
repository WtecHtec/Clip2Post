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

    @staticmethod
    def search_and_download_pexels_video(query: str, api_key: str, output_path: Path) -> bool:
        """
        Search a video on Pexels by query and download it to output_path.
        Returns True if successful, False otherwise.
        """
        import requests
        if not api_key:
            print("Pexels API key is not configured.")
            return False
            
        url = "https://api.pexels.com/v1/videos/search"
        headers = {
            "Authorization": api_key
        }
        # We request portrait orientation specifically for vertical video format
        params = {
            "query": query,
            "per_page": 5,
            "orientation": "portrait"
        }
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
            if response.status_code != 200:
                print(f"Pexels API returned status code {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            videos = data.get("videos", [])
            
            # If no portrait videos found, try querying without orientation
            if not videos:
                params.pop("orientation", None)
                response = requests.get(url, headers=headers, params=params, timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    videos = data.get("videos", [])
                    
            if not videos:
                print(f"No videos found on Pexels for query: {query}")
                return False
                
            # Select the best video link
            video_url = None
            for video in videos:
                files = video.get("video_files", [])
                # Prioritize mp4 files
                mp4_files = [f for f in files if f.get("file_type") == "video/mp4" and f.get("link")]
                if not mp4_files:
                    continue
                    
                # Prefer HD quality or vertical-like resolutions
                hd_files = [f for f in mp4_files if f.get("quality") == "hd"]
                if hd_files:
                    video_url = hd_files[0]["link"]
                else:
                    video_url = mp4_files[0]["link"]
                    
                if video_url:
                    break
                    
            if not video_url:
                print("No valid MP4 video URL found in Pexels results.")
                return False
                
            print(f"Downloading Pexels video from: {video_url}")
            res = requests.get(video_url, stream=True, timeout=30)
            if res.status_code == 200:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    for chunk in res.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                print(f"Pexels video downloaded successfully to: {output_path}")
                return True
            else:
                print(f"Failed to download video file. Status code: {res.status_code}")
                return False
                
        except Exception as e:
            print(f"Error during Pexels API request or download: {e}")
            return False

