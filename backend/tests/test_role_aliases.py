import pytest
from fastapi import HTTPException, status

from app.api.deps import require_roles


def test_admin_codex_alias():
    dep = require_roles("ADMIN")
    user = {"roles": ["Admin Codex"]}
    assert dep(user=user) == user


def test_chauffeur_codex_alias():
    dep = require_roles("CHAUFFEUR")
    user = {"roles": ["Chauffeur Codex"]}
    assert dep(user=user) == user


def test_require_roles_handles_none_roles():
    dep = require_roles("ADMIN")
    with pytest.raises(HTTPException) as exc:
        dep(user={"roles": None})
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN


def test_require_roles_accepts_string_role():
    dep = require_roles("ADMIN")
    user = {"roles": "ADMIN"}
    assert dep(user=user) == user

