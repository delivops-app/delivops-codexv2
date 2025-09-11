# Delivops

Monorepo FastAPI + Next.js pour gestion multi-tenant.

## Installation

Prérequis : Docker, Docker Compose, Make.

### Variables d'environnement

Backend (`backend/.env`):
```
DATABASE_URL=postgresql+psycopg://delivops:changeme@db:5432/delivops
AUTH0_DOMAIN=dev-or3c4n80x1rba26g.eu.auth0.com
AUTH0_AUDIENCE=https://delivops-codex.api/
AUTH0_ISSUER=https://dev-or3c4n80x1rba26g.eu.auth0.com/
AUTH0_ALGORITHMS=RS256
TENANT_HEADER_NAME=X-Tenant-Id
LOKI_URL=http://loki:3100/loki/api/v1/push
```

Frontend (`frontend/.env.local` — copier depuis `frontend/.env.example`):
```
AUTH0_SECRET=CHANGEME
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://dev-or3c4n80x1rba26g.eu.auth0.com
AUTH0_CLIENT_ID=CHANGEME
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

### Rôles et permissions

| Rôle      | Permissions principales |
|-----------|------------------------|
| `ADMIN`   | Gestion des chauffeurs et des tarifs |
| `CHAUFFEUR` | Accès restreint à son propre profil |

Les routes sensibles utilisent la dépendance `require_roles` qui vérifie le claim `roles` du JWT.

### Observabilité

Une stack Grafana/Loki est fournie pour consulter les `AuditLog`.
- Grafana: http://localhost:3001
- Dashboard "Chauffeurs par utilisateur" pré‑provisionné.

### Migrations

```bash
make migrate
```

### Seed

```bash
make seed
```

### Simulation d'activité

Permet d'injecter un tenant de démonstration, deux utilisateurs et quelques
chauffeurs afin de tester rapidement l'application.

```bash
python simulate_activity.py
```

Le script ajoute automatiquement `backend` au `PYTHONPATH` et se connecte par
défaut à la base locale (`localhost:5432`) si `DATABASE_URL` n'est pas défini.

### Tests

```bash
make test
```

Exports générés dans `backend/storage/exports`.
