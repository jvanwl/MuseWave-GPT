import argparse
from pathlib import Path
import torch
from torch.utils.data import DataLoader, random_split
from musewave_engine.config import CONFIG
from musewave_engine.dataset import LicensedAudioDataset
from musewave_engine.model import MuseWaveGenerator


def spectral_loss(prediction, target):
    loss = torch.nn.functional.l1_loss(prediction, target)
    for fft in (512, 1024, 2048):
        pred = torch.stft(prediction.flatten(0, 1), fft, fft // 4, return_complex=True)
        real = torch.stft(target.flatten(0, 1), fft, fft // 4, return_complex=True)
        loss = loss + torch.nn.functional.l1_loss(torch.log1p(pred.abs()), torch.log1p(real.abs()))
    return loss


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", default="checkpoints/musewave-engine.pt")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=2)
    args = parser.parse_args()
    dataset = LicensedAudioDataset(args.manifest)
    if len(dataset) < 10:
        raise SystemExit("At least 10 licensed segments are required for a smoke training run")
    train_size = max(1, int(len(dataset) * .9))
    train, validation = random_split(dataset, [train_size, len(dataset) - train_size], generator=torch.Generator().manual_seed(42))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MuseWaveGenerator().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-4, weight_decay=.01)
    for epoch in range(args.epochs):
        model.train()
        for tokens, style, audio in DataLoader(train, batch_size=args.batch_size, shuffle=True):
            tokens, style, audio = tokens.to(device), style.to(device), audio.to(device)
            noise = torch.randn(tokens.shape[0], CONFIG.latent_steps, CONFIG.latent_dim, device=device)
            loss = spectral_loss(model(tokens, style, noise), audio)
            optimizer.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1); optimizer.step()
        print(f"epoch={epoch + 1} train_loss={loss.item():.4f} validation_segments={len(validation)}")
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"model": model.state_dict(), "config": CONFIG.__dict__, "epochs": args.epochs}, output)


if __name__ == "__main__":
    main()

