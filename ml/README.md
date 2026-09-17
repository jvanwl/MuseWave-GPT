# MuseWave learning service

This directory contains an optional PyTorch preference network. It learns from explicit, consented ratings—not private conversations or uncontrolled web scraping.

The network ranks music concepts for one user. Training is offline and produces a versioned artifact that must be evaluated and promoted by the application owner. It cannot modify application code or deploy itself.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
python ml/train.py --input data/user-feedback.jsonl --output models/user-v1.pt
```

Production requirements include encrypted per-user datasets, deletion/export controls, train/evaluation splits, drift monitoring, a model registry, rollback, bias tests, and authenticated job orchestration.
