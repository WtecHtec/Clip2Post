import os
import re
import uuid
import json
import time
from typing import Optional
from pathlib import Path
from .llm_provider import LLMProvider, get_llm_provider
from .remotion_renderer import RemotionRenderer

class RemotionGenerator:
    def __init__(self, remotion_dir: Path, llm_provider: LLMProvider):
        self.remotion_dir = Path(remotion_dir).resolve()
        self.llm_provider = llm_provider
        self.dynamic_dir = self.remotion_dir / "src" / "dynamic"
        self.dynamic_dir.mkdir(parents=True, exist_ok=True)

    def extract_code(self, response: str) -> str:
        """Extracts the TSX code block from the LLM response, even if truncated."""
        # Step 0: Strip <think>...</think> blocks emitted by reasoning models (e.g. MiMo)
        response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
        stripped = response.strip()
        
        # Immediate rejection: response is an error/compiler message, not code
        # e.g. "/path/to/file.tsx:1:8: ERROR: Syntax error"
        if re.match(r'^.*?\.tsx:\d+:\d+:\s*(ERROR|WARNING|error|warning):', stripped):
            return ""
        if stripped.startswith("ERROR:") or stripped.startswith("Error:"):
            return ""
        
        # Pattern to handle potentially truncated closing backticks
        pattern = r"```(?:tsx|typescript|ts|javascript|js)?\s*\n(.*?)(?:\n```|$)"
        match = re.search(pattern, stripped, re.DOTALL)
        if match:
            content = match.group(1).strip()
            return content.rstrip("`").strip()
        
        # Fallback: manually strip leading markdown if it exists
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            if len(lines) > 1:
                return "\n".join(lines[1:]).strip().rstrip("`").strip()
        
        # Only return if it looks like code (has imports and exports)
        if "import " in stripped and "export " in stripped:
            return stripped.rstrip("`").strip()
            
        return ""

    def is_valid_tsx(self, code: str) -> bool:
        """Validates that the extracted content is actually TSX code, not an error message."""
        if not code or len(code) < 50:
            return False
        # Must have imports and exports
        if "import " not in code or "export " not in code:
            return False
        # Must not look like an error/compiler message
        if re.search(r'\.tsx:\d+:\d+:\s*(ERROR|error|WARNING|warning):', code):
            return False
        # Must start with a code-like token (import, //, or whitespace before import)
        first_line = code.lstrip().splitlines()[0] if code.strip() else ""
        if first_line and not (first_line.startswith("import") or first_line.startswith("//") or first_line.startswith("/*")):
            return False
        return True

    def cleanup_invalid_files(self):
        """Remove any previously generated tsx files that contain error messages instead of code."""
        for tsx_file in self.dynamic_dir.glob("DynamicScene-*.tsx"):
            try:
                content = tsx_file.read_text(encoding="utf-8")
                if not self.is_valid_tsx(content):
                    tsx_file.unlink()
                    # Also remove corresponding index file
                    index_file = self.dynamic_dir / f"index_{tsx_file.name}"
                    if index_file.exists():
                        index_file.unlink()
                    print(f"      Cleaned up invalid file: {tsx_file.name}")
            except Exception:
                pass

    def generate_and_render(self, user_intent: str, props: dict, output_path: str, duration_frames: int = 300, max_retries: int = 3, log_dir: Optional[str] = None, aspect_ratio: str = "9:16") -> str:
        """
        Generates a dynamic Remotion component based on user intent, and attempts to render it.
        Includes a retry mechanism for syntax or rendering errors.
        """
        # Cleanup any stale invalid files from previous runs
        self.cleanup_invalid_files()

        # Clean punctuation from captions for better subtitle aesthetics in video
        import re
        def clean_text(text):
            # Remove: , . ! ? ; : ( ) [ ] { } " ' and Chinese equivalents
            punctuation_pattern = r'[，。！？；：“”‘’（）【】\[\]\(\)\{\}\.,!?;:\"\'\-]'
            return re.sub(punctuation_pattern, '', text).strip()
            
        if "captions" in props:
            for caption in props["captions"]:
                if "text" in caption:
                    caption["text"] = clean_text(caption["text"])
        prompt_path = Path(__file__).parent / "prompts" / "remotion_developer.txt"
        with open(prompt_path, "r", encoding="utf-8") as f:
            system_prompt = f.read()
        
        # Inject aspect ratio into prompt via placeholders
        width, height = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        orientation = "Portrait / 竖屏" if aspect_ratio == "9:16" else "Landscape / 横屏"
        subtitle_placement = (
            "字幕应放置在屏幕**中下部（高度 70%-85% 处）**或**正中央**"
            if aspect_ratio == "9:16"
            else "字幕应放置在屏幕**底部（高度 80%-90% 处）**，或采用左右分栏布局"
        )
        system_prompt = (system_prompt
            .replace("{{ASPECT_RATIO}}", aspect_ratio)
            .replace("{{WIDTH}}", str(width))
            .replace("{{HEIGHT}}", str(height))
            .replace("{{ORIENTATION}}", orientation)
            .replace("{{SUBTITLE_PLACEMENT}}", subtitle_placement)
        )
        system_prompt += f"\n\nCRITICAL: The video is {aspect_ratio} ({width}x{height}). Design ALL layouts, font sizes, and element positions specifically for this resolution."
        
        user_prompt = f"""
User Intent: {user_intent}

TTS Subtitles & Timings (Use these for Sequence timing):
{json.dumps(props.get('captions', []), ensure_ascii=False, indent=2)}

Available Props (JSON):
{json.dumps(props, ensure_ascii=False, indent=2)}

Please generate the Remotion component that visualizes this intent using the provided props.
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        scene_id = f"DynamicScene-{uuid.uuid4().hex[:8]}"
        scene_filename = f"{scene_id}.tsx"
        index_filename = f"index_{scene_id}.tsx"

        scene_path = self.dynamic_dir / scene_filename
        index_path = self.dynamic_dir / index_filename

        # NEW: Save TSX path to meta.json if it exists
        # Calculate task directory from output_path (tasks/ID/videos/video.mp4 -> tasks/ID)
        output_path_obj = Path(output_path).resolve()
        task_dir_abs = output_path_obj.parent.parent
        meta_path = task_dir_abs / "user_prompt" / "meta.json"
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta_data = json.load(f)
                meta_data["dynamic_tsx_path"] = str(scene_path)
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta_data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"      [Warning] Failed to update meta.json with TSX path: {e}")

        renderer = RemotionRenderer(self.remotion_dir)
        
        # Calculate task directory from output_path (tasks/ID/videos/video.mp4 -> tasks/ID)
        output_path_obj = Path(output_path).resolve()
        task_dir = output_path_obj.parent.parent
        
        # Write the props file in the task directory
        props_path = task_dir / f"remotion_props.json"
        with open(props_path, "w", encoding="utf-8") as f:
            json.dump(props, f, ensure_ascii=False)

        current_error = None

        for attempt in range(max_retries + 1):
            print(f"      [Attempt {attempt + 1}/{max_retries + 1}] Requesting code from LLM...")
            
            try:
                response = self.llm_provider.generate(messages, log_dir=log_dir, max_completion_tokens=16384)
            except Exception as e:
                print(f"      LLM Generation failed: {e}")
                time.sleep(2)
                continue

            code = self.extract_code(response)
            if not self.is_valid_tsx(code):
                print(f"      Warning: LLM did not return valid TSX code. Response starts with: {response[:120]}...")
                current_error = "LLM did not return a valid TSX code block. Please ensure you ONLY output a ```tsx ... ``` code block containing valid TypeScript React code with proper imports and a default export."
                continue
            
            # Post-processing: Forcefully strip any Audio components or new Audio() calls 
            import re
            code = re.sub(r'<Audio\s+[^>]*/>', '', code)
            code = re.sub(r'new\s+Audio\(.*?\)', 'null', code)
            
            # Truncation logic: Improved to avoid false positives with multiple different imports
            # We look for a second "export default" or a second "import React" specifically.
            lines = code.split('\n')
            if len(lines) > 10:
                first_line = ""
                for l in lines:
                    if l.strip().startswith("import"):
                        first_line = l.strip()
                        break
                
                if first_line:
                    # Find if this exact import line appears again much later
                    first_occurrence = code.find(first_line)
                    second_occurrence = code.find(first_line, first_occurrence + len(first_line))
                    if second_occurrence != -1 and second_occurrence > len(code) // 3:
                        print(f"      Warning: Detected repeated import line. Truncating at {second_occurrence}.")
                        code = code[:second_occurrence].strip()
                
                # Also check for second "export default"
                export_marker = "export default"
                first_export = code.find(export_marker)
                if first_export != -1:
                    second_export = code.find(export_marker, first_export + len(export_marker))
                    if second_export != -1:
                        # Find the end of the previous block (usually the last '}')
                        last_brace = code.rfind('}', 0, second_export)
                        if last_brace != -1:
                            print(f"      Warning: Detected second export default. Truncating at {last_brace + 1}.")
                            code = code[:last_brace + 1].strip()
            
            # Write the generated component (only after validation passes)
            with open(scene_path, "w", encoding="utf-8") as f:
                f.write(code)

            # Write the entry point index file
            index_code = f"""
import {{ registerRoot, Composition, AbsoluteFill, Audio }} from 'remotion';
import DynamicComponent from './{scene_filename[:-4]}';

const WrapperComponent = (props: any) => {{
    return (
        <AbsoluteFill style={{{{ overflow: 'hidden', width: {width}, height: {height} }}}}>
            {{props.audioUrl && <Audio src={{props.audioUrl}} />}}
            {{props.bgm && <Audio src={{props.bgm.startsWith('http') ? props.bgm : `http://localhost:8000/bgm/${{props.bgm}}`}} volume={{0.15}} />}}
            <div style={{{{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' }}}}>
                <DynamicComponent {{...props}} />
            </div>
        </AbsoluteFill>
    );
}};

export const RemotionRoot = () => {{
    return (
        <Composition
            id="{scene_id}"
            component={{WrapperComponent}}
            durationInFrames={{{duration_frames}}}
            fps={{30}}
            width={{{width}}}
            height={{{height}}}
        />
    );
}};

registerRoot(RemotionRoot);
"""
            with open(index_path, "w", encoding="utf-8") as f:
                f.write(index_code)

            print(f"      Attempting to render {scene_id}...")
            
            try:
                # Try to render
                result_path = renderer.render(
                    props_path=str(props_path),
                    output_path=output_path,
                    duration_frames=duration_frames,
                    composition_id=scene_id,
                    entry_file=f"src/dynamic/{index_filename}"
                )
                print(f"      Successfully rendered dynamic template!")
                return result_path
            except Exception as e:
                # Usually a subprocess.CalledProcessError
                current_error = getattr(e, "stderr", str(e))
                print(f"      Render failed with error:\n{current_error}")
                
                # Check for systemic / environment errors that the LLM cannot fix
                systemic_keywords = [
                    "could not determine executable to run",
                    "command not found"
                ]
                if any(kw in current_error for kw in systemic_keywords):
                    raise RuntimeError(f"Systemic/Environment error detected during render. Aborting retry.\nError: {current_error}")

                # Sanitize error: remove file-path lines that look like code to the LLM
                sanitized_error = "\n".join(
                    line for line in current_error.splitlines()
                    if not re.match(r'^.*?\.tsx:\d+:\d+:', line)
                )
                
                # Append the error to the conversation for the next retry
                messages.append({"role": "assistant", "content": f"```tsx\n{code}\n```"})
                messages.append({
                    "role": "user", 
                    "content": f"The rendering failed with the following error:\n\n{sanitized_error}\n\n请仔细分析报错原因（例如语法错误、未定义的变量、不合法的动画参数等），根据报错信息进行修复，并返回完整的修复后的 TSX 代码文件。"
                })

        raise RuntimeError(f"Failed to generate and render valid Remotion template after {max_retries} retries. Last error: {current_error}")

