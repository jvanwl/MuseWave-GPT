import torch
from torch import nn


class PreferenceNetwork(nn.Module):
    """Small ranking network that predicts a 0–1 preference score."""

    def __init__(self, feature_count: int):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(feature_count, 32),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid(),
        )

    def forward(self, features):
        return self.network(features)
