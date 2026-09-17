from dataclasses import dataclass
import os


@dataclass(frozen=True)
class EngineConfig:
    sample_rate: int = 24_000
    segment_seconds: int = 6
    latent_steps: int = 375
    latent_dim: int = 128
    vocab_size: int = 8192
    max_text_tokens: int = 192

    @property
    def samples(self) -> int:
        return self.sample_rate * self.segment_seconds


CONFIG = EngineConfig()
CHECKPOINT_PATH = os.getenv("MUSEWAVE_CHECKPOINT", "/models/musewave-engine.pt")
MODEL_DEVICE = os.getenv("MUSEWAVE_DEVICE", "cuda")

