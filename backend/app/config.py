from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "100")) * 1024 * 1024
AVAILABLE_MODELS = ("tiny", "base", "small", "medium")
DEFAULT_MODE = os.getenv("WHISPER_MODE", "accuracy")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm", ".mp4", ".mpeg", ".mpga"}
SUPPORTED_LANGUAGES = {
    "auto": "Auto detect",
    "en": "English",
    "hi": "Hindi",
    "ne": "Nepali",
    "bn": "Bengali",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
}

AUDIO_TYPES = {
    "speech": "General speech",
    "lecture": "Lecture / meeting",
    "song": "Song / vocals",
}
