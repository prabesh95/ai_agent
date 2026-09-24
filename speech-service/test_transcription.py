from faster_whisper import WhisperModel

print("Loading the Whisper model...")

model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8",
)

print("Transcribing audio...")

segments, information = model.transcribe(
    "Recording.m4a",
    beam_size=5,
    vad_filter=True,
)

print(f"Detected language: {information.language}")
print(
    f"Language probability: "
    f"{information.language_probability:.2f}"
)

print("\nTranscription:")

for segment in segments:
    print(segment.text.strip())