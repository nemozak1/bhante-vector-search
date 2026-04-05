"""
Supabase JWT authentication for FastAPI.

Validates incoming Bearer tokens issued by Supabase Auth using asymmetric
signature verification (RS256/ES256) via the project's JWKS endpoint.

Environment variables:
    SUPABASE_URL       - e.g. https://xxxx.supabase.co
    SUPABASE_JWT_AUDIENCE (optional) - defaults to "authenticated"
    SUPABASE_JWT_ISSUER   (optional) - defaults to {SUPABASE_URL}/auth/v1

The JWKS client caches keys in-memory and refreshes on key rotation.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

logger = logging.getLogger(__name__)


def _env_required(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            "Set it in .env (see .env.example)."
        )
    return val


@dataclass(frozen=True)
class AuthConfig:
    supabase_url: str
    audience: str
    issuer: str
    jwks_url: str

    @classmethod
    def from_env(cls) -> "AuthConfig":
        supabase_url = _env_required("SUPABASE_URL").rstrip("/")
        audience = os.environ.get("SUPABASE_JWT_AUDIENCE", "authenticated")
        issuer = os.environ.get(
            "SUPABASE_JWT_ISSUER", f"{supabase_url}/auth/v1"
        )
        jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        return cls(
            supabase_url=supabase_url,
            audience=audience,
            issuer=issuer,
            jwks_url=jwks_url,
        )


# Module-level singletons (lazy-initialized so imports don't fail before env is loaded).
_config: Optional[AuthConfig] = None
_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> tuple[AuthConfig, PyJWKClient]:
    global _config, _jwks_client
    if _config is None or _jwks_client is None:
        _config = AuthConfig.from_env()
        # cache_keys=True keeps fetched keys in-memory; lifespan=3600s.
        _jwks_client = PyJWKClient(
            _config.jwks_url,
            cache_keys=True,
            lifespan=3600,
        )
        logger.info("Initialized Supabase JWKS client (jwks_url=%s)", _config.jwks_url)
    return _config, _jwks_client


@dataclass(frozen=True)
class AuthenticatedUser:
    """The subset of JWT claims we care about."""

    user_id: str
    email: Optional[str]
    role: Optional[str]
    claims: dict

    @property
    def sub(self) -> str:
        return self.user_id


def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> AuthenticatedUser:
    """FastAPI dependency: validate Bearer token and return the user.

    Raises 401 on any validation failure.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()

    try:
        config, jwks_client = _get_jwks_client()
    except Exception as e:
        logger.exception("Auth configuration error")
        raise HTTPException(status_code=500, detail=f"Auth misconfigured: {e}")

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=config.audience,
            issuer=config.issuer,
            leeway=10,  # seconds, for clock skew
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    except Exception as e:
        logger.exception("Unexpected JWT validation error")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {e}",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")

    return AuthenticatedUser(
        user_id=user_id,
        email=payload.get("email"),
        role=payload.get("role"),
        claims=payload,
    )


# Convenience alias for use in route signatures:
#     user: CurrentUser = Depends(get_current_user)
CurrentUser = AuthenticatedUser
RequireUser = Depends(get_current_user)
