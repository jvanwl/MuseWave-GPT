"""Train a per-user MuseWave preference model from consented feedback.

Input is a JSONL file with {"features": [...], "rating": 1..5}. The script
never downloads data, rewrites application code, or promotes a model by itself.
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import torch
from torch import nn

from model import PreferenceNetwork


def load_examples(path: Path):
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    if len(rows) < 10:
        raise ValueError("At least 10 consented feedback examples are required")
    width = len(rows[0]["features"])
    if not width or any(len(row["features"]) != width for row in rows):
        raise ValueError("Feature vectors must have one consistent non-zero width")
    x = torch.tensor([row["features"] for row in rows], dtype=torch.float32)
    y = torch.tensor([(row["rating"] - 1) / 4 for row in rows], dtype=torch.float32).unsqueeze(1)
    return x, y, width


def train(input_path: Path, output_path: Path, epochs: int):
    torch.manual_seed(17)
    x, y, width = load_examples(input_path)
    model = PreferenceNetwork(width)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=0.01)
    loss_fn = nn.MSELoss()
    model.train()
    for _ in range(epochs):
        optimizer.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        optimizer.step()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "state_dict": model.state_dict(),
        "feature_count": width,
        "examples": len(x),
        "loss": float(loss.detach()),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "format_version": 1,
    }
    torch.save(artifact, output_path)
    print(json.dumps({key: value for key, value in artifact.items() if key != "state_dict"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=150)
    args = parser.parse_args()
    train(args.input, args.output, max(1, min(args.epochs, 1000)))
