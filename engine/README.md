# MuseWave Engine

This directory is the first MuseWave-owned trainable audio model. It does not download or wrap MusicGen, Suno, or another commercial generator. The model combines prompt, lyrics, language, style controls, and random latent tokens, then decodes a six-second stereo segment at 24 kHz.

## Safety and ownership gate

Training rejects unknown licenses. Vocal rows also require a `performer_consent_id`. Never train on scraped songs, celebrity voices, or recordings whose commercial-training rights are unclear.

## Train on a GPU

```bash
cd engine
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python train.py --manifest manifest.jsonl --epochs 20
```

The small default architecture is a development baseline, not a production-quality foundation model. Useful music and intelligible singing require a substantially larger authorized dataset, GPU training, objective evaluations, and listening tests.

## Serve a checkpoint

```bash
MUSEWAVE_CHECKPOINT=checkpoints/musewave-engine.pt \
MUSEWAVE_DEVICE=cuda \
uvicorn musewave_engine.api:app --host 0.0.0.0 --port 8080
```

`GET /health` returns `ready: false` until a trained checkpoint is mounted. `POST /v1/generate` returns WAV only when ready; it never substitutes browser synthesis while claiming neural generation.

