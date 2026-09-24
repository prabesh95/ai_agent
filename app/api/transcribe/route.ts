export const runtime = "nodejs";

const speechServiceUrl =
  process.env.SPEECH_SERVICE_URL ??
  "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const incomingFormData = await request.formData();
    const audioFile = incomingFormData.get("file");

    if (!(audioFile instanceof File)) {
      return Response.json(
        {
          error: "An audio file is required.",
        },
        {
          status: 400,
        }
      );
    }

    const pythonFormData = new FormData();

    pythonFormData.append(
      "file",
      audioFile,
      audioFile.name || "recording.webm"
    );

    const pythonResponse = await fetch(
      `${speechServiceUrl}/transcribe`,
      {
        method: "POST",
        body: pythonFormData,
      }
    );

    if (!pythonResponse.ok) {
      const details = await pythonResponse.text();

      console.error(
        "Speech service returned an error:",
        details
      );

      return Response.json(
        {
          error:
            "The speech service could not transcribe the audio.",
        },
        {
          status: 502,
        }
      );
    }

    const transcription = await pythonResponse.json();

    return Response.json(transcription);
  } catch (error) {
    console.error("Transcription route error:", error);

    return Response.json(
      {
        error:
          "Could not connect to the local speech service.",
      },
      {
        status: 503,
      }
    );
  }
}