#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
video-inspect — 视频画面识别工具（本地 Ollama 视觉模型 / 可选 GLM-4V-Flash 云端）

用法:
  python video_inspect.py <视频URL或本地文件> [--question "问题"] [--fps 0.5] [--max-frames 50] [--backend local|glm] [--out DIR]

流程:
  1. yt-dlp 下载（URL 输入时）
  2. ffmpeg 抽帧（按时间均匀抽取，标注时间戳）
  3. 逐帧送视觉模型识别（Ollama qwen2.5vl 或 GLM-4V-Flash）
  4. 输出 Markdown 报告（时间戳 + 画面描述）

依赖: yt-dlp, ffmpeg(PATH), ollama(本地) 或 GLM API key(云端)
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from datetime import timedelta

# ---------- 配置 ----------

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_VL_MODEL", "qwen2.5vl:7b")

# GLM-4V-Flash (智谱开放平台, https://open.bigmodel.cn)
GLM_API_KEY = os.environ.get("GLM_API_KEY", "")
if not GLM_API_KEY:
    # 尝试从 Windows 用户注册表读取（setx 设置的用户级变量）
    try:
        import subprocess
        r = subprocess.run(
            ["powershell", "-Command",
             "[Environment]::GetEnvironmentVariable('GLM_API_KEY', 'User')"],
            capture_output=True, text=True, timeout=10)
        GLM_API_KEY = r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        pass
GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
GLM_MODEL = "glm-4v-flash"

VISION_PROMPT = "识别图片里所有信息，使用 markdown 输出全部内容，并保持排版的一致。包括文字、UI元素、布局等所有可见内容。"

# ---------- 视频处理 ----------

def download_video(url: str, workdir: str) -> str:
    """用 yt-dlp 下载视频（B站/YouTube 等），返回本地路径"""
    out = os.path.join(workdir, "video")
    subprocess.run(
        ["yt-dlp", "-f", "bv*+ba/b", "-o", f"{out}.%(ext)s",
         "--no-playlist", "--max-filesize", "500M", url],
        check=True, capture_output=True)
    # 找到下载的文件
    for f in os.listdir(workdir):
        if f.startswith("video."):
            return os.path.join(workdir, f)
    raise FileNotFoundError("yt-dlp 下载失败")


def extract_frames(video_path: str, workdir: str, fps: float, max_frames: int) -> list:
    """ffmpeg 抽帧，返回 [(时间戳秒, 图片路径)]"""
    ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
    frames_dir = os.path.join(workdir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    # 先获取时长
    probe = subprocess.run(
        [ffmpeg, "-i", video_path, "-f", "null", "-"],
        capture_output=True, text=True)
    duration = 0
    for line in probe.stderr.split("\n"):
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            duration = int(h) * 3600 + int(m) * 60 + float(s)
            break
    if duration <= 0:
        duration = 300  # 兜底

    # 计算抽帧间隔（fps=每秒帧数，但受 max_frames 限制）
    interval = max(1.0 / fps, duration / max_frames)

    out_pattern = os.path.join(frames_dir, "frame_%05d.jpg")
    subprocess.run(
        [ffmpeg, "-y", "-i", video_path, "-vf",
         f"fps=1/{interval:.3f},scale='min(1280,iw)':-2",
         "-q:v", "3", out_pattern],
        check=True, capture_output=True)

    # 收集帧并按时间戳排序
    frames = []
    for f in sorted(os.listdir(frames_dir)):
        if f.endswith(".jpg"):
            idx = int(f.split("_")[1].split(".")[0])
            ts = (idx - 1) * interval
            frames.append((ts, os.path.join(frames_dir, f)))
    return frames


def fmt_ts(sec: float) -> str:
    """秒 → mm:ss 格式"""
    return str(timedelta(seconds=int(sec)))


# ---------- 视觉识别后端 ----------

def recognize_local(image_path: str, question: str) -> str:
    """Ollama 本地视觉模型"""
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    prompt = f"{VISION_PROMPT}\n额外问题: {question}" if question else VISION_PROMPT

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "images": [img_b64],
        "stream": False,
        "options": {"num_predict": 2048},
    }
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/generate",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        d = json.loads(resp.read())
        return d.get("response", "").strip()


def recognize_glm(image_path: str, question: str) -> str:
    """GLM-4V-Flash 云端视觉模型（免费）"""
    if not GLM_API_KEY:
        return "[GLM API key 未配置，跳过云端识别]"

    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    prompt = f"{VISION_PROMPT}\n额外问题: {question}" if question else VISION_PROMPT

    payload = {
        "model": GLM_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                {"type": "text", "text": prompt},
            ],
        }],
        "temperature": 0.3,
    }
    req = urllib.request.Request(
        GLM_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {GLM_API_KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            d = json.loads(resp.read())
            return d["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"[GLM 识别失败: {e}]"


# ---------- 主流程 ----------

def main():
    parser = argparse.ArgumentParser(description="视频画面识别")
    parser.add_argument("input", help="视频 URL（B站/YouTube）或本地文件路径")
    parser.add_argument("--question", "-q", default="", help="针对画面的具体问题")
    parser.add_argument("--fps", type=float, default=0.5, help="抽帧频率（每秒帧数，默认0.5=每2秒1帧）")
    parser.add_argument("--max-frames", type=int, default=50, help="最大帧数（默认50）")
    parser.add_argument("--backend", choices=["local", "glm", "both"], default="local",
                        help="识别后端：local=Ollama本地, glm=GLM云端, both=两者")
    parser.add_argument("--out", "-o", default=".", help="输出目录（默认当前目录）")
    args = parser.parse_args()

    workdir = tempfile.mkdtemp(prefix="video_inspect_")
    print(f"[1/4] 准备视频: {args.input}")

    try:
        # 1. 获取视频
        if args.input.startswith(("http://", "https://")):
            video_path = download_video(args.input, workdir)
        else:
            video_path = args.input
        print(f"      视频就绪: {video_path}")

        # 2. 抽帧
        print(f"[2/4] 抽帧中 (fps={args.fps}, max={args.max_frames})...")
        frames = extract_frames(video_path, workdir, args.fps, args.max_frames)
        print(f"      抽到 {len(frames)} 帧")

        if not frames:
            print("      未抽到任何帧，退出")
            sys.exit(1)

        # 3. 逐帧识别
        print(f"[3/4] 识别中 (backend={args.backend})...")
        results = []
        for i, (ts, img) in enumerate(frames):
            print(f"      [{i+1}/{len(frames)}] t={fmt_ts(ts)} 识别中...")
            desc = ""
            if args.backend in ("local", "both"):
                desc = recognize_local(img, args.question)
            if args.backend == "both":
                desc += "\n\n--- GLM ---\n" + recognize_glm(img, args.question)
            elif args.backend == "glm":
                desc = recognize_glm(img, args.question)
            results.append((ts, desc))

        # 4. 输出 Markdown
        print(f"[4/4] 生成报告...")
        os.makedirs(args.out, exist_ok=True)
        out_name = os.path.splitext(os.path.basename(video_path))[0]
        report_path = os.path.join(args.out, f"{out_name}_画面分析.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(f"# {out_name} 画面分析\n\n")
            f.write(f"- 视频: {args.input}\n- 抽帧: {len(frames)} 帧 (fps={args.fps})\n")
            f.write(f"- 后端: {args.backend}\n- 问题: {args.question or '无'}\n\n")
            f.write("---\n\n")
            for ts, desc in results:
                f.write(f"## t={fmt_ts(ts)}\n\n{desc}\n\n---\n\n")
        print(f"报告已生成: {report_path}")
        return report_path
    finally:
        # 清理临时目录（保留报告）
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
