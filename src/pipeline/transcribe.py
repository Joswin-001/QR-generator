#!/usr/bin/env python3

import sys
import os
import json


def format_timestamp(seconds):
    hours   = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs    = int(seconds % 60)
    millis  = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def get_compute_config():
    try:
        import torch
        if torch.cuda.is_available():
            print(json.dumps({"status": "GPU detected — using CUDA float16"}), flush=True)
            return "cuda", "float16"
    except ImportError:
        pass
    print(json.dumps({"status": "CPU mode — using float32"}), flush=True)
    return "cpu", "float32"


def transcribe(input_path, output_srt_path, model_size="base"):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper not found. Run: pip install faster-whisper"}), flush=True)
        sys.exit(1)

    device, compute_type = get_compute_config()

    print(json.dumps({"status": f"Loading model: {model_size} ({device}/{compute_type})"}), flush=True)

    model        = None
    configs      = [
        (device, compute_type),
        ("cpu", "float32"),
        ("cpu", "int8"),
    ]
    config_index = 0

    while config_index < len(configs):
        dev, ct = configs[config_index]
        try:
            model = WhisperModel(model_size, device=dev, compute_type=ct)
            print(json.dumps({"status": f"Model loaded ({dev}/{ct})"}), flush=True)
            break
        except Exception as e:
            print(json.dumps({"status": f"{dev}/{ct} failed: {str(e)} — trying next..."}), flush=True)
            model = None
        config_index += 1

    if model is None:
        print(json.dumps({"error": "Could not load Whisper model with any config."}), flush=True)
        sys.exit(1)

    print(json.dumps({"status": "Transcribing audio..."}), flush=True)

    segments_iter, info = model.transcribe(
        input_path,
        beam_size=5,
        language="en",
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    print(json.dumps({
        "status":   f"Language: {info.language} ({info.language_probability:.0%})",
        "duration": info.duration,
    }), flush=True)

    os.makedirs(os.path.dirname(output_srt_path), exist_ok=True)

    segments_list = list(segments_iter)
    total         = len(segments_list)
    i             = 0

    with open(output_srt_path, 'w', encoding='utf-8') as f:
        while i < total:
            segment = segments_list[i]
            i      += 1

            start = format_timestamp(segment.start)
            end   = format_timestamp(segment.end)
            text  = segment.text.strip()

            f.write(f"{i}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{text}\n\n")

            if i % 10 == 0:
                percent = round((segment.end / info.duration) * 100) if info.duration else 0
                print(json.dumps({
                    "status":      f"Processed {i}/{total} segments...",
                    "currentTime": segment.end,
                    "duration":    info.duration,
                    "percent":     min(percent, 99),
                }), flush=True)

    print(json.dumps({
        "done":       True,
        "outputPath": output_srt_path,
        "message":    f"Captions generated! ({i} segments)",
    }), flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: transcribe.py <input_video> <output_srt> [model_size]"}))
        sys.exit(1)

    input_video = sys.argv[1]
    output_srt  = sys.argv[2]
    model_size  = sys.argv[3] if len(sys.argv) > 3 else "base"

    if not os.path.exists(input_video):
        print(json.dumps({"error": f"Video not found: {input_video}"}))
        sys.exit(1)

    transcribe(input_video, output_srt, model_size)
