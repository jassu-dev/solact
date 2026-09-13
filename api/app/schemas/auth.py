from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AuthBase:
    pass


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = None
    organization_name: str = Field(min_length=2, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user_id: int
    organization_id: int
    email: str
    name: Optional[str] = None


class UserResponse(ORMBase):
    id: int
    organization_id: int
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime


class OrganizationResponse(ORMBase):
    id: int
    name: str
    slug: str
    created_at: datetime


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    postgres: str = "unknown"
    redis: str = "unknown"
