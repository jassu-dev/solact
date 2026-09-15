from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..models import User, Organization
from ..schemas.auth import RegisterRequest, TokenResponse
from ..security import (
    get_password_hash,
    verify_password,
    create_access_token,
)


def _create_slug(name: str) -> str:
    import re, secrets
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.lower()).strip("-")
    suffix = secrets.token_hex(3)
    return f"{s}-{suffix}"


def register_user(db: Session, req: RegisterRequest) -> Tuple[User, Organization]:
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )
    org = Organization(
        name=req.organization_name,
        slug=_create_slug(req.organization_name),
    )
    db.add(org)
    db.flush()

    user = User(
        organization_id=org.id,
        email=req.email.lower(),
        name=req.name,
        password_hash=get_password_hash(req.password),
        role="admin" if req.email.lower() == "admin@solact.in" else "merchant",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(org)
    return user, org


def login_user(db: Session, email: str, password: str) -> TokenResponse:
    try:
        user = db.query(User).filter(User.email == email.lower()).first()
    except Exception as query_err:
        import logging
        logging.getLogger("solact.api").error(f"Database query error in login_user: {query_err}")
        from ..database import Base, engine
        Base.metadata.create_all(bind=engine)
        user = db.query(User).filter(User.email == email.lower()).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials or register a new account.",
        )
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials or register a new account.",
        )
    token, expire = create_access_token(
        subject={"sub": str(user.id), "org_id": user.organization_id},
    )
    return TokenResponse(
        access_token=token,
        expires_at=expire,
        user_id=user.id,
        organization_id=user.organization_id,
        email=user.email,
        name=user.name,
    )
    return TokenResponse(
        access_token=token,
        expires_at=expire,
        user_id=user.id,
        organization_id=user.organization_id,
        email=user.email,
        name=user.name,
    )
