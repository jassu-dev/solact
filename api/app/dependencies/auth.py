from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Tuple, Optional
from datetime import datetime
import re
import secrets

from ..database import get_db
from ..security import decode_token
from ..models import User, Organization, Store
from ..config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False)


def _create_slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.lower()).strip("-")
    suffix = secrets.token_hex(3)
    return f"{s}-{suffix}"


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    if not payload or payload.get("type") != "access" or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    user.last_login_at = datetime.utcnow()
    try:
        db.commit()
    except Exception:
        db.rollback()
    return user


def get_current_org(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organization:
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return org


def require_store_access(
    store_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Tuple[User, Store]:
    store = db.query(Store).filter(
        Store.id == store_id,
        Store.organization_id == user.organization_id,
    ).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return user, store


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def require_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin" and user.email != "admin@solact.in":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Admin privileges required to access this resource",
        )
    return user
