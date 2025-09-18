"""Services liés aux chauffeurs."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.chauffeur import Chauffeur
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.chauffeur import ChauffeurCreate, ChauffeurUpdate


class TenantNotFoundError(Exception):
    """Aucun tenant n'a été trouvé pour l'identifiant donné."""


class ChauffeurNotFoundError(Exception):
    """Aucun chauffeur ne correspond à l'identifiant fourni."""


class ChauffeurLimitReachedError(Exception):
    """Le nombre maximal de chauffeurs autorisés pour le tenant est atteint."""


class ChauffeurService:
    """Encapsule la logique métier autour des chauffeurs."""

    def __init__(self, db: Session, tenant_id: int) -> None:
        self.db = db
        self.tenant_id = tenant_id

    def count_and_subscription(self) -> tuple[int, int | None]:
        """Retourne le nombre de chauffeurs et le quota du tenant."""

        tenant = self.db.get(Tenant, self.tenant_id)
        count = self._query().count()
        subscribed = tenant.max_chauffeurs if tenant else 0
        return count, subscribed

    def list(self) -> list[Chauffeur]:
        """Liste tous les chauffeurs du tenant."""

        return self._query().all()

    def create(self, chauffeur_in: ChauffeurCreate, auth0_sub: str | None) -> Chauffeur:
        """Crée un chauffeur pour le tenant courant."""

        tenant = self._ensure_tenant()
        current = self._query().count()
        if tenant.max_chauffeurs and current >= tenant.max_chauffeurs:
            raise ChauffeurLimitReachedError("Driver limit reached")

        chauffeur = Chauffeur(
            tenant_id=self.tenant_id,
            email=chauffeur_in.email,
            display_name=chauffeur_in.display_name,
        )
        self.db.add(chauffeur)
        self.db.flush()

        user_id = self._resolve_user_id(auth0_sub)
        self._record_audit("create", chauffeur.id, user_id)

        self.db.commit()
        self.db.refresh(chauffeur)
        return chauffeur

    def update(
        self,
        chauffeur_id: int,
        chauffeur_in: ChauffeurUpdate,
        auth0_sub: str | None,
    ) -> Chauffeur:
        """Met à jour un chauffeur existant."""

        chauffeur = self._get_chauffeur(chauffeur_id)

        if chauffeur_in.email is not None:
            chauffeur.email = chauffeur_in.email
        if chauffeur_in.display_name is not None:
            chauffeur.display_name = chauffeur_in.display_name
        if chauffeur_in.is_active is not None:
            chauffeur.is_active = chauffeur_in.is_active

        user_id = self._resolve_user_id(auth0_sub)
        self._record_audit("update", chauffeur.id, user_id)

        self.db.commit()
        self.db.refresh(chauffeur)
        return chauffeur

    def delete(self, chauffeur_id: int, auth0_sub: str | None) -> None:
        """Supprime un chauffeur."""

        chauffeur = self._get_chauffeur(chauffeur_id)
        user_id = self._resolve_user_id(auth0_sub)

        self.db.delete(chauffeur)
        self._record_audit("delete", chauffeur_id, user_id)
        self.db.commit()

    # Helpers -----------------------------------------------------------------

    def _query(self):
        return self.db.query(Chauffeur).filter(Chauffeur.tenant_id == self.tenant_id)

    def _ensure_tenant(self) -> Tenant:
        tenant = self.db.get(Tenant, self.tenant_id)
        if tenant is None:
            raise TenantNotFoundError
        return tenant

    def _get_chauffeur(self, chauffeur_id: int) -> Chauffeur:
        chauffeur = (
            self._query().filter(Chauffeur.id == chauffeur_id).first()
        )
        if chauffeur is None:
            raise ChauffeurNotFoundError
        return chauffeur

    def _resolve_user_id(self, auth0_sub: str | None) -> int | None:
        if not auth0_sub:
            return None
        user = (
            self.db.query(User)
            .filter(User.auth0_sub == auth0_sub, User.tenant_id == self.tenant_id)
            .first()
        )
        return user.id if user else None

    def _record_audit(self, action: str, entity_id: int, user_id: int | None) -> None:
        audit = AuditLog(
            tenant_id=self.tenant_id,
            user_id=user_id,
            entity="chauffeur",
            entity_id=entity_id,
            action=action,
        )
        self.db.add(audit)
