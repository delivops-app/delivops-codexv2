# Delivops

Monorepo FastAPI + Next.js pour gestion multi-tenant.

## Aperçu de l'architecture

- **Backend** (`backend/`) : API FastAPI, persistance PostgreSQL via SQLAlchemy et traçabilité des actions dans `AuditLog`.
- **Frontend** (`frontend/`) : application Next.js App Router, authentification Auth0 et intégration avec l'API.
- **Observabilité** (`observability/`) : stack Grafana + Loki pour consulter les audits et les métriques techniques.

## Installation

### Prérequis

- Docker & Docker Compose
- Make

### Configuration backend

Créez `backend/.env` avec les variables suivantes :

```
DATABASE_URL=postgresql+psycopg://delivops:changeme@db:5432/delivops
AUTH0_DOMAIN=dev-or3c4n80x1rba26g.eu.auth0.com
AUTH0_AUDIENCE=https://delivops-codex.api/
AUTH0_ISSUER=https://dev-or3c4n80x1rba26g.eu.auth0.com/
AUTH0_ALGORITHMS=RS256
TENANT_HEADER_NAME=X-Tenant-Id
DEV_FAKE_AUTH=1
LOKI_URL=http://loki:3100/loki/api/v1/push
```

`DEV_FAKE_AUTH` active un mode de développement sans Auth0 : les appels doivent alors renseigner les en-têtes `X-Dev-Role` et `X-Dev-Sub`.

### Configuration frontend

Dupliquez `frontend/.env.example` vers `frontend/.env.local` et complétez :

```
AUTH0_SECRET=CHANGEME
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://dev-or3c4n80x1rba26g.eu.auth0.com
AUTH0_CLIENT_ID=CHANGEME
AUTH0_CLIENT_SECRET=CHANGEME
NEXT_PUBLIC_API_BASE=/api/proxy
API_BASE_INTERNAL=http://localhost:8000
NEXT_PUBLIC_AUTH0_AUDIENCE=https://delivops-codex.api/
NEXT_PUBLIC_DEV_ROLE=ADMIN
NEXT_PUBLIC_DEV_SUB=demo-user
NEXT_PUBLIC_DEV_DRIVER_SUB=dev|driver
```

- `NEXT_PUBLIC_API_BASE` pointe vers le proxy Next.js (`/api/proxy`) qui relaie les appels navigateur vers FastAPI.
- `NEXT_PUBLIC_DEV_ROLE` et `NEXT_PUBLIC_DEV_SUB` pilotent les entêtes injectés par le front lorsque `DEV_FAKE_AUTH=1`.
- `NEXT_PUBLIC_DEV_DRIVER_SUB` correspond au compte chauffeur de démonstration (utilisé pour simuler la déclaration de tournée en développement).
- `API_BASE_INTERNAL` est utilisé par le rendu côté serveur de Next.js. En environnement Docker, remplacez-le par `http://api:8000` (valeur déjà fournie dans `.env.local`).
- `API_PROXY_TARGET` permet de surcharger la destination du proxy Next.js. Par défaut, les requêtes `/api/proxy` sont redirigées vers `http://localhost:8000`. Dans l'environnement Docker Compose, cette variable est définie à `http://api:8000` pour viser le conteneur FastAPI ; ajustez-la si votre API est exposée sur un autre hôte.

Le fichier `.env.local` est automatiquement pris en compte par `docker-compose`.

### Auth0 et mode développement

- En production, configurez Auth0 avec un rôle `Admin Codex` (claim `ADMIN`) et un rôle `Chauffeur Codex` (claim `CHAUFFEUR`).
- En local, laissez `DEV_FAKE_AUTH=1` pour contourner Auth0 tout en conservant les contrôles de rôle.
- Les détails pas-à-pas sont disponibles dans [`AUTH0_SETUP.md`](AUTH0_SETUP.md).

## Lancement

```bash
make dev
```

Les services sont ensuite accessibles :

- API : http://localhost:8000
- Frontend : http://localhost:3000
- pgAdmin : http://localhost:5050

## Rôles et permissions

| Rôle        | Permissions principales                              |
|-------------|------------------------------------------------------|
| `ADMIN`     | Gestion des chauffeurs, des clients et des tarifs    |
| `CHAUFFEUR` | Accès restreint à son propre profil et aux tournées |

Les routes protégées utilisent la dépendance `require_roles` qui vérifie le claim `roles` du JWT.

## Observabilité

Une stack Grafana/Loki accompagne le projet pour le suivi des `AuditLog` :

- Grafana : http://localhost:3001
- Dashboard "Chauffeurs par utilisateur" pré-provisionné.

## Administration de la base de données

pgAdmin est intégré à l'environnement Docker Compose pour administrer la base PostgreSQL.

- URL : http://localhost:5050
- Identifiant : `admin@delivops.local`
- Mot de passe : `changeme` (ou la valeur fournie via `PGADMIN_DEFAULT_PASSWORD`)

Pour définir un mot de passe différent, exportez `PGADMIN_DEFAULT_PASSWORD` dans votre shell ou renseignez-le dans un fichier `.env` chargé par Docker Compose avant de lancer `make dev`.

## Gestion des données

### Migrations

```bash
make migrate
```

### Seed

```bash
make seed
```

### Simulation d'activité

Injecte un tenant de démonstration, des utilisateurs et plusieurs chauffeurs pour tester rapidement l'application.

```bash
python simulate_activity.py
```

Le script ajoute automatiquement `backend` au `PYTHONPATH` et se connecte par défaut à la base locale (`localhost:5432`) si `DATABASE_URL` n'est pas défini.

## Tests

```bash
make test
```

Les exports générés par les tests sont disponibles dans `backend/storage/exports`.
