from pathlib import Path
import wave

import av


class AudioProcessingError(Exception):
    """Raised when a media container cannot be decoded into audio."""


def preprocess_audio(source_path: Path, output_path: Path) -> list[str]:
    """Extract the first audio stream and write stable mono 16 kHz PCM audio."""
    warnings = []
    try:
        with av.open(str(source_path)) as container:
            audio_stream = next((stream for stream in container.streams if stream.type == "audio"), None)
            if audio_stream is None:
                raise AudioProcessingError("The file does not contain an audio stream.")

            resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=16000)
            with wave.open(str(output_path), "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(16000)
                for frame in container.decode(audio_stream.index):
                    for resampled in _resampled_frames(resampler, frame):
                        wav_file.writeframes(resampled.to_ndarray().tobytes())
                for resampled in _resampled_frames(resampler, None):
                    wav_file.writeframes(resampled.to_ndarray().tobytes())
    except AudioProcessingError:
        raise
    except (av.error.FFmpegError, OSError, ValueError) as error:
        raise AudioProcessingError("The audio or video codec could not be decoded. Install FFmpeg and try again.") from error

    warnings.append("Audio was decoded to mono 16 kHz PCM before transcription.")
    return warnings


def _resampled_frames(resampler, frame):
    result = resampler.resample(frame)
    if result is None:
        return []
    return result if isinstance(result, list) else [result]
