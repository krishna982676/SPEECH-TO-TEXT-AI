from functools import lru_cache
from pathlib import Path
import av
from faster_whisper import WhisperModel

from .config import COMPUTE_TYPE, DEVICE, MODEL_SIZE


@lru_cache(maxsize=4)
def get_model(model_size: str = MODEL_SIZE) -> WhisperModel:
    return WhisperModel(model_size, device=DEVICE, compute_type=COMPUTE_TYPE)


def get_audio_duration(audio_path: Path) -> float | None:
    try:
        with av.open(str(audio_path)) as container:
            duration = container.duration
            return round(duration / av.time_base, 2) if duration else None
    except (av.error.FFmpegError, ValueError):
        return None


def transcribe_file(audio_path: Path, language: str | None = None, model_size: str = MODEL_SIZE, mode: str = "fast", audio_type: str = "speech"):
    model = get_model(model_size)
    whisper_language = None if not language or language == "auto" else language

    def collect_segments(vad_filter: bool):
        segments, info = model.transcribe(
            str(audio_path),
            language=whisper_language,
            vad_filter=vad_filter,
            beam_size=5 if mode == "fast" else 8,
            best_of=5 if mode == "fast" else 8,
            patience=1 if mode == "fast" else 1.2,
            repetition_penalty=1.05 if mode == "accuracy" else 1,
            no_repeat_ngram_size=3 if mode == "accuracy" else 0,
            condition_on_previous_text=audio_type != "song",
            temperature=(0.0, 0.2, 0.4) if mode == "accuracy" else (0.0, 0.2),
            no_speech_threshold=0.35 if audio_type == "song" else 0.6,
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0,
            chunk_length=30,
            vad_parameters={"min_silence_duration_ms": 700} if vad_filter else None,
        )
        segment_list = []
        text_parts = []
        for segment in segments:
            segment_text = segment.text.strip()
            if segment_text:
                text_parts.append(segment_text)
                segment_list.append({"start": segment.start, "end": segment.end, "text": segment_text})
        return " ".join(text_parts).strip(), info, segment_list

    text, info, segment_list = collect_segments(vad_filter=True)
    if not text:
        text, info, segment_list = collect_segments(vad_filter=False)
    return text, info, segment_list
