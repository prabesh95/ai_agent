# Local Voice AI Chat

This is a small learning project I built to understand how a web application can work with local AI models.

You can type a message or record your voice. Voice recordings are converted into text using Faster Whisper, and the text is then sent to `qwen2.5:3b` running locally through Ollama. The response is streamed back into the chat interface.

Everything runs on your own computer—no paid AI API is required.

## What it uses

- Next.js and React for the chat interface
- Vercel AI SDK for streaming responses
- Ollama for running the language model
- FastAPI and Faster Whisper for local speech recognition
- Browser MediaRecorder API for recording voice

The basic flow is:

```text
Type or speak
      ↓
Next.js
      ↓
Whisper converts voice to text
      ↓
Ollama generates the answer
      ↓
Response appears in the chat
```

## Run it on your computer

You need Node.js, Python and Ollama installed before starting.

### 1. Clone and install the project

```bash
git clone https://github.com/prabesh95/ai_agent.git
cd ai_agent
npm install
```

### 2. Download the Ollama model

```bash
ollama pull qwen2.5:3b
```

You can confirm that it is available with:

```bash
ollama list
```

### 3. Create the Python environment

On Windows Command Prompt:

```bat
py -m venv speech-service\.venv
speech-service\.venv\Scripts\activate.bat
```

Install the speech-recognition packages:

```bat
python -m pip install faster-whisper fastapi uvicorn python-multipart
```

### 4. Configure the environment

Create `.env.local` in the project root:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=qwen2.5:3b
SPEECH_SERVICE_URL=http://127.0.0.1:8000
```

Do not commit `.env.local` to GitHub.

### 5. Start the speech service

Open a terminal and run:

```bat
cd speech-service
.venv\Scripts\activate.bat
python -m uvicorn speech_server:app --reload --host 127.0.0.1 --port 8000
```

The first run may take longer because Whisper needs to download its model.

You can check the service at:

```text
http://127.0.0.1:8000/health
```

### 6. Start Next.js

Open another terminal in the project root:

```bash
npm run dev
```

Now visit:

```text
http://localhost:3000
```

Ollama should also be running in the background.

## Using voice input

Click **Mic**, speak, and then click **Stop**.

Whisper will convert the recording into text and place it in the textarea. You can review or correct the transcription before clicking **Send**.

The assistant currently replies with text only.

## Current limitations

This project is currently intended for local desktop use.

- All services must be running on the same computer.
- Conversations are not saved after refreshing the page.
- Whisper can occasionally mishear words.
- Nepali quality depends on both Whisper and the selected Ollama model.
- Mobile and production deployment are not configured yet.
- Spoken AI responses have not been added yet.

## Why I built this

I built this project to learn how Next.js, Python and local AI services can work together as one application. It also helped me understand streaming responses, API routes, environment variables, voice recording and communication between independently running services.