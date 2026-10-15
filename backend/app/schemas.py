from typing import Optional
from pydantic import BaseModel, Field


class Segment(BaseModel):
    start: float
    end: float
    text: str


class TranscriptionResponse(BaseModel):
    text: str
    detected_language: str
    language_probability: Optional[float] = None
    processing_seconds: float
    audio_duration_seconds: Optional[float] = None
    model: str
    mode: str
    audio_type: str
    word_count: int
    warnings: list[str] = Field(default_factory=list)
    segments: list[Segment]
