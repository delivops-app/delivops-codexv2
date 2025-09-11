# Security Model

- Auth0 fournit les JWT signés en RS256.
- L'API vérifie `issuer`, `audience` et expiration via JWKS.
- Multi-tenant via l'en-tête `X-Tenant-Id`.
- Mode développement optionnel avec `DEV_FAKE_AUTH` et en-têtes `X-Dev-Role`/`X-Dev-Sub`.

## Rôles

- `ADMIN` : gestion des chauffeurs, gestion des tarifs.
- `CHAUFFEUR` : accès restreint à son propre profil.
