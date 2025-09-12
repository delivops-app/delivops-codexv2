from app.api.deps import require_roles


def test_admin_codex_alias():
    dep = require_roles("ADMIN")
    user = {"roles": ["Admin Codex"]}
    assert dep(user=user) == user


def test_chauffeur_codex_alias():
    dep = require_roles("CHAUFFEUR")
    user = {"roles": ["Chauffeur Codex"]}
    assert dep(user=user) == user

