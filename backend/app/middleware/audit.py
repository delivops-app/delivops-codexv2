import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.user import User
from app.core.config import settings
from app.api import deps

logger = logging.getLogger("audit")


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        tenant_id = request.headers.get(settings.tenant_header_name)
        if tenant_id:
            try:
                db = SessionLocal()
            except Exception:
                db = None
            if db:
                try:
                    try:
                        user = deps.auth_dependency(
                            authorization=request.headers.get("Authorization"),
                            x_dev_role=request.headers.get("X-Dev-Role"),
                            x_dev_sub=request.headers.get("X-Dev-Sub"),
                        )
                    except Exception:
                        user = None

                    user_id = None
                    if user:
                        user_row = (
                            db.query(User)
                            .filter(
                                User.auth0_sub == user.get("sub"),
                                User.tenant_id == int(tenant_id),
                            )
                            .first()
                        )
                        if user_row:
                            user_id = user_row.id

                    audit = AuditLog(
                        tenant_id=int(tenant_id),
                        user_id=user_id,
                        entity=request.url.path,
                        entity_id=0,
                        action=request.method.lower(),
                    )
                    db.add(audit)
                    db.commit()

                    logger.info(
                        "audit",
                        extra={
                            "tenant_id": tenant_id,
                            "user_id": str(user_id) if user_id else "anonymous",
                            "entity": request.url.path,
                            "action": request.method.lower(),
                        },
                    )
                except Exception:
                    pass
                finally:
                    db.close()
        return response
