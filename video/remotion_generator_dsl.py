import os
import re
import uuid
import json
import time
from typing import Optional, List, Dict, Any
from pathlib import Path
from .llm_provider import LLMProvider
from .remotion_renderer import RemotionRenderer

class RemotionGeneratorDSL:
    def __init__(self, remotion_dir: Path, llm_provider: LLMProvider, mode: str = "dsl"):
        self.remotion_dir = Path(remotion_dir).resolve()
        self.llm_provider = llm_provider
        self.dynamic_dir = self.remotion_dir / "src" / "dynamic"
        self.dynamic_dir.mkdir(parents=True, exist_ok=True)
        self.mode = mode  # "dsl" or "full_text"

    def extract_code(self, response: str) -> str:
        """Extracts code block from markdown formatting."""
        response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
        stripped = response.strip()
        
        if re.match(r'^.*?\.tsx:\d+:\d+:\s*(ERROR|WARNING|error|warning):', stripped):
            return ""
        if stripped.startswith("ERROR:") or stripped.startswith("Error:"):
            return ""
            
        pattern = r"```(?:tsx|typescript|ts|javascript|js)?\s*\n(.*?)(?:\n```|$)"
        match = re.search(pattern, stripped, re.DOTALL)
        if match:
            content = match.group(1).strip()
            return content.rstrip("`").strip()
            
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            if len(lines) > 1:
                return "\n".join(lines[1:]).strip().rstrip("`").strip()
                
        if "import " in stripped and "export " in stripped:
            return stripped.rstrip("`").strip()
            
        return ""

    def extract_json(self, response: str) -> Optional[Dict[str, Any]]:
        """Extracts JSON object from response markdown wrapper."""
        response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
        stripped = response.strip()
        
        # Match ```json ... ```
        pattern = r"```json\s*\n(.*?)(?:\n\s*```|$)"
        match = re.search(pattern, stripped, re.DOTALL)
        if match:
            content = match.group(1).strip()
        else:
            # Fallback: look for outer braces
            first_brace = stripped.find("{")
            last_brace = stripped.rfind("}")
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                content = stripped[first_brace:last_brace+1]
            else:
                content = ""
                
        if not content:
            return None
            
        try:
            return json.loads(content)
        except Exception as e:
            print(f"      [Warning] JSON Standard Parse Failed: {e}. Attempting literal cleanup...")
            # Fallback cleanup for common escape errors
            try:
                # Remove unescaped backslashes or trailing commas
                cleaned = re.sub(r',\s*([\]}])', r'\1', content)
                return json.loads(cleaned)
            except Exception:
                try:
                    import ast
                    return ast.literal_eval(content)
                except Exception:
                    return None

    def clean_markdown_block(self, r: str) -> str:
        """Strips markdown code tags and thinking blocks from the response."""
        r = re.sub(r'<think>.*?</think>', '', r, flags=re.DOTALL)
        p_json = r.find("```json")
        if p_json != -1:
            r = r[p_json + 7:]
        else:
            p_code = r.find("```")
            # Only strip prefix if it's at the very start of the text (ignoring whitespace)
            if p_code != -1:
                leading_text = r[:p_code].strip()
                if not leading_text:
                    r = r[p_code + 3:]
                
        r_stripped = r.strip()
        if r_stripped.endswith("```"):
            r_stripped = r_stripped[:-3].strip()
        return r_stripped

    def normalize_text(self, text: str) -> str:
        # Normalize quotes
        text = text.replace('"', "'").replace('`', "'")
        # Normalize whitespaces (replace all consecutive spaces/tabs/newlines with a single space)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def find_overlap_and_stitch(self, body1: str, body2: str) -> str:
        """
        Finds if body2 repeats a suffix of body1 or starts with an overlapping segment.
        Stitches them seamlessly by removing the overlap.
        """
        body1_clean = body1.strip()
        body2_clean = body2.strip()
        
        # Try different overlap lengths starting from the longest possible prefix of body2
        # we want to find a prefix B of body2 that exists in body1.
        min_overlap_len = 20
        max_search_len = min(len(body2_clean), 1500)
        
        for i in range(max_search_len, min_overlap_len - 1, -1):
            B = body2_clean[:i]
            
            # Check if B exists in body1 near the end
            search_start = max(0, len(body1_clean) - 2000)
            idx_in_body1 = body1_clean.find(B, search_start)
            
            if idx_in_body1 != -1:
                # We found a match for B in body1!
                # Let's extract C (the remainder of body1 after B) and D (the remainder of body2 after B)
                C = body1_clean[idx_in_body1 + len(B):]
                D = body2_clean[i:]
                
                # If C is empty, it's a perfect suffix match
                if not C:
                    return body1_clean[:idx_in_body1] + B + D
                    
                # If C is not empty, let's check if C is a prefix of D under loose normalization.
                C_norm = self.normalize_text(C)
                # Take prefix of D of comparable length (after normalization)
                D_norm = self.normalize_text(D[:len(C) * 2 + 50])
                
                if D_norm.startswith(C_norm) or C_norm.startswith(D_norm[:len(C_norm)]):
                    # Loose prefix match confirmed!
                    return body1_clean[:idx_in_body1] + B + D

        # Fallback to simple suffix matching if no loose overlap is found
        for i in range(min(len(body1_clean), len(body2_clean)), 0, -1):
            suffix = body1_clean[-i:]
            if body2_clean.startswith(suffix):
                return body1_clean[:-i] + body2_clean
                
        # If no overlap found, just concatenate
        return body1_clean + "\n" + body2_clean

    def stitch_responses(self, r1: str, r2: str) -> str:
        """
        Stitches together a truncated markdown response r1 with its continuation response r2.
        This looks for text within ```json blocks if present, or stitches raw text.
        """
        body1 = self.clean_markdown_block(r1)
        body2 = self.clean_markdown_block(r2)
        combined_body = self.find_overlap_and_stitch(body1, body2)
        return f"```json\n{combined_body}\n```"


    def is_valid_tsx(self, code: str) -> bool:
        """Checks if assembled TSX contains imports and export."""
        if not code or len(code) < 50:
            return False
        if "import " not in code or "export " not in code:
            return False
        if re.search(r'\.tsx:\d+:\d+:\s*(ERROR|error|WARNING|warning):', code):
            return False
        return True

    def assemble_tsx(self, chunks: List[Dict[str, str]]) -> str:
        """Assembles list of chunks into a single TSX template."""
        # Join components with double newline
        raw_code = "\n\n".join(chunk.get("content", "") for chunk in chunks)
        
        # Post-processing: Forcefully strip any Audio components or new Audio() calls
        raw_code = re.sub(r'<Audio\s+[^>]*/>', '', raw_code)
        raw_code = re.sub(r'new\s+Audio\(.*?\)', 'null', raw_code)
        
        return raw_code

    def apply_operations(self, chunks: List[Dict[str, str]], operations: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Applies DSL operations (replace, insert_before, insert_after, delete) to chunks list."""
        updated_chunks = [dict(c) for c in chunks] # Copy list and dicts
        
        for op_data in operations:
            op = op_data.get("op")
            target_id = op_data.get("targetId")
            chunk = op_data.get("chunk")
            
            if not op or not target_id:
                continue
                
            if op == "replace" and chunk:
                # Find and replace
                replaced = False
                for idx, c in enumerate(updated_chunks):
                    if c.get("chunkId") == target_id:
                        updated_chunks[idx] = chunk
                        replaced = True
                        break
                if not replaced:
                    print(f"      [Warning] TargetId '{target_id}' not found for replace. Appending instead.")
                    updated_chunks.append(chunk)
                    
            elif op == "delete":
                updated_chunks = [c for c in updated_chunks if c.get("chunkId") != target_id]
                
            elif op == "insert_before" and chunk:
                insert_idx = -1
                for idx, c in enumerate(updated_chunks):
                    if c.get("chunkId") == target_id:
                        insert_idx = idx
                        break
                if insert_idx != -1:
                    updated_chunks.insert(insert_idx, chunk)
                else:
                    updated_chunks.insert(0, chunk)
                    
            elif op == "insert_after" and chunk:
                insert_idx = -1
                for idx, c in enumerate(updated_chunks):
                    if c.get("chunkId") == target_id:
                        insert_idx = idx
                        break
                if insert_idx != -1:
                    updated_chunks.insert(insert_idx + 1, chunk)
                else:
                    updated_chunks.append(chunk)
                    
        return updated_chunks

    def cleanup_invalid_files(self):
        """Clean up invalid DynamicScene files."""
        for tsx_file in self.dynamic_dir.glob("DynamicScene-*.tsx"):
            try:
                content = tsx_file.read_text(encoding="utf-8")
                if not self.is_valid_tsx(content):
                    tsx_file.unlink()
                    index_file = self.dynamic_dir / f"index_{tsx_file.name}"
                    if index_file.exists():
                        index_file.unlink()
                    json_file = self.dynamic_dir / f"{tsx_file.stem}.json"
                    if json_file.exists():
                        json_file.unlink()
                    print(f"      Cleaned up invalid file: {tsx_file.name}")
            except Exception:
                pass

    def generate_and_render(self, user_intent: str, props: dict, output_path: str, duration_frames: int = 300, max_retries: int = 3, log_dir: Optional[str] = None, aspect_ratio: str = "9:16", messages: Optional[List[Dict[str, str]]] = None) -> str:
        """Generates dynamic Remotion templates using either DSL Chunk mode or Full-Text fallback."""
        self.cleanup_invalid_files()

        # Clean punctuation from captions
        def clean_text(text):
            punctuation_pattern = r'[，。！？；：“”‘’（）【】\[\]\(\)\{\},!?;:\"\'\-]'
            return re.sub(punctuation_pattern, '', text).strip()
            
        if "captions" in props:
            for caption in props["captions"]:
                if "text" in caption:
                    caption["text"] = clean_text(caption["text"])

        width, height = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        orientation = "Portrait / 竖屏" if aspect_ratio == "9:16" else "Landscape / 横屏"
        subtitle_placement = (
            "字幕应严格放置在屏幕**底部最下方（高度 80%-90% 处，例如 bottom: '100px' 左右）**，必须水平居中。绝对不要放置在顶部、左侧、右侧或正中央，以防遮挡中央的视频/图片内容。"
            if aspect_ratio == "9:16"
            else "字幕应严格放置在屏幕**底部最下方（高度 80%-90% 处，例如 bottom: '80px' 左右）**，必须水平居中。绝对不要放置在顶部、左侧、右侧、正中央，禁止采用分栏或偏移布局。"
        )

        output_path_obj = Path(output_path).resolve()
        task_dir = output_path_obj.parent.parent
        meta_path = task_dir / "user_prompt" / "meta.json"
        
        # Determine scene_id
        scene_id = None
        is_resume = False
        chunks_json_path = None
        
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta_data = json.load(f)
                old_tsx = meta_data.get("dynamic_tsx_path")
                if old_tsx:
                    old_path = Path(old_tsx)
                    if old_path.exists() or (self.dynamic_dir / old_path.name).exists():
                        scene_id = old_path.stem
                        
                        # Chunks state JSON path (specific to current task)
                        chunks_dir = task_dir / "chunks"
                        chunks_json_path = chunks_dir / f"{scene_id}.json"
                        
                        # Backward compatibility fallback
                        if not chunks_json_path.exists():
                            old_location = self.dynamic_dir / f"{scene_id}.json"
                            if old_location.exists():
                                chunks_json_path = old_location
                                
                        if chunks_json_path.exists():
                            is_resume = True
                            print(f"      [DSL Mode] Resuming existing scene: {scene_id} from {chunks_json_path}")
            except Exception as e:
                print(f"      [Warning] Failed to read meta.json: {e}")

        if not scene_id:
            scene_id = f"DynamicScene-{uuid.uuid4().hex[:8]}"
            chunks_dir = task_dir / "chunks"
            chunks_dir.mkdir(parents=True, exist_ok=True)
            chunks_json_path = chunks_dir / f"{scene_id}.json"
            
        if not chunks_json_path:
            chunks_dir = task_dir / "chunks"
            chunks_dir.mkdir(parents=True, exist_ok=True)
            chunks_json_path = chunks_dir / f"{scene_id}.json"


        scene_filename = f"{scene_id}.tsx"
        index_filename = f"index_{scene_id}.tsx"
        scene_path = self.dynamic_dir / scene_filename
        index_path = self.dynamic_dir / index_filename

        # Save TSX path to meta.json
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta_data = json.load(f)
                meta_data["dynamic_tsx_path"] = str(scene_path)
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta_data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"      [Warning] Failed to update meta.json: {e}")

        # Setup Remotion props and renderer
        renderer = RemotionRenderer(self.remotion_dir)
        props_path = task_dir / "remotion_props.json"
        with open(props_path, "w", encoding="utf-8") as f:
            json.dump(props, f, ensure_ascii=False)

        current_error = None
        chunks = []
        
        # Load developer DSL prompt instructions
        prompt_dsl_path = Path(__file__).parent / "prompts" / "remotion_developer_dsl.txt"
        with open(prompt_dsl_path, "r", encoding="utf-8") as f:
            system_prompt_dsl = f.read()
            
        system_prompt_dsl = (system_prompt_dsl
            .replace("{{ASPECT_RATIO}}", aspect_ratio)
            .replace("{{WIDTH}}", str(width))
            .replace("{{HEIGHT}}", str(height))
            .replace("{{ORIENTATION}}", orientation)
            .replace("{{SUBTITLE_PLACEMENT}}", subtitle_placement)
        )
        system_prompt_dsl += f"\n\nCRITICAL: The video is {aspect_ratio} ({width}x{height}). Design ALL layouts, font sizes, and element positions specifically for this resolution."

        # Load repair DSL prompt instructions
        repair_dsl_path = Path(__file__).parent / "prompts" / "remotion_repair_dsl.txt"
        with open(repair_dsl_path, "r", encoding="utf-8") as f:
            system_prompt_repair = f.read()
            
        system_prompt_repair = (system_prompt_repair
            .replace("{{ASPECT_RATIO}}", aspect_ratio)
            .replace("{{WIDTH}}", str(width))
            .replace("{{HEIGHT}}", str(height))
            .replace("{{ORIENTATION}}", orientation)
            .replace("{{SUBTITLE_PLACEMENT}}", subtitle_placement)
        )

        # Main Loop: Generation and Rendering
        last_raw_response = None
        for attempt in range(max_retries + 1):
            print(f"      [Attempt {attempt + 1}/{max_retries + 1}] Processing Remotion Generator (Mode: {self.mode})...")

            # 1. Acquire current code (either initial generation, load existing chunks, or apply patch)
            if self.mode == "dsl":
                if is_resume and chunks_json_path.exists() and attempt == 0:
                    # Resume mode: Load chunks from JSON
                    try:
                        with open(chunks_json_path, "r", encoding="utf-8") as f:
                            chunks = json.load(f)
                        code = self.assemble_tsx(chunks)
                        print(f"      Successfully loaded {len(chunks)} chunks from state storage.")
                    except Exception as e:
                        print(f"      Error loading chunks: {e}. Falling back to clean generation.")
                        is_resume = False
                
                if not chunks or (attempt > 0 and current_error):
                    # Call LLM to either generate initial chunks OR repair chunks via patch operations
                    if not chunks:
                        # Initial Generation
                        print("      Requesting initial chunks JSON structure...")
                        user_prompt = f"""
User Intent: {user_intent}

TTS Subtitles & Timings (Use these for Sequence timing):
{json.dumps(props.get('captions', []), ensure_ascii=False, indent=2)}

Available Props (JSON):
{json.dumps(props, ensure_ascii=False, indent=2)}

Please generate the Remotion component chunks structure. Remember to ONLY output the JSON object wrapped in ```json ... ``` codeblock.
"""
                        if attempt > 0 and current_error and last_raw_response:
                            messages = [
                                {"role": "system", "content": system_prompt_dsl},
                                {"role": "user", "content": user_prompt},
                                {"role": "assistant", "content": last_raw_response},
                                {"role": "user", "content": f"你返回的 JSON 解析失败，错误信息为：\n{current_error}\n\n请仔细检查 JSON 的格式和转义符（特别注意双引号、反斜杠的正确转义，并保证 JSON 被完整闭合），修复它并重新输出合法的 JSON 对象。记住只能返回用 ```json ... ``` 包裹的合法的 JSON。"}
                            ]
                        else:
                            messages = [
                                {"role": "system", "content": system_prompt_dsl},
                                {"role": "user", "content": user_prompt}
                            ]
                        
                        chunks = []
                        is_completed = False
                        gen_round = 0
                        max_rounds = 6
                        
                        while not is_completed and gen_round < max_rounds:
                            print(f"      [DSL Gen Round {gen_round + 1}] Requesting chunks from LLM...")
                            response = self.llm_provider.generate(messages, log_dir=log_dir, max_completion_tokens=16384)
                            last_raw_response = response
                            data_json = self.extract_json(response)
                            
                            # If parsing failed or required fields missing, retry once with helper dialogue
                            if not data_json or "chunks" not in data_json or "status" not in data_json:
                                print(f"      [Continual Gen] JSON parse failed or missing fields in round {gen_round + 1}. Requesting repair...")
                                temp_messages = messages + [
                                    {"role": "assistant", "content": response},
                                    {"role": "user", "content": "你返回的 JSON 无法解析，或者缺少 'status' 或 'chunks' 字段。请检查 JSON 的格式和转义，确保输出一个完整闭合、合法的 JSON 对象。记住只能返回用 ```json ... ``` 包裹的合法 JSON。"}
                                ]
                                try:
                                    response = self.llm_provider.generate(temp_messages, log_dir=log_dir, max_completion_tokens=16384)
                                    last_raw_response = response
                                    data_json = self.extract_json(response)
                                except Exception as err:
                                    print(f"      JSON repair request failed: {err}")
                                    
                            if not data_json or "chunks" not in data_json or "status" not in data_json:
                                print("      Warning: LLM response did not contain valid chunks package JSON in this round.")
                                detailed_err = "Response did not match JSON chunks schema."
                                current_error = detailed_err
                                break
                            
                            new_chunks = data_json["chunks"]
                            status_val = data_json["status"]
                            is_completed = status_val.get("isCompleted", True)
                            next_chunk_id = status_val.get("nextRequiredChunkId")
                            
                            # Merge chunks: keep unique chunkIds, overwrite/append
                            existing_chunk_ids = {c["chunkId"] for c in chunks}
                            for nc in new_chunks:
                                if nc["chunkId"] not in existing_chunk_ids:
                                    chunks.append(nc)
                                    existing_chunk_ids.add(nc["chunkId"])
                                else:
                                    for idx, oc in enumerate(chunks):
                                        if oc["chunkId"] == nc["chunkId"]:
                                            chunks[idx] = nc
                                            break
                            
                            print(f"      Round {gen_round + 1} succeeded. Received {len(new_chunks)} chunks. Total accumulated chunks: {len(chunks)}.")
                            
                            # Save attempt/chunks after each round so progress is captured
                            attempt_json_path = chunks_json_path.parent / f"{scene_id}_attempt_{attempt}.json"
                            attempt_json_path.parent.mkdir(parents=True, exist_ok=True)
                            with open(attempt_json_path, "w", encoding="utf-8") as f:
                                json.dump(chunks, f, ensure_ascii=False, indent=2)
                                
                            with open(chunks_json_path, "w", encoding="utf-8") as f:
                                json.dump(chunks, f, ensure_ascii=False, indent=2)
                                
                            if is_completed:
                                break
                                
                            # If not completed, prepare for next round
                            messages.append({"role": "assistant", "content": response})
                            messages.append({
                                "role": "user",
                                "content": f"已经成功接收并保存了以下 chunks: {list(existing_chunk_ids)}。\n\n请继续生成下一个/下一批 chunks，从 '{next_chunk_id}' 开始。\n注意：\n1. 绝对不要重复生成任何已经保存的 chunks（如 imports、helpers 等已经生成的 chunks）。\n2. 必须输出完整闭合、合法的 JSON，将 'status.isCompleted' 设置为 false，并指定下一个需要生成的 'status.nextRequiredChunkId'。如果是最后一个 chunk，设置 'status.isCompleted' 为 true，'status.nextRequiredChunkId' 为 null。\n3. 只能返回由 ```json ... ``` 包裹的合法 JSON。"
                            })
                            gen_round += 1
                        
                        if not is_completed or not chunks:
                            continue
                        
                        code = self.assemble_tsx(chunks)
                    else:
                        # Repair Mode: Request patching operations
                        print(f"      Requesting repair patch operations for compile/runtime error...")
                        
                        # Serialize current chunks to feed to LLM
                        serialized_chunks = json.dumps(chunks, ensure_ascii=False, indent=2)
                        
                        repair_messages = [
                            {"role": "system", "content": system_prompt_repair},
                            {"role": "user", "content": f"Here is the current code chunks state of the Remotion component:\n\n```json\n{serialized_chunks}\n```\n\nThe compilation/rendering failed with the following error:\n\n{current_error}\n\nPlease analyze the error, and return the operations JSON block to repair it. Remember to ONLY output the JSON object wrapped in ```json ... ``` codeblock."}
                        ]
                        
                        response = self.llm_provider.generate(repair_messages, log_dir=log_dir, max_completion_tokens=16384)
                        ops_json = self.extract_json(response)
                        
                        # Continual dialogue to stitch truncated JSON response
                        continue_count = 0
                        while (not ops_json or "operations" not in ops_json) and continue_count < 3:
                            print(f"      [Continual Gen] Operations JSON parse failed. Attempting multi-turn continuation {continue_count + 1}/3...")
                            repair_messages.append({"role": "assistant", "content": response})
                            repair_messages.append({
                                "role": "user",
                                "content": "你刚才的 JSON 输出被截断了，请接着刚才截断的地方起，继续输出剩余的 JSON 内容。请务必只输出剩余 of JSON 内容，不要重复前面的任何内容，并最终以 ``` 闭合。"
                            })
                            try:
                                next_response = self.llm_provider.generate(repair_messages, log_dir=log_dir, max_completion_tokens=16384)
                                response = self.stitch_responses(response, next_response)
                                ops_json = self.extract_json(response)
                            except Exception as continue_err:
                                print(f"      Continual generation failed: {continue_err}")
                                break
                            continue_count += 1
                        
                        # Save operations to attempt-specific file immediately
                        raw_ops_str = ""
                        response_clean = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL).strip()
                        pattern = r"```json\s*\n(.*?)(?:\n\s*```|$)"
                        match = re.search(pattern, response_clean, re.DOTALL)
                        if match:
                            raw_ops_str = match.group(1).strip()
                        else:
                            raw_ops_str = response_clean
                        
                        attempt_ops_path = chunks_json_path.parent / f"{scene_id}_operations_attempt_{attempt}.json"
                        attempt_ops_path.parent.mkdir(parents=True, exist_ok=True)
                        try:
                            parsed_ops = json.loads(raw_ops_str)
                            with open(attempt_ops_path, "w", encoding="utf-8") as f:
                                json.dump(parsed_ops, f, ensure_ascii=False, indent=2)
                        except Exception:
                            with open(attempt_ops_path, "w", encoding="utf-8") as f:
                                f.write(raw_ops_str)

                        if not ops_json or "operations" not in ops_json:
                            print("      Warning: LLM response did not contain valid operations JSON.")
                            current_error = "Could not parse patch operations JSON."
                            continue
                            
                        # Apply operations to chunks
                        ops = ops_json["operations"]
                        print(f"      Applying {len(ops)} patch operations to chunks list...")
                        chunks = self.apply_operations(chunks, ops)
                        
                        # Save new state
                        chunks_json_path.parent.mkdir(parents=True, exist_ok=True)
                        with open(chunks_json_path, "w", encoding="utf-8") as f:
                            json.dump(chunks, f, ensure_ascii=False, indent=2)
                            
                        attempt_json_path = chunks_json_path.parent / f"{scene_id}_attempt_{attempt}.json"
                        with open(attempt_json_path, "w", encoding="utf-8") as f:
                            json.dump(chunks, f, ensure_ascii=False, indent=2)
                            
                        code = self.assemble_tsx(chunks)
            else:
                # Full Text Fallback Mode: Generate entire file as before
                if not messages:
                    prompt_path = Path(__file__).parent / "prompts" / "remotion_developer.txt"
                    with open(prompt_path, "r", encoding="utf-8") as f:
                        system_prompt_full = f.read()
                        
                    system_prompt_full = (system_prompt_full
                        .replace("{{ASPECT_RATIO}}", aspect_ratio)
                        .replace("{{WIDTH}}", str(width))
                        .replace("{{HEIGHT}}", str(height))
                        .replace("{{ORIENTATION}}", orientation)
                        .replace("{{SUBTITLE_PLACEMENT}}", subtitle_placement)
                    )
                    system_prompt_full += f"\n\nCRITICAL: The video is {aspect_ratio} ({width}x{height}). Design ALL layouts, font sizes, and element positions specifically for this resolution."
                    
                    user_prompt_full = f"""
User Intent: {user_intent}

TTS Subtitles & Timings (Use these for Sequence timing):
{json.dumps(props.get('captions', []), ensure_ascii=False, indent=2)}

Available Props (JSON):
{json.dumps(props, ensure_ascii=False, indent=2)}

Please generate the Remotion component. Output the full valid TSX code file wrapped in a ```tsx ... ``` code block.
"""
                    messages = [
                        {"role": "system", "content": system_prompt_full},
                        {"role": "user", "content": user_prompt_full}
                    ]
                
                try:
                    response = self.llm_provider.generate(messages, log_dir=log_dir, max_completion_tokens=16384)
                except Exception as e:
                    print(f"      LLM Generation failed: {e}")
                    current_error = str(e)
                    time.sleep(2)
                    continue

                code = self.extract_code(response)
                
            # 2. Write the TSX file and index entry point
            if not self.is_valid_tsx(code):
                print(f"      Warning: Assembled code is not valid TSX.")
                current_error = "The generated code is missing imports or exports. Please output valid React component code."
                continue
                
            with open(scene_path, "w", encoding="utf-8") as f:
                f.write(code)

            # Write index path
            index_code = f"""
import {{ registerRoot, Composition, AbsoluteFill, Audio }} from 'remotion';
import DynamicComponent from './{scene_filename[:-4]}';

const WrapperComponent = (props: any) => {{
    return (
        <AbsoluteFill style={{{{ overflow: 'hidden', width: {width}, height: {height} }}}}>
            {{props.audioUrl && <Audio src={{props.audioUrl}} />}}
            {{props.bgm && <Audio src={{props.bgm.startsWith('http') ? props.bgm : `127.0.0.1:8000/bgm/${{props.bgm}}`}} volume={{0.15}} />}}
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

            # 3. Attempt to render
            print(f"      Attempting to render {scene_id}...")
            try:
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
                current_error = getattr(e, "stderr", str(e))
                print(f"      Render failed with error:\n{current_error}")
                
                # Check for environment issues
                systemic_keywords = ["could not determine executable to run", "command not found"]
                if any(kw in current_error for kw in systemic_keywords):
                    raise RuntimeError(f"Systemic/Environment error: {current_error}")

                # Sanitize error output
                sanitized_error = "\n".join(
                    line for line in current_error.splitlines()
                    if not re.match(r'^.*?\.tsx:\d+:\d+:', line)
                )
                
                # If we are in full text mode, append message history
                if self.mode != "dsl":
                    messages.append({"role": "assistant", "content": f"```tsx\n{code}\n```"})
                    messages.append({
                        "role": "user", 
                        "content": f"The rendering failed with the following error:\n\n{sanitized_error}\n\n请仔细分析报错原因并修复，返回完整的修复后的 TSX 代码文件。"
                    })
                else:
                    # In DSL mode, we save sanitized error to feed to repair prompt in next loop
                    current_error = sanitized_error

        # If we got here, all retries failed.
        print("      [Error] ALL retries exhausted. Leaving failed template at destination and raising error.")
        raise RuntimeError(f"Failed to generate and render valid Remotion template after {max_retries + 1} attempts. Last error: {current_error}")

