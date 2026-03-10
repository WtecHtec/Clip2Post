import os
import urllib.request

def download_font():
    font_dir = "fonts"
    os.makedirs(font_dir, exist_ok=True)
    font_path = os.path.join(font_dir, "NotoSansSC-Bold.otf")
    
    if not os.path.exists(font_path):
        print(f"Downloading Noto Sans SC to {font_path}...")
        # Using Google Fonts Noto CJK repository for the Bold font
        url = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf"
        try:
            urllib.request.urlretrieve(url, font_path)
            print("Download completed successfully.")
        except Exception as e:
            print(f"Error downloading font: {e}")
    else:
        print(f"Font already exists at {font_path}")

if __name__ == "__main__":
    download_font()
