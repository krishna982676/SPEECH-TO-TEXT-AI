import time
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .audio_processing import AudioProcessingError, preprocess_audio
from .config import AUDIO_TYPES, AVAILABLE_MODELS, CORS_ORIGINS, DEFAULT_MODE, MAX_UPLOAD_BYTES, MODEL_SIZE, SUPPORTED_EXTENSIONS, SUPPORTED_LANGUAGES
from .schemas import TranscriptionResponse
from .transcription import get_audio_duration, get_model, transcribe_file

app = FastAPI(title="Whisper Studio API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model_ready": get_model.cache_info().currsize > 0, "default_model": MODEL_SIZE}


@app.get("/languages")
def languages():
    return {"languages": [{"code": code, "name": name} for code, name in SUPPORTED_LANGUAGES.items()]}


@app.get("/models")
def models():
    return {
        "models": [
            {"id": "tiny", "name": "Tiny", "description": "Fastest; lowest accuracy and memory use."},
            {"id": "base", "name": "Base", "description": "Balanced choice for local laptops."},
            {"id": "small", "name": "Small", "description": "Higher accuracy; slower and more memory."},
            {"id": "medium", "name": "Medium", "description": "Highest local accuracy; demanding hardware."},
        ],
        "default_model": MODEL_SIZE,
        "default_mode": DEFAULT_MODE,
        "audio_types": [{"id": code, "name": name} for code, name in AUDIO_TYPES.items()],
    }


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    model: str = Form(MODEL_SIZE),
    mode: str = Form(DEFAULT_MODE),
    audio_type: str = Form("speech"),
):
    extension = Path(audio.filename or "").suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported audio format. Use WAV, MP3, M4A, FLAC, OGG, or WebM.")
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language selection.")
    if model not in AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail="Unsupported model selection.")
    if mode not in {"fast", "accuracy"}:
        raise HTTPException(status_code=400, detail="Unsupported transcription mode.")
    if audio_type not in AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported audio type.")

    content = await audio.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Audio file is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded audio file is empty.")

    started = time.perf_counter()
    temporary_path = None
    processed_path = None
    try:
        with NamedTemporaryFile(delete=False, suffix=extension) as temporary_file:
            temporary_file.write(content)
            temporary_path = Path(temporary_file.name)
        with NamedTemporaryFile(delete=False, suffix=".wav") as processed_file:
            processed_path = Path(processed_file.name)
        processing_warnings = preprocess_audio(temporary_path, processed_path)
        audio_duration = get_audio_duration(processed_path)
        if audio_duration is not None and audio_duration < 0.4:
            raise HTTPException(status_code=422, detail="The recording is too short. Use an audio clip longer than half a second.")
        text, info, segments = transcribe_file(processed_path, language, model, mode, audio_type)
        elapsed = time.perf_counter() - started
        if not text:
            raise HTTPException(status_code=422, detail="No speech was detected. Try a clearer or longer recording.")
        return TranscriptionResponse(
            text=text,
            detected_language=info.language,
            language_probability=info.language_probability,
            processing_seconds=round(elapsed, 2),
            audio_duration_seconds=audio_duration,
            model=model,
            mode=mode,
            audio_type=audio_type,
            word_count=len(text.split()),
            warnings=processing_warnings + (["Singing, instruments, and overlapping vocals can reduce lyric accuracy."] if audio_type == "song" else []),
            segments=segments,
        )
    except HTTPException:
        raise
    except AudioProcessingError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {type(error).__name__}.") from error
    finally:
        if temporary_path:
            temporary_path.unlink(missing_ok=True)
        if processed_path:
            processed_path.unlink(missing_ok=True)
