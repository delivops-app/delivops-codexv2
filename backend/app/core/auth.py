from typing import Optional
from jose import jwt
from jose.exceptions import JWTError
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings

bearer_scheme = HTTPBearer()


class JWKSCache:
    _jwks = None

    @classmethod
    def get_jwks(cls, force_refresh: bool = False):
        if cls._jwks is None or force_refresh:
            jwks_url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
            response = requests.get(jwks_url, timeout=5)
            response.raise_for_status()
            cls._jwks = response.json()
        return cls._jwks


def decode_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    jwks = JWKSCache.get_jwks()
    key = next((k for k in jwks["keys"] if k["kid"] == header["kid"]), None)
    if key is None:
        jwks = JWKSCache.get_jwks(force_refresh=True)
        key = next((k for k in jwks["keys"] if k["kid"] == header["kid"]), None)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    return jwt.decode(
        token,
        key,
        audience=settings.auth0_audience,
        issuer=settings.auth0_issuer,
        algorithms=[settings.auth0_algorithms],
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    return payload


def dev_fake_auth(role: Optional[str], sub: Optional[str]):
    return {
        "sub": sub or "dev|tester",
        "roles": [role] if role else [],
    }
