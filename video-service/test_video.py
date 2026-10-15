"""Inspect a public video API, then explicitly request one short test clip."""
import argparse
import os
from pathlib import Path
from shutil import copyfile
from time import perf_counter

from gradio_client import Client, handle_file
from huggingface_hub import HfApi

SPACE = "Lightricks/ltx-video-distilled"
BASE = Path(__file__).resolve().parent
OUTPUT = BASE / "outputs"


def find_video(value):
    if isinstance(value, str):
        path = Path(value)
        if path.suffix.lower() == ".mp4" and path.is_file():
            return path
    elif isinstance(value, dict):
        for item in value.values():
            found = find_video(item)
            if found:
                return found
    elif isinstance(value, (list, tuple)):
        for item in value:
            found = find_video(item)
            if found:
                return found
    return None


def show_quota(label, quota):
    print(f"{label}: {quota.remaining} / {quota.base} GPU-seconds remaining", flush=True)
    print(f"Reset time (UTC): {quota.resets_at}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true", help="Consumes GPU quota: generate one 3-second clip")
    parser.add_argument("--image", type=Path, help="Optional existing local image for image-to-video")
    args = parser.parse_args()
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        raise RuntimeError("HF_TOKEN is missing. Launch through Node --env-file=.env.local.")
    if args.image and not args.image.is_file():
        raise RuntimeError("The supplied image file does not exist.")
    hub = HfApi(token=token)
    before = hub.get_zero_gpu_quota()
    show_quota("Before", before)
    print(f"Connecting to {SPACE}…", flush=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    client = Client(SPACE, token=token, download_files=str(OUTPUT))
    api = client.view_api(return_format="dict", print_info=False)
    endpoints = api.get("named_endpoints", {})
    print("Available API endpoints:", ", ".join(endpoints), flush=True)
    endpoint = "/image_to_video" if args.image else "/text_to_video"
    if endpoint not in endpoints:
        raise RuntimeError(f"Expected {endpoint} endpoint is unavailable; no generation was requested.")
    print(f"Selected: {endpoint}", flush=True)
    if not args.generate:
        print("API inspection complete. No video generation requested; no generation GPU quota consumed.")
        return
    # Current Space source reserves 60 seconds on xlarge for short clips;
    # xlarge costs 2x GPU-seconds. Check headroom without relying on top-up credits.
    if before.remaining < 120:
        raise RuntimeError("Less than 120 GPU-seconds remain. Wait for quota reset before testing.")
    kwargs = {
        "prompt": (
    "Animate the supplied image with subtle natural movement. "
    "Preserve its main subject, setting, colors, and composition. "
    "Use a gentle camera movement. Do not introduce a different scene."
    if args.image
    else "A peaceful mountain lake in Nepal at sunrise, gentle ripples "
         "on the water, clouds drifting slowly, a slow cinematic camera "
         "push forward, no text"
),
        "negative_prompt": "blurry, distorted, jittery, text, watermark",
        "input_image_filepath": handle_file(str(args.image.resolve())) if args.image else None,
        "input_video_filepath": None,
        "height_ui": 512,
        "width_ui": 704,
        "mode": "image-to-video" if args.image else "text-to-video",
        "duration_ui": 3.0,
        "ui_frames_to_use": 9,
        "seed_ui": 42,
        "randomize_seed": False,
        "ui_guidance_scale": 1.0,
        "improve_texture_flag": False,
    }
    # Refuse to send a generation if the live API has incompatible parameter names.
    parameters = endpoints[endpoint].get("parameters", [])
    names = {item.get("parameter_name") for item in parameters}
    if not set(kwargs).issubset(names):
        raise RuntimeError(f"The Space API changed. Parameters available: {sorted(str(n) for n in names)}. No generation requested.")
    print("Submitting one three-second silent clip. Queue wait can exceed generation time…", flush=True)
    started = perf_counter()
    try:
        result = client.predict(api_name=endpoint, **kwargs)
        video = find_video(result)
        if not video:
            raise RuntimeError("The API returned no downloaded MP4. Inspect the local outputs folder.")
        destination = OUTPUT / ("test-image-to-video.mp4" if args.image else "test-text-to-video.mp4")
        if video.resolve() != destination.resolve():
            copyfile(video, destination)
        print(f"Saved: {destination}", flush=True)
        print(f"Total time including queue/download: {perf_counter() - started:.1f} seconds", flush=True)
    finally:
        # Failed jobs may also consume quota. Always try to read the actual balance.
        try:
            after = hub.get_zero_gpu_quota()
            show_quota("After", after)
            print(f"Observed account quota decrease: {max(0, before.remaining - after.remaining)} GPU-seconds (may include other account activity)", flush=True)
        except Exception:
            print("Could not refresh quota. Run the earlier quota check to see the current balance.", flush=True)


if __name__ == "__main__":
    main()
