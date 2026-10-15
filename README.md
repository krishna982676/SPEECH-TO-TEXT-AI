# Whisper Studio: AI Speech-to-Text Transcription System

## Abstract
Whisper Studio is a locally runnable speech-to-text web application for converting audio recordings and microphone input into editable text. A React/Vite frontend communicates with a FastAPI backend, which uses OpenAI Whisper through `faster-whisper`. The `base` model is selected by default for a better balance of accuracy and local CPU performance.

## Problem Statement
Manual transcription is slow, error-prone, and difficult to scale for lectures, interviews, and accessibility workflows. This project demonstrates how an automatic speech-recognition system can accept common audio formats, detect spoken language, and return a usable transcript through a browser interface.

## Objectives and Scope
- Accept WAV, MP3, M4A, FLAC, OGG, and WebM audio.
- Record audio directly from a browser microphone.
- Transcribe with a configurable local Whisper model.
- Support automatic detection plus common manual language choices.
- Choose Fast or Accuracy mode, Whisper model size, and an audio type hint.
- Let users edit, copy, download, and locally revisit transcripts.
- Export timestamped transcripts as TXT or SRT files.
- Keep the project beginner-friendly and easy to extend.

## Requirements
**Software:** Windows 10/11, Python 3.10-3.12, Node.js 18+, npm, and a modern browser. FFmpeg is recommended for broad system media support, but the bundled PyAV dependency performs the application conversion path. The first Whisper model download needs internet access; later runs can transcribe offline if the model is cached.

**Hardware:** 4 GB RAM minimum for `tiny` or 8 GB recommended for `base`, a dual-core CPU, approximately 2 GB free disk space for dependencies and model cache, and a microphone for live recording. A GPU is optional.

## Technology Stack
React.js, Vite, Tailwind CSS, Lucide React, Python, FastAPI, Uvicorn, faster-whisper, and FFmpeg.

## Architecture and Workflow
```text
Browser (React + Vite)
  | REST multipart upload
FastAPI API (validation + temporary file)
  | local audio path
faster-whisper / CTranslate2 (cached model)
  | transcript, language, segments
Browser (editable result + local history)
```

The browser creates a `FormData` request. FastAPI validates the extension, language, model, mode, and 100 MB size limit, writes the bytes to a generated temporary filename, and decodes the first audio stream from the container through PyAV. Audio and video are converted to mono 16 kHz PCM WAV before being passed to the cached Whisper model. Both temporary files are removed in a `finally` block whether transcription succeeds or fails.

## Setup on Windows PowerShell
Open two PowerShell windows from the project directory.

### 1. Verify prerequisites
```powershell
python --version
node --version
npm --version
ffmpeg -version
```
Install FFmpeg with `winget install Gyan.FFmpeg`, then reopen PowerShell if `ffmpeg` is not found. Install Python and Node.js from their official sites if needed.

### 2. Backend
```powershell
cd .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```
The first transcription downloads the configured model from Hugging Face. The default is `base`; set `WHISPER_MODEL=tiny` in `.env` if your computer has limited RAM and speed matters more than accuracy.

### 3. Frontend
```powershell
cd ..\frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

### API endpoints
- `GET /health`: backend health response.
- `GET /languages`: supported language codes and labels.
- `GET /models`: available model sizes, modes, and audio types.
- `POST /transcribe`: multipart fields `audio`, `language`, `model`, `mode`, and `audio_type`; returns text, detected language, model, audio duration, processing duration, word count, warnings, and timestamped segments.

Interactive API documentation is available at `http://localhost:8000/docs`.

## Testing Procedure
1. Start both servers and confirm the API connected status is visible.
2. Upload a clear English file, preview it, transcribe it, edit it, copy it, and download it.
3. Repeat with a Hindi recording and select Hindi, then try Nepali or Auto detect.
4. Record from the microphone, stop, preview, and transcribe.
5. Try a non-audio file, an empty file, a silent clip, and a file over 100 MB; verify readable errors.
6. Stop the backend and confirm the frontend reports a failed request without crashing.
7. Inspect the temporary directory after a request; the generated upload file should be removed.
8. Build the frontend with `npm run build` and compile the backend with `python -m compileall app`.

The model is loaded lazily on the first transcription and cached for later requests. `base` is the default balance for a laptop; `small` and `medium` may improve accuracy but require more RAM and processing time. No accuracy percentage is claimed without a verified reference transcript and WER evaluation.

Automated tests are not included yet because real Whisper tests require model downloads and audio fixtures. For a production extension, add pytest tests for validation and cleanup, plus Playwright tests with a fixture audio file.

## Limitations and Future Enhancements
Accuracy depends on the model, audio quality, accent, and hardware. CPU transcription can take longer than the recording. Browser recording typically produces WebM, so FFmpeg must be available for broad format support. Future work can add SRT download, word-level timestamps, authentication, a persistent database, speaker diarization, and a larger model or GPU configuration.

## Project Report Outline
1. Title page and certificate
2. Abstract and keywords
3. Introduction and problem statement
4. Literature review: automatic speech recognition and Whisper
5. Requirements analysis
6. System architecture and module design
7. Technology selection and implementation
8. Database/local-storage and API design
9. Testing strategy and results
10. Screenshots and user workflow
11. Limitations, ethical considerations, and privacy
12. Future scope
13. Conclusion
14. References and appendix

## Official References
- [OpenAI Whisper](https://github.com/openai/whisper)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [FFmpeg](https://ffmpeg.org/)
