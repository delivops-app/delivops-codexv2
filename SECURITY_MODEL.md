# Security Model

## Authentification

- Les utilisateurs s'authentifient via Auth0. Chaque connexion délivre un JWT signé en **RS256**.
- Le backend vérifie `issuer`, `audience`, `exp` et la signature en récupérant automatiquement la clé publique depuis le JWKS Auth0.
- Les informations d'identité principales utilisées par l'application :
  - `sub` (identifiant Auth0 de l'utilisateur),
  - `email`,
  - `https://delivops/roles` (claim personnalisé contenant les rôles applicatifs).

## Autorisation et journalisation

- Les routes sensibles injectent la dépendance `require_roles` qui contrôle la présence du rôle attendu (`ADMIN` ou `CHAUFFEUR`).
- L'accès aux ressources est également borné par le tenant : toutes les requêtes doivent préciser un `X-Tenant-Id` qui est propagé jusqu'aux requêtes SQL.
- Chaque écriture (création, mise à jour, suppression) déclenche la création d'un `AuditLog` avec le tenant, l'utilisateur et l'entité ciblée.

## Modes de fonctionnement

| Mode            | Authentification                       | En-têtes supplémentaires                                    |
|-----------------|----------------------------------------|--------------------------------------------------------------|
| Production      | JWT Auth0 obligatoire (`Authorization`)| `X-Tenant-Id` pour sélectionner le tenant                    |
| Développement   | `DEV_FAKE_AUTH=1` → bypass du JWT      | `X-Tenant-Id`, `X-Dev-Role` (rôle simulé), `X-Dev-Sub` (identité simulée) |

## En-têtes attendus

| En-tête             | Description                                                                 | Environnements |
|---------------------|-----------------------------------------------------------------------------|----------------|
| `Authorization`     | `Bearer <token>` signé par Auth0. Requis hors mode `DEV_FAKE_AUTH`.         | Prod / Préprod |
| `X-Tenant-Id`       | Identifiant numérique du tenant ciblé. Requis sur toutes les requêtes API.  | Tous           |
| `X-Dev-Role`        | Rôle injecté côté front pour simuler Auth0 quand `DEV_FAKE_AUTH=1`.         | Dev uniquement |
| `X-Dev-Sub`         | Identifiant utilisateur simulé. Permet de lier les audits aux faux comptes. | Dev uniquement |

## Rôles applicatifs

| Rôle        | Description fonctionnelle                                      | Rôle Auth0 correspondant |
|-------------|---------------------------------------------------------------|--------------------------|
| `ADMIN`     | Gestion des chauffeurs, des clients et des paramètres tarifaires | `Admin Codex`            |
| `CHAUFFEUR` | Accès restreint à son profil et aux opérations sur ses tournées | `Chauffeur Codex`        |

Ce modèle garantit que chaque action est contextualisée (tenant + utilisateur) et traçable, que ce soit avec un JWT réel ou le mode de développement simulé.
