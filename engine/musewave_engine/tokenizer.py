import hashlib
import re
import torch


TOKEN_RE = re.compile(r"[\wáéíóúüñçàèìòù'-]+|[^\s]", re.UNICODE)


def _token_id(token: str, vocab_size: int) -> int:
    digest = hashlib.blake2b(token.lower().encode("utf-8"), digest_size=8).digest()
    return 2 + int.from_bytes(digest, "little") % (vocab_size - 2)


def tokenize(text: str, vocab_size: int, length: int) -> torch.Tensor:
    ids = [1] + [_token_id(token, vocab_size) for token in TOKEN_RE.findall(text)]
    ids = ids[:length]
    return torch.tensor(ids + [0] * (length - len(ids)), dtype=torch.long)

