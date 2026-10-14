import argparse
from pathlib import Path
from time import perf_counter

import openvino_genai as genai
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent

parser = argparse.ArgumentParser()
parser.add_argument(
    "--model",
    type=Path,
    default=BASE_DIR / "models" / "lcm-dreamshaper-fp16",
)
parser.add_argument(
    "--prompt",
    default="A futuristic city in Nepal at night, cyan lights, cinematic illustration",
)
parser.add_argument("--device", choices=["GPU", "CPU"], default="GPU")
parser.add_argument("--steps", type=int, default=4)
parser.add_argument("--runs", type=int, default=2)
args = parser.parse_args()

model_path = args.model.resolve()

if not (model_path / "model_index.json").is_file():
    parser.error(f"Model not found or download incomplete: {model_path}")

if args.steps < 1 or args.runs < 1:
    parser.error("--steps and --runs must be positive")

output_dir = BASE_DIR / "outputs"
output_dir.mkdir(parents=True, exist_ok=True)

print(f"Model: {model_path}", flush=True)
print(f"Device: {args.device}", flush=True)
print("Loading and compiling model...", flush=True)

started = perf_counter()
pipeline = genai.Text2ImagePipeline(str(model_path), args.device)
print(f"Model loading: {perf_counter() - started:.1f} seconds", flush=True)

for run in range(1, args.runs + 1):
    print(f"\nGenerating image {run}/{args.runs}...", flush=True)
    started = perf_counter()

    result = pipeline.generate(
        args.prompt,
        width=512,
        height=512,
        num_inference_steps=args.steps,
        guidance_scale=8.5,
    )

    elapsed = perf_counter() - started
    image_path = output_dir / f"test-{run}.png"
    Image.fromarray(result.data[0]).save(image_path)

    print(f"Generation: {elapsed:.1f} seconds", flush=True)
    print(f"Saved: {image_path}", flush=True)