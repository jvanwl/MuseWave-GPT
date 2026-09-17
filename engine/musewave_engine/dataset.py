import json
from pathlib import Path
import torch
import torchaudio
from torch.utils.data import Dataset
from .config import CONFIG
from .tokenizer import tokenize


ALLOWED_LICENSES = {"CC0-1.0", "CC-BY-4.0", "MUSEWAVE-OWNED", "MUSEWAVE-CONSENT"}


class LicensedAudioDataset(Dataset):
    def __init__(self, manifest: str):
        self.rows = [json.loads(line) for line in Path(manifest).read_text().splitlines() if line.strip()]
        for index, row in enumerate(self.rows, 1):
            if row.get("license") not in ALLOWED_LICENSES:
                raise ValueError(f"Row {index}: unsupported license {row.get('license')!r}")
            if row.get("contains_voice") and not row.get("performer_consent_id"):
                raise ValueError(f"Row {index}: vocal audio requires performer_consent_id")

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        audio, sample_rate = torchaudio.load(row["audio_path"])
        audio = torchaudio.functional.resample(audio, sample_rate, CONFIG.sample_rate)
        audio = audio[:2]
        if audio.shape[0] == 1:
            audio = audio.repeat(2, 1)
        audio = torch.nn.functional.pad(audio, (0, max(0, CONFIG.samples - audio.shape[-1])))[:, : CONFIG.samples]
        prompt = f"{row.get('prompt', '')} [lyrics] {row.get('lyrics', '')} [language] {row.get('language', 'en')}"
        tokens = tokenize(prompt, CONFIG.vocab_size, CONFIG.max_text_tokens)
        style = torch.tensor([row.get("bpm", 100) / 200, row.get("energy", 3) / 5, bool(row.get("contains_voice")), row.get("duration", 6) / 300, row.get("quality", 1)], dtype=torch.float32)
        return tokens, style, audio

