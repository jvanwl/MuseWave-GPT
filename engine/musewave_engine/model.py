import torch
from torch import nn
from .config import CONFIG, EngineConfig


class ConditionEncoder(nn.Module):
    def __init__(self, cfg: EngineConfig):
        super().__init__()
        self.embedding = nn.Embedding(cfg.vocab_size, cfg.latent_dim, padding_idx=0)
        layer = nn.TransformerEncoderLayer(cfg.latent_dim, 8, cfg.latent_dim * 4, batch_first=True)
        self.transformer = nn.TransformerEncoder(layer, 4)
        self.style = nn.Sequential(nn.Linear(5, cfg.latent_dim), nn.SiLU(), nn.Linear(cfg.latent_dim, cfg.latent_dim))

    def forward(self, tokens: torch.Tensor, style: torch.Tensor) -> torch.Tensor:
        mask = tokens.eq(0)
        encoded = self.transformer(self.embedding(tokens), src_key_padding_mask=mask)
        valid = (~mask).unsqueeze(-1)
        pooled = (encoded * valid).sum(1) / valid.sum(1).clamp_min(1)
        return pooled + self.style(style)


class MuseWaveGenerator(nn.Module):
    """Conditional latent generator trained only on licensed MuseWave manifests."""

    def __init__(self, cfg: EngineConfig = CONFIG):
        super().__init__()
        self.cfg = cfg
        self.condition = ConditionEncoder(cfg)
        self.seed_projection = nn.Linear(cfg.latent_dim, cfg.latent_dim)
        layer = nn.TransformerEncoderLayer(cfg.latent_dim, 8, cfg.latent_dim * 4, batch_first=True)
        self.music_transformer = nn.TransformerEncoder(layer, 8)
        self.decoder = nn.Sequential(
            nn.ConvTranspose1d(cfg.latent_dim, 256, 8, 4, 2), nn.GELU(),
            nn.ConvTranspose1d(256, 128, 8, 4, 2), nn.GELU(),
            nn.ConvTranspose1d(128, 64, 8, 4, 2), nn.GELU(),
            nn.ConvTranspose1d(64, 32, 6, 3, 2), nn.GELU(),
            nn.ConvTranspose1d(32, 2, 4, 2, 1), nn.Tanh(),
        )

    def forward(self, tokens: torch.Tensor, style: torch.Tensor, noise: torch.Tensor) -> torch.Tensor:
        condition = self.condition(tokens, style).unsqueeze(1)
        latent = self.music_transformer(self.seed_projection(noise) + condition)
        audio = self.decoder(latent.transpose(1, 2))
        audio = nn.functional.pad(audio, (0, max(0, self.cfg.samples - audio.shape[-1])))
        return audio[..., : self.cfg.samples]

    @torch.inference_mode()
    def generate(self, tokens: torch.Tensor, style: torch.Tensor, seed: int) -> torch.Tensor:
        generator = torch.Generator(device=tokens.device).manual_seed(seed)
        noise = torch.randn(tokens.shape[0], self.cfg.latent_steps, self.cfg.latent_dim, generator=generator, device=tokens.device)
        return self(tokens, style, noise)
