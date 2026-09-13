import pytest
import jwt as pyjwt
from datetime import datetime, timedelta
from sqlalchemy import select

from tests.fixtures import *  # noqa: F401
from app.security import (
    create_access_token, decode_token, verify_password, get_password_hash,
    encrypt_value, decrypt_value,
)
from app.config import settings


def test_jwt_roundtrip():
    token, exp = create_access_token({"sub": "42", "org_id": "1"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["org_id"] == "1"
    assert payload["type"] == "access"


def test_jwt_expired():
    token, _ = create_access_token({"sub": "1"}, expires_delta=timedelta(microseconds=-1))
    assert decode_token(token) is None


def test_jwt_invalid_secret():
    token, _ = create_access_token({"sub": "1"})
    real_secret = settings.JWT_SECRET
    try:
        settings.JWT_SECRET = "wrong"
        assert decode_token(token) is None
    finally:
        settings.JWT_SECRET = real_secret


def test_jwt_bad_format():
    assert decode_token("not-a-token") is None
    assert decode_token("") is None


def test_password_hashing():
    h = get_password_hash("hello123")
    assert verify_password("hello123", h)
    assert not verify_password("wrong", h)


def test_encryption_roundtrip():
    v = encrypt_value("my-secret-token")
    assert "my-secret-token" not in v
    assert decrypt_value(v) == "my-secret-token"
    assert decrypt_value("") == ""
