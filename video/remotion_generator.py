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
        # Pattern to handle potentially truncated closing backticks
        pattern = r"```(?:tsx|typescript|ts|javascript|js)?\s*\n(.*?)(?:\n```|$)"
        match = re.search(pattern, response, re.DOTALL)
        if match:
            content = match.group(1).strip()
            # If the content itself still ends with ```, strip it (unlikely but safe)
            return content.rstrip("`").strip()
        
        # Fallback: manually strip leading markdown if it exists
        clean_response = response.strip()
        if clean_response.startswith("```"):
            lines = clean_response.splitlines()
            if len(lines) > 1:
                return "\n".join(lines[1:]).strip().rstrip("`").strip()
        
        return clean_response.rstrip("`").strip()

    def generate_and_render(self, user_intent: str, props: dict, output_path: str, duration_frames: int = 300, max_retries: int = 3, log_dir: Optional[str] = None, aspect_ratio: str = "9:16") -> str:
        """
        Generates a dynamic Remotion component based on user intent, and attempts to render it.
        Includes a retry mechanism for syntax or rendering errors.
        """
        prompt_path = Path(__file__).parent / "prompts" / "remotion_developer.txt"
        with open(prompt_path, "r", encoding="utf-8") as f:
            system_prompt = f.read()
        
        # Adjust prompt based on aspect ratio
        width, height = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        system_prompt = system_prompt.replace("9:16 (1080x1920)", f"{aspect_ratio} ({width}x{height})")
        system_prompt = system_prompt.replace("9:16", aspect_ratio)
        system_prompt += f"\n\nCRITICAL: The video aspect ratio is {aspect_ratio} ({width}x{height}). Ensure all layouts and typography are optimized for this specific ratio."
        
        user_prompt = f"""
User Intent: {user_intent}

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

        renderer = RemotionRenderer(self.remotion_dir)
        
        # Write the props file
        props_path = self.remotion_dir / f"public/{scene_id}_props.json"
        with open(props_path, "w", encoding="utf-8") as f:
            json.dump(props, f, ensure_ascii=False)

        current_error = None

        for attempt in range(max_retries):
            print(f"      [Attempt {attempt + 1}/{max_retries}] Requesting code from LLM...")
            
            try:
                response = self.llm_provider.generate(messages, log_dir=log_dir, max_completion_tokens=16384)
            except Exception as e:
                print(f"      LLM Generation failed: {e}")
                time.sleep(2)
                continue

            code = self.extract_code(response)
            
            # Write the generated component
            with open(scene_path, "w", encoding="utf-8") as f:
                f.write(code)

            # Write the entry point index file
            index_code = f"""
import {{ registerRoot, Composition, AbsoluteFill, Audio, staticFile }} from 'remotion';
import DynamicComponent from './{scene_filename[:-4]}';

const WrapperComponent = (props: any) => {{
    return (
        <AbsoluteFill>
            {{props.audioUrl && <Audio src={{staticFile(props.audioUrl)}} />}}
            {{props.bgm && <Audio src={{props.bgm.startsWith('http') ? props.bgm : staticFile(`bgm/${{props.bgm}}`)}} volume={{0.15}} />}}
            <DynamicComponent {{...props}} />
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

                # Append the error to the conversation for the next retry
                messages.append({"role": "assistant", "content": f"```tsx\n{code}\n```"})
                messages.append({
                    "role": "user", 
                    "content": f"The rendering failed with the following error:\n\n{current_error}\n\n请仔细分析报错原因（例如语法错误、未定义的变量、不合法的动画参数等），根据报错信息进行修复，并返回完整的修复后的 TSX 代码文件。"
                })

        raise RuntimeError(f"Failed to generate and render valid Remotion template after {max_retries} retries. Last error: {current_error}")

