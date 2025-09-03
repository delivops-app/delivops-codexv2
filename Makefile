dev:
docker compose up --build

migrate:
docker compose run --rm api alembic upgrade head

seed:
docker compose run --rm api python seed.py

test:
docker compose run --rm api pytest

fmt:
docker compose run --rm api black app
docker compose run --rm web npm run fmt || true

lint:
docker compose run --rm api ruff app
docker compose run --rm web npm run lint
