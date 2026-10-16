import hashlib
import hmac
import secrets


def create_capability() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hash_capability(token)


def hash_capability(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_capability(token: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_capability(token), expected_hash)
