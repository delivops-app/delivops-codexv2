# Delivops

Monorepo FastAPI + Next.js pour gestion multi-tenant.

## Installation

Prérequis : Docker, Docker Compose, Make.

### Variables d'environnement

Backend (`backend/.env`):
```
DATABASE_URL=postgresql+psycopg://delivops:delivops_pw@db:5432/delivops
AUTH0_DOMAIN=dev-or3c4n80x1rba26g.eu.auth0.com
AUTH0_AUDIENCE=https://delivops-codex.api/
AUTH0_ISSUER=https://dev-or3c4n80x1rba26g.eu.auth0.com/
AUTH0_ALGORITHMS=RS256
TENANT_HEADER_NAME=X-Tenant-Id
```

Frontend (`frontend/.env.local` — copier depuis `frontend/.env.example`):
```
AUTH0_SECRET=CHANGEME
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://dev-or3c4n80x1rba26g.eu.auth0.com
AUTH0_CLIENT_ID=PK59VAA6Ysw5jEjwJPvZMNjJuikcG6eC
AUTH0_CLIENT_SECRET=CHANGEME
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_AUTH0_AUDIENCE=https://delivops-codex.api/
```

Le fichier `.env.local` est automatiquement chargé par `docker-compose`.

## Lancement

```bash
make dev
```

API: http://localhost:8000
Web: http://localhost:3000

### Migrations

```bash
make migrate
```

### Seed

```bash
make seed
```

### Tests

```bash
make test
```

Exports générés dans `backend/storage/exports`.
