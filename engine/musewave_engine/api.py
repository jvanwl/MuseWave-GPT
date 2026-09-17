import hashlib
import io
from pathlib import Path
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field
from . import __version__
from .config import CHECKPOINT_PATH, CONFIG, MODEL_DEVICE
from .model import MuseWaveGenerator
from .tokenizer import tokenize


app = FastAPI(title="MuseWave Engine", version=__version__)
device = torch.device(MODEL_DEVICE if MODEL_DEVICE == "cpu" or torch.cuda.is_available() else "cpu")
model: MuseWaveGenerator | None = None


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1500)
    lyrics: str = Field(default="", max_length=4000)
    language: str = Field(default="English", max_length=40)
    genre: str = Field(default="Pop", max_length=40)
    mood: str = Field(default="Dreamy", max_length=40)
    bpm: int = Field(default=110, ge=50, le=220)
    energy: int = Field(default=3, ge=1, le=5)
    mode: str = Field(default="instrumental", pattern="^(instrumental|vocal)$")
    seed: int | None = None


@app.on_event("startup")
def load_checkpoint() -> None:
    global model
    path = Path(CHECKPOINT_PATH)
    if not path.exists():
        return
    checkpoint = torch.load(path, map_location=device, weights_only=True)
    candidate = MuseWaveGenerator().to(device)
    candidate.load_state_dict(checkpoint["model"])
    candidate.eval()
    model = candidate


@app.get("/health")
def health():
    return {"ok": True, "ready": model is not None, "version": __version__, "device": str(device), "checkpoint": Path(CHECKPOINT_PATH).name if model else None}


@app.post("/v1/generate")
def generate(request: GenerateRequest):
    if model is None:
        raise HTTPException(503, "MuseWave checkpoint is not trained or mounted")
    text = f"{request.genre}; {request.mood}; {request.prompt}; lyrics: {request.lyrics}; language: {request.language}"
    tokens = tokenize(text, CONFIG.vocab_size, CONFIG.max_text_tokens).unsqueeze(0).to(device)
    style = torch.tensor([[request.bpm / 200, request.energy / 5, request.mode == "vocal", CONFIG.segment_seconds / 300, 1]], device=device)
    seed = request.seed if request.seed is not None else int.from_bytes(hashlib.blake2b(text.encode(), digest_size=4).digest(), "little")
    audio = model.generate(tokens, style, seed)[0].transpose(0, 1).cpu().numpy()
    stream = io.BytesIO()
    sf.write(stream, audio, CONFIG.sample_rate, format="WAV", subtype="PCM_16")
    return Response(stream.getvalue(), media_type="audio/wav", headers={"X-MuseWave-Seed": str(seed)})

