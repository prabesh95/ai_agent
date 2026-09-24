import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(
    title="Local Speech Service",
    description="Converts recorded audio into text using Faster Whisper.",
)

print("Loading the Whisper model...")

model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8",
)

print("Whisper model loaded.")


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "small",
        "device": "cpu",
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="The uploaded audio needs a filename.",
        )

    file_extension = Path(file.filename).suffix or ".webm"
    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_extension,
        ) as temporary_file:
            shutil.copyfileobj(file.file, temporary_file)
            temporary_path = temporary_file.name

        segments, information = model.transcribe(
            temporary_path,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
        )

        text = " ".join(
            segment.text.strip()
            for segment in segments
        ).strip()

        return {
            "text": text,
            "language": information.language,
            "languageProbability":
                information.language_probability,
        }

    except Exception as error:
        print(f"Transcription failed: {error}")

        raise HTTPException(
            status_code=500,
            detail="Audio transcription failed.",
        ) from error

    finally:
        await file.close()

        if temporary_path:
            Path(temporary_path).unlink(
                missing_ok=True
            )