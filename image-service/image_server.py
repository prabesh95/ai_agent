"""Local image API. Run one Uvicorn worker to keep one model in memory."""

import base64
import gc
import logging
from io import BytesIO
from pathlib import Path
from threading import Lock
from time import perf_counter
from uuid import uuid4

import openvino_genai as genai
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"

# Add downloaded, OpenVINO GenAI-compatible models here.
# Settings belong to each model: four steps are appropriate for this LCM,
# but should not be copied blindly to conventional diffusion models.
MODELS = {
    "lcm-dreamshaper-int8": {
        "name": "LCM DreamShaper INT8",
        "path": BASE_DIR / "models" / "lcm-dreamshaper-int8",
        "steps": 4, "guidance_scale": 8.5, "width": 512, "height": 512,
    },
    "lcm-dreamshaper-fp16": {
        "name": "LCM DreamShaper FP16",
        "path": BASE_DIR / "models" / "lcm-dreamshaper-fp16",
        "steps": 4,
        "guidance_scale": 8.5,
        "width": 512,
        "height": 512,
    },
}

app = FastAPI(title="The King's AI — Local Image Service")
logger = logging.getLogger("uvicorn.error")
generation_lock = Lock()
pipeline = None
loaded_model_id = None


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model_id: str = "lcm-dreamshaper-fp16"
    prompt: str = Field(min_length=1, max_length=2000)
    output_width: int = Field(default=1200, ge=256, le=2400)
    output_height: int = Field(default=1800, ge=256, le=2400)


def model_available(config):
    path = config["path"]
    return all((path / item).is_file() for item in (
        "model_index.json",
        "scheduler/scheduler_config.json",
        "tokenizer/openvino_tokenizer.xml",
        "tokenizer/openvino_tokenizer.bin",
        "text_encoder/openvino_model.xml",
        "text_encoder/openvino_model.bin",
        "unet/openvino_model.xml",
        "unet/openvino_model.bin",
        "vae_decoder/openvino_model.xml",
        "vae_decoder/openvino_model.bin",
    ))


@app.get("/health")
def health():
    return {"status": "ok", "provider": "local-openvino",
            "device": "GPU", "loaded_model_id": loaded_model_id,
            "busy": generation_lock.locked()}


@app.get("/models")
def list_models():
    return {"provider": "local-openvino", "models": [
        {"id": model_id, "name": config["name"],
         "available": model_available(config),
         "width": config["width"], "height": config["height"],
         "steps": config["steps"]}
        for model_id, config in MODELS.items()
    ]}


@app.post("/generate")
def generate(request: GenerateRequest):
    global pipeline, loaded_model_id
    prompt = request.prompt.strip()
    if not prompt:
        raise HTTPException(422, "Enter a prompt.")
    if request.output_width * request.output_height > 4608000:
        raise HTTPException(422, "Output exceeds 4.6 megapixels.")
    config = MODELS.get(request.model_id)
    if config is None:
        raise HTTPException(400, "Unknown model. Choose one from /models.")
    if not model_available(config):
        raise HTTPException(409, "The selected model is not fully downloaded.")
    # Reject overlapping requests instead of building a hidden queue.
    if not generation_lock.acquire(blocking=False):
        raise HTTPException(409, "An image is already generating. Try again afterward.")

    started = perf_counter()
    load_seconds = 0.0
    try:
        if pipeline is None or loaded_model_id != request.model_id:
            # Release the previous model before loading its replacement.
            pipeline = None
            loaded_model_id = None
            gc.collect()
            load_started = perf_counter()
            logger.info("Loading image model: %s", request.model_id)
            pipeline = genai.Text2ImagePipeline(str(config["path"]), "GPU")
            loaded_model_id = request.model_id
            load_seconds = perf_counter() - load_started

        generation_started = perf_counter()
        # Keep diffusion near the tested 512px budget; match output aspect ratio.
        ratio = request.output_width / request.output_height
        if ratio >= 1:
            generation_width = 512
            generation_height = max(128, round(512 / ratio / 64) * 64)
        else:
            generation_height = 512
            generation_width = max(128, round(512 * ratio / 64) * 64)
        result = pipeline.generate(
            prompt,
            width=generation_width,
            height=generation_height,
            num_inference_steps=config["steps"],
            guidance_scale=config["guidance_scale"],
        )
        generation_seconds = perf_counter() - generation_started

        buffer = BytesIO()
        from PIL import ImageOps
        image = Image.fromarray(result.data[0])
        # Small rounding differences are center-cropped; never stretch.
        image = ImageOps.fit(image, (request.output_width, request.output_height), method=Image.Resampling.LANCZOS)
        image.save(buffer, format="PNG")
        png = buffer.getvalue()
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid4().hex}.png"
        (OUTPUT_DIR / filename).write_bytes(png)

        return {
            "provider": "local-openvino",
            "model_id": request.model_id,
            "width": request.output_width,
            "height": request.output_height,
            "generation_width": generation_width,
            "generation_height": generation_height,
            "image": {"mime_type": "image/png",
                      "base64": base64.b64encode(png).decode("ascii"),
                      "filename": filename},
            "timings": {"load_seconds": round(load_seconds, 2),
                        "generation_seconds": round(generation_seconds, 2),
                        "total_seconds": round(perf_counter() - started, 2)},
        }
    except Exception:
        # A failed pipeline may be unusable; retry with a fresh one next time.
        pipeline = None
        loaded_model_id = None
        gc.collect()
        logger.exception("Image generation failed")
        raise HTTPException(500, "Image generation failed. Check the Python terminal.")
    finally:
        generation_lock.release()


# No permissive browser CORS: Next.js will call this API server-to-server.
# Bind to 127.0.0.1; this local service has no account authentication.
