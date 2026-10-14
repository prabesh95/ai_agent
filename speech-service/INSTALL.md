# Image generation — Tasks only

Merge this ZIP's folders into D:\projects\agent. Back up additional local edits first.
This adds Image generation service alongside Kantipur in the Tasks directory.
No chat route, chat component, voice hook, main page, Tasks overview, sidebar,
globals.css or package.json is included or replaced.

## 1. Configuration
Append to your existing .env.local, preserving other entries:

```env
IMAGE_PROVIDER=local-openvino
IMAGE_MODEL=lcm-dreamshaper-fp16
IMAGE_SERVICE_URL=http://127.0.0.1:8001
```

No model/provider selector is shown. The developer chooses IMAGE_MODEL.
The existing downloaded FP16 model should remain at:
image-service/models/lcm-dreamshaper-fp16

## 2. Start Python
From D:\projects\agent:

```bat
image-service\.venv\Scripts\python.exe -m uvicorn image_server:app --app-dir image-service --host 127.0.0.1 --port 8001
```

If you are already inside image-service:

```bat
.venv\Scripts\python.exe -m uvicorn image_server:app --host 127.0.0.1 --port 8001
```

Keep this terminal open. Use one worker without --reload, so the model stays loaded.
Your speech service continues on port 8000. No new packages are needed if your
previous image service environment still contains openvino-genai, pillow, fastapi,
uvicorn and huggingface_hub. If git reset removed source files, this ZIP restores
the image server; it does not include your virtual environment or model weights.

## 3. Restart Next.js

```bat
npm run dev
```

Open Tasks → Image generation service, or /tasks/images directly.
Enter the image description yourself. Select default portrait, square, portrait post,
story, landscape, LinkedIn landscape or custom dimensions. Then Generate image.
There is no AI planner and no Ollama dependency for this task.

Images appear in the gallery with a PNG download link. Default: 1200 × 1800.
The task card uses your existing task directory's generic Available status.
Actual Python service status is shown inside the image workspace; use Refresh
if the Python service has just started or another browser tab generated an image.

## Developer configuration

lib/images/formats.ts contains shared output presets. Update these as required;
platforms have multiple placements, so these are formats, not universal requirements.
Final bounds: 256–2400 pixels per side, max 4,608,000 pixels.
Python generates near a maximum 512px side, then center-crops minor aspect-ratio
rounding differences and resizes without stretching. Resizing does not add real detail.

image-service/image_server.py has the local model registry. Adding a model requires
its downloaded OpenVINO GenAI-compatible folder and appropriate settings. Changing
name alone does not switch models. Select the registry ID through IMAGE_MODEL,
then restart Next.js; restart Python if registry code changed.

The optional lcm-dreamshaper-int8 entry is included but is unavailable until downloaded:

```bat
image-service\.venv\Scripts\python.exe -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='OpenVINO/LCM_Dreamshaper_v7-int8-ov', local_dir='image-service/models/lcm-dreamshaper-int8')"
```

This is a compressed variant, not a guarantee of improved quality or speed.
To try it, set IMAGE_MODEL=lcm-dreamshaper-int8 and restart Next.js. Revert to FP16
if your GPU/runtime does not support it satisfactorily.

lib/images/service.ts contains generateWithProvider(), the future cloud adapter
boundary. No cloud adapter is enabled. A new adapter needs its provider-specific
request, API key on the server, optional polling, and normalized PNG output with
actual dimensions. Unknown providers fail rather than silently use a paid service.

## Storage

Next.js saves PNGs and descriptive JSON metadata in data/images.
Python also saves PNGs in image-service/outputs.
Append missing entries to .gitignore:

```gitignore
image-service/.venv/
image-service/models/
image-service/outputs/
data/images/
```

This task is text-to-image: no reference-photo upload, image editing, or exact text
rendering is implemented. Only one Python generation runs at a time; overlapping
requests return a busy error. Leaving the page may abort the browser request but
an already-running GPU operation can continue until completion.

This is a local workspace service without account authentication. Python binds to
127.0.0.1; generation through Next.js checks the request Origin.

## Verification

Combined Next.js production build and TypeScript checks, plus mocked service API
checks, were run. Existing uploaded chat renderer and route remain byte-for-byte
unchanged in the verification fixture. Actual GPU generation and browser appearance
need checking on your PC.
