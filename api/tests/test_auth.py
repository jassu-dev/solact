import pytest
from datetime import datetime
from sqlalchemy import select

from tests.fixtures import *  # noqa: F401
from app.models import User, Organization
from app.security import decode_token, verify_password


def test_register(client, db):
    r = client.post("/api/v1/auth/register", json={
        "email": "new@test.com",
        "password": "SecurePass123!",
        "name": "New User",
        "organization_name": "New Org",
    })
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data
    assert data["email"] == "new@test.com"
    user = db.execute(select(User).where(User.email == "new@test.com")).scalar_one()
    assert user.organization_id is not None
    assert verify_password("SecurePass123!", user.password_hash)
    assert user.role == "owner"
    org = db.get(Organization, user.organization_id)
    assert org is not None
    assert org.name == "New Org"


def test_register_duplicate_email(client, seeded_org):
    r = client.post("/api/v1/auth/register", json={
        "email": "owner@test.com", "password": "Password123!",
        "organization_name": "Dup",
    })
    assert r.status_code == 409


def test_login_success(client, seeded_org):
    r = client.post("/api/v1/auth/login", json={
        "email": "owner@test.com", "password": "Password123!",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["token_type"] == "bearer"
    payload = decode_token(data["access_token"])
    assert payload is not None
    assert int(payload["sub"]) == seeded_org["user"].id


def test_login_bad_password(client, seeded_org):
    r = client.post("/api/v1/auth/login", json={
        "email": "owner@test.com", "password": "WrongPass123!",
    })
    assert r.status_code == 401


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_returns_user(client, auth_headers):
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "owner@test.com"
