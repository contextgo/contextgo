from __future__ import annotations

import base64
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from .config import Settings
from .db import User

OIDC_SUPPORTED_SCOPES = ('openid', 'profile', 'email')
OIDC_SUPPORTED_RESPONSE_TYPES = ('code',)
OIDC_SUPPORTED_SUBJECT_TYPES = ('public',)
OIDC_SUPPORTED_ID_TOKEN_ALGORITHMS = ('RS256',)
OIDC_SUPPORTED_CLIENT_AUTH_METHODS = ('client_secret_post', 'client_secret_basic')
OIDC_SUPPORTED_CLAIMS = (
    'sub',
    'email',
    'email_verified',
    'name',
    'preferred_username',
    'picture',
    'iss',
    'aud',
    'iat',
    'exp',
    'nonce',
)


def _base64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def _base64url_decode(raw: str) -> bytes:
    padding_length = (-len(raw)) % 4
    return base64.urlsafe_b64decode(f'{raw}{"=" * padding_length}'.encode('ascii'))


def _int_to_base64url(value: int) -> str:
    length = max(1, (value.bit_length() + 7) // 8)
    return _base64url_encode(value.to_bytes(length, 'big'))


def normalize_scope(scope: Optional[str]) -> str:
    values = []
    seen = set()
    for item in (scope or '').split():
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue

        values.append(normalized)
        seen.add(normalized)

    return ' '.join(values)


def validate_requested_scope(scope: str) -> bool:
    values = scope.split()
    if 'openid' not in values:
        return False

    return all(item in OIDC_SUPPORTED_SCOPES for item in values)


def verify_pkce(code_verifier: Optional[str], code_challenge: Optional[str], code_challenge_method: Optional[str]) -> bool:
    if not code_challenge:
        return True

    if not code_verifier:
        return False

    if code_challenge_method in (None, '', 'plain'):
        return code_verifier == code_challenge

    if code_challenge_method != 'S256':
        return False

    digest = hashlib.sha256(code_verifier.encode('ascii')).digest()
    return _base64url_encode(digest) == code_challenge


@dataclass(frozen=True)
class OidcSigningKeyBundle:
    kid: str
    private_key: rsa.RSAPrivateKey
    jwk: dict[str, str]


def load_oidc_signing_key(settings: Settings) -> OidcSigningKeyBundle:
    pem_value = settings.oidc_signing_key_pem
    if pem_value:
        private_key = serialization.load_pem_private_key(
            pem_value.replace('\\n', '\n').encode('utf-8'),
            password=None,
        )
        if not isinstance(private_key, rsa.RSAPrivateKey):
            raise RuntimeError('CONTEXTGO_OIDC_SIGNING_KEY_PEM must contain an RSA private key')
    else:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    public_numbers = private_key.public_key().public_numbers()
    jwk = {
        'kty': 'RSA',
        'use': 'sig',
        'alg': 'RS256',
        'kid': settings.oidc_signing_key_id,
        'n': _int_to_base64url(public_numbers.n),
        'e': _int_to_base64url(public_numbers.e),
    }
    return OidcSigningKeyBundle(
        kid=settings.oidc_signing_key_id,
        private_key=private_key,
        jwk=jwk,
    )


def create_id_token(
    *,
    signing_key: OidcSigningKeyBundle,
    settings: Settings,
    user: User,
    audience: str,
    nonce: Optional[str],
) -> str:
    now = datetime.now(timezone.utc)
    issued_at = int(now.timestamp())
    expires_at = issued_at + settings.oidc_id_token_ttl_seconds

    header = {
        'alg': 'RS256',
        'kid': signing_key.kid,
        'typ': 'JWT',
    }
    payload = {
        'iss': settings.auth_base_url,
        'sub': user.id,
        'aud': audience,
        'iat': issued_at,
        'exp': expires_at,
        'email': user.email,
        'email_verified': True,
        'name': user.display_name,
        'preferred_username': user.username,
    }
    if user.avatar_url:
        payload['picture'] = user.avatar_url
    if nonce:
        payload['nonce'] = nonce

    signing_input = '.'.join(
        [
            _base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8')),
            _base64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8')),
        ]
    )
    signature = signing_key.private_key.sign(
        signing_input.encode('ascii'),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    return f'{signing_input}.{_base64url_encode(signature)}'


def build_userinfo_payload(user: User) -> dict[str, object]:
    payload: dict[str, object] = {
        'sub': user.id,
        'email': user.email,
        'email_verified': True,
        'name': user.display_name,
        'preferred_username': user.username,
    }
    if user.avatar_url:
        payload['picture'] = user.avatar_url
    return payload


def decode_basic_auth_header(header_value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not header_value:
        return None, None

    scheme, _, raw_token = header_value.partition(' ')
    if scheme.lower() != 'basic' or not raw_token:
        return None, None

    try:
        decoded = _base64url_decode(raw_token.replace('+', '-').replace('/', '_')).decode('utf-8')
    except Exception:
        try:
            decoded = base64.b64decode(raw_token.encode('ascii')).decode('utf-8')
        except Exception:
            return None, None

    username, separator, password = decoded.partition(':')
    if not separator:
        return None, None

    return username, password

