#!/usr/bin/env python3
"""
Generate Chinese visual prompts from arbitrary content and render images with DashScope.

Workflow:
1. Load a built-in preset that defines protocol + style supplement.
2. Optionally append an external style file or ad-hoc style hint.
3. Infer a stable image_generation_prompt via DashScope text model.
4. Render the image with qwen-image-2.0-pro.
5. Download the generated image to local disk.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from urllib import error, parse, request


DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com"
TEXT_GEN_ENDPOINT = "/api/v1/services/aigc/text-generation/generation"
IMAGE_GEN_ENDPOINT = "/api/v1/services/aigc/multimodal-generation/generation"
TASK_ENDPOINT = "/api/v1/tasks/{task_id}"

DEFAULT_NEGATIVE_PROMPT = (
    "低分辨率，低画质，文字模糊，中文乱码，排版拥挤，构图混乱，说明文字重叠，"
    "边框厚重，视觉层级混乱，肢体畸形，手指畸形，画面过饱和，蜡像感，"
    "人脸无细节，过度光滑，画面具有AI感。"
)

QWEN_IMAGE_20_MIN_PIXELS = 512 * 512
QWEN_IMAGE_20_MAX_PIXELS = 2048 * 2048

BUILTIN_PRESETS = {
    "default": {
        "meta_prompt": "references/meta-prompts-frosted-whiteboard.md",
        "style": "references/styles/frosted-whiteboard.md",
        "label": "默认白色磁吸板书",
    },
    "clean-editorial": {
        "meta_prompt": "references/meta-prompt.md",
        "style": "references/styles/clean-editorial.md",
        "label": "信息图编辑排版",
    },
    "comic-story": {
        "meta_prompt": "references/meta-prompts-comic-story.md",
        "style": "references/styles/comic-story.md",
        "label": "新中式漫画故事",
    },
    "spatial-gallery": {
        "meta_prompt": "references/meta-prompts-spatial-gallery.md",
        "style": "references/styles/spatial-gallery.md",
        "label": "空间化画廊信息图",
    },
    "frosted-whiteboard": {
        "meta_prompt": "references/meta-prompts-frosted-whiteboard.md",
        "style": "references/styles/frosted-whiteboard.md",
        "label": "毛玻璃白板手写图",
    },
}

SUCCESS_STATES = {"SUCCEEDED", "SUCCESS", "COMPLETED"}
FAILED_STATES = {"FAILED", "ERROR", "CANCELED", "CANCELLED"}


def fail(message: str, code: int = 1) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(code)


def sanitize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def read_text_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")


def collect_source_material(args: argparse.Namespace) -> str:
    sections = []
    if args.topic:
        sections.append(f"[主题]\n{args.topic.strip()}")
    if args.text:
        sections.append(f"[正文]\n{args.text.strip()}")
    if args.text_file:
        text_path = Path(args.text_file).expanduser().resolve()
        if not text_path.exists():
            fail(f"text file not found: {text_path}")
        sections.append(f"[文件正文]\n{read_text_file(text_path).strip()}")

    if not sections:
        fail("provide at least one of --topic / --text / --text-file")

    merged = sanitize_text("\n\n".join(sections))
    if len(merged) > args.max_input_chars:
        merged = merged[: args.max_input_chars]
    return merged


def skill_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_reference(path: Path, label: str) -> str:
    if not path.exists():
        fail(f"missing {label}: {path}")
    text = read_text_file(path).strip()
    if not text:
        fail(f"empty {label}: {path}")
    return text


def choose_builtin_preset(requested_preset: str) -> str:
    requested = requested_preset.strip()
    if not requested:
        return "default"
    if requested != "random":
        if requested not in BUILTIN_PRESETS:
            available = ", ".join(sorted(BUILTIN_PRESETS))
            fail(f"unknown style preset: {requested}. available presets: {available}")
        return requested
    return random.choice(sorted(BUILTIN_PRESETS))


def load_preset_bundle(args: argparse.Namespace) -> Dict[str, str]:
    preset_name = choose_builtin_preset(args.style_preset)
    preset = BUILTIN_PRESETS[preset_name]

    meta_prompt = load_reference(skill_root() / preset["meta_prompt"], "meta prompt")
    style_parts = [load_reference(skill_root() / preset["style"], "style preset")]

    if args.style_file:
        style_path = Path(args.style_file).expanduser().resolve()
        style_parts.append(load_reference(style_path, "style file"))
    if args.style_hint.strip():
        style_parts.append(f"# Ad-hoc Style Hint\n\n{args.style_hint.strip()}")

    style_text = "\n\n".join(part.strip() for part in style_parts if part.strip())
    return {
        "preset_name": preset_name,
        "preset_label": preset["label"],
        "meta_prompt": meta_prompt,
        "style_text": style_text,
    }


def dashscope_headers(api_key: str) -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }


def dashscope_request(
    method: str,
    endpoint: str,
    api_key: str,
    payload: Optional[Dict[str, Any]] = None,
    timeout: int = 120,
) -> Dict[str, Any]:
    url = f"{DASHSCOPE_BASE_URL}{endpoint}"
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    req = request.Request(
        url=url,
        data=body,
        headers=dashscope_headers(api_key),
        method=method,
    )

    try:
        with request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"HTTP {exc.code} {exc.reason} while calling {endpoint}: {body_text}"
        ) from exc
    except error.URLError as exc:
        raise RuntimeError(f"network error while calling {endpoint}: {exc.reason}") from exc

    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"invalid JSON response from {endpoint}: {raw[:600]}") from exc


def content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        for key in ("text", "content", "message"):
            value = content.get(key)
            if isinstance(value, str):
                return value
        return ""
    if isinstance(content, list):
        chunks = []
        for item in content:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str):
                    chunks.append(text_value)
        return "\n".join(chunks)
    return ""


def extract_assistant_text(resp: Dict[str, Any]) -> str:
    output = resp.get("output")
    if isinstance(output, dict):
        choices = output.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                text = content_to_text(message)
                if text:
                    return text.strip()

        text = output.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()

    root_text = resp.get("text")
    if isinstance(root_text, str) and root_text.strip():
        return root_text.strip()
    return ""


def extract_json_block(text: str) -> Optional[Dict[str, Any]]:
    candidates = []
    fenced = re.findall(r"```(?:json)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE)
    candidates.extend(fenced)
    candidates.append(text)

    for candidate in candidates:
        candidate = candidate.strip()
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        left = candidate.find("{")
        right = candidate.rfind("}")
        if left == -1 or right == -1 or right <= left:
            continue
        snippet = candidate[left : right + 1]
        try:
            parsed = json.loads(snippet)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    return None


def build_inference_messages(
    source_material: str,
    meta_prompt: str,
    style_text: str,
    use_case: str,
    size: str,
) -> Dict[str, str]:
    system_instruction = (
        "你是资深中文视觉叙事设计师与提示词工程师。"
        "你必须严格遵守用户提供的协议，只输出单个 JSON 对象。"
        "禁止输出 markdown、解释、分析过程或额外字段。"
    )

    user_instruction = (
        "请根据下面的元协议，把输入内容压缩为稳定的中文视觉生图提示词。\n\n"
        f"[用途]\n{use_case}\n\n"
        f"[目标尺寸]\n{size}\n\n"
        f"[元协议]\n{meta_prompt}\n\n"
        f"[风格补充]\n{style_text}\n\n"
        f"[输入内容]\n{source_material}"
    )
    return {"system": system_instruction, "user": user_instruction}


def infer_prompt(
    api_key: str,
    prompt_model: str,
    source_material: str,
    meta_prompt: str,
    style_text: str,
    use_case: str,
    size: str,
) -> Dict[str, str]:
    messages = build_inference_messages(
        source_material=source_material,
        meta_prompt=meta_prompt,
        style_text=style_text,
        use_case=use_case,
        size=size,
    )
    payload = {
        "model": prompt_model,
        "input": {
            "messages": [
                {"role": "system", "content": messages["system"]},
                {"role": "user", "content": messages["user"]},
            ]
        },
        "parameters": {
            "result_format": "message",
            "temperature": 0.2,
        },
    }

    resp = dashscope_request("POST", TEXT_GEN_ENDPOINT, api_key, payload=payload)
    assistant_text = extract_assistant_text(resp)
    parsed = extract_json_block(assistant_text)
    if not parsed:
        raise RuntimeError("prompt model returned non-JSON content")

    prompt = parsed.get("image_generation_prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise RuntimeError("image_generation_prompt is empty")

    negative_prompt = parsed.get("negative_prompt", DEFAULT_NEGATIVE_PROMPT)
    if not isinstance(negative_prompt, str) or not negative_prompt.strip():
        negative_prompt = DEFAULT_NEGATIVE_PROMPT

    brief_reasoning = parsed.get("brief_reasoning", "")
    if not isinstance(brief_reasoning, str):
        brief_reasoning = ""

    return {
        "image_generation_prompt": prompt.strip(),
        "negative_prompt": negative_prompt.strip(),
        "brief_reasoning": brief_reasoning.strip(),
    }


def fallback_prompt(
    source_material: str,
    style_text: str,
    use_case: str,
    preset_name: str,
) -> Dict[str, str]:
    summary = source_material[:260]
    style_summary = sanitize_text(style_text[:220])

    if preset_name == "comic-story":
        prompt = (
            f"一张新中式手绘漫画故事长图，用于{use_case}。"
            "顶部设置中文主标题与副标题，整体按自上而下阅读顺序拆为2到3个章节，"
            "每章横向串联2到3个连续故事，每个故事带3到8个汉字标题和15到20个汉字剧情描述，"
            "利用卷轴、云带、远山、古建筑、丝带路径等元素串联情节，"
            f"内容主题围绕：{summary}。"
            f"风格补充：{style_summary}。"
            "采用Q版新中式手绘与轻微水粉质感，米色格纹纸底，中文必须清晰可读，"
            "不要厚重边框，不要Logo，不要真实人像，不要文字模糊或排版孤岛。"
        )
        reasoning = "推理失败，使用内置漫画故事模板兜底。"
    else:
        prompt = (
            f"一张布局合理的中文信息图，用于{use_case}。"
            "顶部设置醒目的中文标题与副标题，中部以最适合内容的中心结构组织4到6个核心模块，"
            "每个模块都配有2到6个汉字的短标题与15到25个汉字的中文解释句，"
            "背景区补充问题上下文，底部可选放置简短结论或指标。"
            f"内容主题围绕：{summary}。"
            f"风格补充：{style_summary}。"
            "整体信息密度高但不拥挤，不使用厚重边框，依靠留白、对齐、箭头、圈注和轻量图标组织信息，"
            "中文必须清晰可读，不贴边，不要Logo，不要真实人像，不要文字模糊或排版混乱。"
        )
        reasoning = "推理失败，使用内置信息图模板兜底。"

    return {
        "image_generation_prompt": prompt,
        "negative_prompt": DEFAULT_NEGATIVE_PROMPT,
        "brief_reasoning": reasoning,
    }


def deep_find_first_url(node: Any) -> Optional[str]:
    if isinstance(node, str):
        if node.startswith("http://") or node.startswith("https://"):
            return node
        return None
    if isinstance(node, list):
        for item in node:
            url = deep_find_first_url(item)
            if url:
                return url
        return None
    if isinstance(node, dict):
        for key, value in node.items():
            if "url" in key.lower() and isinstance(value, str):
                if value.startswith("http://") or value.startswith("https://"):
                    return value
            url = deep_find_first_url(value)
            if url:
                return url
    return None


def deep_find_key(node: Any, target_key: str) -> Optional[Any]:
    if isinstance(node, dict):
        for key, value in node.items():
            if key == target_key:
                return value
            found = deep_find_key(value, target_key)
            if found is not None:
                return found
    if isinstance(node, list):
        for item in node:
            found = deep_find_key(item, target_key)
            if found is not None:
                return found
    return None


def get_task_status(resp: Dict[str, Any]) -> Optional[str]:
    status = deep_find_key(resp, "task_status")
    if isinstance(status, str):
        return status.upper()
    status = deep_find_key(resp, "status")
    if isinstance(status, str):
        return status.upper()
    return None


def poll_task_for_image_url(
    api_key: str,
    task_id: str,
    max_wait_seconds: int,
    poll_interval_seconds: int,
) -> str:
    start = time.time()
    while True:
        resp = dashscope_request(
            "GET",
            TASK_ENDPOINT.format(task_id=task_id),
            api_key,
            payload=None,
        )

        image_url = deep_find_first_url(resp)
        if image_url:
            return image_url

        status = get_task_status(resp)
        if status in SUCCESS_STATES:
            raise RuntimeError(
                f"task {task_id} succeeded but no image URL found in response"
            )
        if status in FAILED_STATES:
            raise RuntimeError(f"task {task_id} failed with status={status}")
        if time.time() - start > max_wait_seconds:
            raise RuntimeError(f"timeout waiting task {task_id} after {max_wait_seconds}s")

        time.sleep(poll_interval_seconds)


def infer_file_suffix_from_url(image_url: str) -> str:
    path = parse.urlparse(image_url).path
    suffix = Path(path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return suffix
    return ".png"


def resolve_output_path(output: str, image_url: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = infer_file_suffix_from_url(image_url)
    default_name = f"infographic_{timestamp}{suffix}"

    if not output:
        out = skill_root() / "output" / default_name
        out.parent.mkdir(parents=True, exist_ok=True)
        return out

    out_path = Path(output).expanduser()
    if out_path.exists() and out_path.is_dir():
        out = out_path / default_name
        out.parent.mkdir(parents=True, exist_ok=True)
        return out

    if not out_path.suffix:
        out = out_path / default_name
        out.parent.mkdir(parents=True, exist_ok=True)
        return out

    out_path.parent.mkdir(parents=True, exist_ok=True)
    return out_path


def download_file(url: str, output_path: Path, timeout: int = 120) -> None:
    req = request.Request(url=url, method="GET")
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
    except Exception as exc:
        raise RuntimeError(f"failed to download image: {exc}") from exc

    output_path.write_bytes(data)


def write_prompt_output(path_text: str, payload: Dict[str, Any]) -> Path:
    output_path = Path(path_text).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path


def generate_image(
    api_key: str,
    image_model: str,
    prompt: str,
    negative_prompt: str,
    size: str,
    prompt_extend: bool,
    watermark: bool,
    max_wait_seconds: int,
    poll_interval_seconds: int,
) -> str:
    payload = {
        "model": image_model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ]
        },
        "parameters": {
            "negative_prompt": negative_prompt,
            "prompt_extend": prompt_extend,
            "watermark": watermark,
            "size": size,
        },
    }

    resp = dashscope_request("POST", IMAGE_GEN_ENDPOINT, api_key, payload=payload)
    image_url = deep_find_first_url(resp)
    if image_url:
        return image_url

    task_id = deep_find_key(resp, "task_id")
    if isinstance(task_id, str) and task_id:
        return poll_task_for_image_url(
            api_key,
            task_id,
            max_wait_seconds=max_wait_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )

    raise RuntimeError("cannot find image URL or task_id from image generation response")


def parse_size(size: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d+)\*(\d+)", size.strip())
    if not match:
        fail(f"invalid size format: {size}. expected like 1440*1800")
    width = int(match.group(1))
    height = int(match.group(2))
    if width <= 0 or height <= 0:
        fail(f"invalid size values: {size}")
    return width, height


def validate_size_for_model(size: str, model: str) -> None:
    width, height = parse_size(size)
    pixels = width * height
    if pixels < QWEN_IMAGE_20_MIN_PIXELS or pixels > QWEN_IMAGE_20_MAX_PIXELS:
        fail(
            f"size {size} is out of range for {model}. "
            f"total pixels must be between {QWEN_IMAGE_20_MIN_PIXELS} and {QWEN_IMAGE_20_MAX_PIXELS}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Infer a stable Chinese visual prompt from arbitrary content and render it with DashScope."
    )
    parser.add_argument("--topic", default="", help="short topic/title")
    parser.add_argument("--text", default="", help="long text inline")
    parser.add_argument("--text-file", default="", help="path to a long text file")
    parser.add_argument("--use-case", default="中文视觉图", help="usage scenario")
    parser.add_argument("--style-preset", default="", help="built-in preset name; leave empty to use default, or pass random to randomize")
    parser.add_argument("--style-file", default="", help="custom markdown file for style supplement")
    parser.add_argument("--style-hint", default="", help="extra style hint appended after the preset")
    parser.add_argument("--size", default="1024*1024", help="image size")
    parser.add_argument("--output", default="", help="output file path or directory")
    parser.add_argument("--prompt-output", default="", help="optional JSON file path for inferred prompt output")
    parser.add_argument("--dry-run", action="store_true", help="infer prompt only; do not render image")
    parser.add_argument("--prompt-model", default="qwen-plus", help="DashScope text model used for prompt inference")
    parser.add_argument("--image-model", default="qwen-image-2.0-pro", help="DashScope image model")
    parser.add_argument("--negative-prompt", default="", help="override negative prompt")
    parser.add_argument("--disable-prompt-extend", action="store_true", help="disable DashScope prompt extension")
    parser.add_argument("--watermark", action="store_true", help="enable output watermark")
    parser.add_argument("--max-input-chars", type=int, default=18000, help="maximum source text characters after normalization")
    parser.add_argument("--max-wait-seconds", type=int, default=180, help="maximum polling time for async image tasks")
    parser.add_argument("--poll-interval-seconds", type=int, default=3, help="poll interval when waiting for image tasks")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if not api_key:
        fail("missing environment variable DASHSCOPE_API_KEY")

    validate_size_for_model(args.size, args.image_model)

    source_material = collect_source_material(args)
    preset_bundle = load_preset_bundle(args)
    meta_prompt = preset_bundle["meta_prompt"]
    style_text = preset_bundle["style_text"]
    preset_name = preset_bundle["preset_name"]
    preset_label = preset_bundle["preset_label"]

    used_fallback = False
    try:
        inferred = infer_prompt(
            api_key=api_key,
            prompt_model=args.prompt_model,
            source_material=source_material,
            meta_prompt=meta_prompt,
            style_text=style_text,
            use_case=args.use_case,
            size=args.size,
        )
    except Exception as exc:
        print(f"WARN: prompt inference failed, fallback template is used: {exc}")
        inferred = fallback_prompt(
            source_material=source_material,
            style_text=style_text,
            use_case=args.use_case,
            preset_name=preset_name,
        )
        used_fallback = True

    prompt = inferred["image_generation_prompt"]
    negative_prompt = (
        args.negative_prompt.strip()
        if args.negative_prompt.strip()
        else inferred.get("negative_prompt", DEFAULT_NEGATIVE_PROMPT)
    )
    reasoning = inferred.get("brief_reasoning", "")

    result_payload = {
        "image_generation_prompt": prompt,
        "negative_prompt": negative_prompt,
        "brief_reasoning": reasoning,
        "style_preset": preset_name,
        "preset_label": preset_label,
        "use_case": args.use_case,
        "size": args.size,
        "fallback_used": used_fallback,
    }

    print(f"PROMPT_MODEL={args.prompt_model}")
    print(f"IMAGE_MODEL={args.image_model}")
    print(f"STYLE_PRESET={preset_name}")
    print(f"PRESET_LABEL={preset_label}")
    print(f"FALLBACK_USED={str(used_fallback).lower()}")
    if reasoning:
        print(f"BRIEF_REASONING={reasoning}")
    print(f"INFERRED_PROMPT={prompt}")
    print(f"NEGATIVE_PROMPT={negative_prompt}")

    if args.prompt_output:
        prompt_output_path = write_prompt_output(args.prompt_output, result_payload)
        print(f"PROMPT_SAVED_TO={prompt_output_path}")

    if args.dry_run:
        print("DRY_RUN=true")
        return

    image_url = generate_image(
        api_key=api_key,
        image_model=args.image_model,
        prompt=prompt,
        negative_prompt=negative_prompt,
        size=args.size,
        prompt_extend=not args.disable_prompt_extend,
        watermark=args.watermark,
        max_wait_seconds=args.max_wait_seconds,
        poll_interval_seconds=args.poll_interval_seconds,
    )

    output_path = resolve_output_path(args.output, image_url)
    download_file(image_url, output_path)

    print(f"IMAGE_URL={image_url}")
    print(f"SAVED_TO={output_path.resolve()}")


if __name__ == "__main__":
    main()
