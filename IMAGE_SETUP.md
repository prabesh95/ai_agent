# Image generation update

Copy the folders in this ZIP into D:\projects\agent, merging directories.
Back up files first if you have made additional changes since the web-search/task updates.
Only included files are replaced; do not replace your entire app directory.
No package.json, globals.css, sidebar, chat hook, secrets or downloaded models are included.

## Configure
Add these entries to your existing .env.local (preserve all other entries):

```env
IMAGE_PROVIDER=local-openvino
IMAGE_MODEL=lcm-dreamshaper-fp16
IMAGE_SERVICE_URL=http://127.0.0.1:8001
# Optional; default is data/images relative to your project:
# IMAGE_DATA_DIR=D:/projects/agent/data/images
```

Ensure these are ignored by Git (append missing entries to .gitignore):

```gitignore
image-service/.venv/
image-service/models/
image-service/outputs/
data/images/
```

This package merges your uploaded route.ts, ChatMessages.tsx and registry.ts.
It does not replace app/tasks/page.tsx, app/page.tsx, voice hooks, the sidebar or globals.css.
Your existing task directory automatically lists the new registry entry. Its generic
status remains Available; open the image task for actual service health and saved images.

The existing dependencies are sufficient. Your image-service environment needs
openvino-genai, pillow, fastapi and uvicorn, already installed during our tests.

Stop the old Python image server with Ctrl+C, then restart from the project root:

```bat
image-service\.venv\Scripts\python.exe -m uvicorn image_server:app --app-dir image-service --host 127.0.0.1 --port 8001
```

Use one worker, without --reload. Leave Ollama running. Restart Next.js after updating .env.local:

```bat
npm run dev
```

Open Tasks → Image generation service. No new sidebar item or model selector is added.
Describe an image, select its output format or custom dimensions, and generate.
Images made here and in chat share the same saved gallery. Refresh the gallery if you
created an image in another browser tab.

## Chat

Discuss a subject, then ask naturally for an illustration, picture, graphic, etc.
If format is unclear, the assistant asks a short question. Respond with "use default",
"square", "Instagram story", "16:9", or explicit dimensions. You can add composition
instructions in that answer. Default output: 1200 × 1800.

The chat model builds the internal English prompt, which is not rendered in the UI.
The result appears in chat with a download link and in the task gallery.
Image routing runs before web search and stored-news routing. Saved Kantipur news requests bypass image planning unless they mention image creation
or continue a pending image clarification. They still work without Ollama.
Other requests may add a planning call. If planning fails for an ordinary message,
existing chat/search behavior continues. Explicit image requests fail visibly rather
than being substituted with ordinary chat. No cloud usage occurs.

This is model-based intent detection, not a fixed keyword trigger. Its reliability
must be checked with your real qwen2.5:3b model. Small models may need clearer wording.
The planner sees the latest 16 messages, each limited to 9000 characters; very old
context may need restating. Pending image details and the previous generated image's
subject are retained in message metadata for follow-up requests in that conversation.
It creates a NEW image, not a pixel-preserving edit of previous artwork.

The current adapter is text-to-image. It does not accept reference-photo uploads.
When exact likeness is essential, it can offer a new themed illustration instead.
References remain optional; implementing actual photo-based generation requires a
compatible provider adapter and upload handling. Named people are not reliably
recognizable from text alone. Exact lettering is not guaranteed; the planner should
ask before proceeding without exact lettering. Deterministic text overlay is not
implemented in this update.

Earlier news answers are context, not fact verification. The image planner is told
not to invent verified facts or portray illustrations as factual event photographs.
It does not independently fact-check the conversation.

## Developer model changes

Changing a model's name only changes its label. The registry key is its ID; path is
its downloaded OpenVINO folder. Each model needs appropriate steps/guidance settings.

image-service/image_server.py contains MODELS. IMAGE_MODEL in .env.local chooses
which registry entry Next.js uses. No model ID is accepted from the user-facing API.
Restart Next.js after environment changes. Restart Python after registry changes.
A selected model is loaded on its first request. Switching releases the old model
before loading the new one. First-generation initialization can add latency.

### Optional second local model

A second entry, lcm-dreamshaper-int8, is included but stays unavailable until downloaded.
It is a compressed variant of the same DreamShaper family, not a promise of better
quality or faster execution on Iris Xe. Benchmark it before choosing it for regular use.

From D:\projects\agent:

```bat
image-service\.venv\Scripts\python.exe -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='OpenVINO/LCM_Dreamshaper_v7-int8-ov', local_dir='image-service/models/lcm-dreamshaper-int8')"
```

Set IMAGE_MODEL=lcm-dreamshaper-int8 and restart Next.js. Your original FP16 model
remains downloaded, so reverting is an environment change. If INT8 fails on your
GPU/driver, revert to FP16; CPU fallback is not silently enabled.

To use an entirely different model, export/download its OpenVINO GenAI-compatible
pipeline, add a MODELS entry, and configure the ID. Hardware/runtime support varies.
For other model families, adapt the generation dimensions and settings too; the
512px strategy used here is designed around the tested LCM model.

## Dimensions and resizing

Diffusion generates near a 512px maximum side, preserving output aspect ratio as
closely as multiples of 64 allow. Pillow then center-crops small ratio differences
and resizes to the requested final dimensions without stretching. Resizing does
not create true high-resolution detail. Non-square generation performance has not
been benchmarked on your GPU yet.

Bounds: 256–2400 pixels per side, maximum 4,608,000 pixels. Requests beyond these
bounds ask for a supported size or return a validation error.

Format presets are examples of output formats, not universal platform requirements.
Platforms have multiple placements; a name alone should trigger clarification.
All output presets are in lib/images/formats.ts, shared by the task page and planner.

## Future cloud providers

lib/images/service.ts is the server-side provider boundary, specifically
 generateWithProvider(). Implement a new adapter there or extract it to a separate
module. An adapter must return PNG Base64, actual output width/height and timings
(or normalize/download the provider's result to this shape). Providers may need
asynchronous polling and may support only particular native dimensions; normalize
output without stretching before storing it.

Keep the provider's API key in .env.local and access it only in server code.
IMAGE_PROVIDER is developer-controlled. Setting an unknown provider currently
returns a clear error; no paid provider is contacted and no cloud fallback exists.
No concrete cloud provider, key or SDK has been chosen or installed yet.

## Saved files and limitations

Next.js: data/images/<uuid>.png plus <uuid>.json with description, dimensions and timing.
Python also retains original output PNGs in image-service/outputs, as before.
No internal generated prompt or cloud keys are written to the gallery records.
Saved images persist independently of clearing chat. Chat history persistence itself
has not been added. There is no delete operation yet; files remain until removed.
Local workspace only: APIs do not have account authentication. Keep Python bound to
127.0.0.1; Next routes validate Origin for generation requests.
Stopping a browser request does not guarantee an already-running Python GPU operation
is cancelled. Python continues holding its lock until that operation finishes.
Refresh status afterward before generating again.

## Validation

Combined Next.js 16.3.5 production build and TypeScript check passed.
HTTP integration tests used mocked Ollama/image services and checked clarification
metadata, chat PNG parts, hidden prompts, developer model selection, stored images,
image retrieval, invalid dimensions, cross-origin rejection, saved-news routing even
when the optional image planner returns an invalid decision, and ordinary chat
fallback when the image router fails. 25 existing voice/news/web helper tests passed.
Uploaded ChatMessages.tsx and the original Kantipur registry entry were checked to
be identical outside the new image additions.
Python syntax checked. Actual intent quality, portrait GPU performance and browser
layout must be verified on your PC; no real GPU execution or cloud request was performed here.
