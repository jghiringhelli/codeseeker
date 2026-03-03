# Python: Pydantic v2 schemas with field validators
# Paradigm: Declarative validation, data classes, type annotations
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional, List, Annotated

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
    model_validator,
    ConfigDict,
)

ALLOWED_ROLES = {"admin", "user", "moderator", "viewer"}
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,50}$")
PASSWORD_MIN_LENGTH = 8


class UserCreateSchema(BaseModel):
    """Schema for creating a new user account."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    username: Annotated[str, Field(min_length=3, max_length=50)]
    password: Annotated[str, Field(min_length=PASSWORD_MIN_LENGTH)]
    roles: List[str] = Field(default_factory=list)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not USERNAME_PATTERN.match(v):
            raise ValueError("Username must be 3-50 alphanumeric characters or underscores")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: List[str]) -> List[str]:
        invalid = set(v) - ALLOWED_ROLES
        if invalid:
            raise ValueError(f"Unknown roles: {sorted(invalid)}")
        return v


class UserUpdateSchema(BaseModel):
    """Schema for partial update — all fields optional."""

    email: Optional[EmailStr] = None
    username: Optional[str] = None
    roles: Optional[List[str]] = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> UserUpdateSchema:
        if all(v is None for v in (self.email, self.username, self.roles)):
            raise ValueError("At least one field must be provided for update")
        return self


class UserResponseSchema(BaseModel):
    """Schema for serialising a user record in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    roles: List[str]
    created_at: datetime
    updated_at: Optional[datetime] = None
