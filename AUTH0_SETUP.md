# Auth0 Setup

## Création du tenant et de l'API

1. Créez un tenant Auth0 et ajoutez une application **Regular Web App**.
2. Dans **API**, créez une ressource avec l'identifier `https://delivops-codex.api/` et activez **RBAC** ainsi que "Add Permissions in the Access Token".

## Configuration des rôles

- Créez deux rôles côté Auth0 :
  - **Admin Codex** → sera traduit côté application en rôle `ADMIN`.
  - **Chauffeur Codex** → sera traduit en rôle `CHAUFFEUR`.
- Attribuez les permissions Auth0 nécessaires (lecture/écriture de l'API) puis assignez les rôles aux utilisateurs de démonstration.

## Claim personnalisé pour les rôles

1. Dans **Actions → Flows → Login**, ajoutez une action personnalisée.
2. Injectez le tableau des rôles dans le claim `https://delivops/roles` pour que le backend puisse le lire.
3. Déployez l'action et rattachez-la au flow de connexion.

## Configuration de l'application Auth0

Renseignez les URLs autorisées pour l'application :

- **Allowed Callback URLs** : `http://localhost:3000/api/auth/callback`
- **Allowed Logout URLs** : `http://localhost:3000/`
- **Allowed Web Origins** : `http://localhost:3000`
- **Allowed Origins (CORS)** : `http://localhost:3000`

Remplacez `localhost:3000` par votre domaine de production si nécessaire. Conservez l'algorithme **RS256** (valeur par défaut) : le backend récupère la clé publique via JWKS, aucun certificat manuel n'est requis.

## Variables d'environnement à reporter

- **Domain** → `AUTH0_DOMAIN`
- **Client ID / Secret** → `AUTH0_CLIENT_ID` et `AUTH0_CLIENT_SECRET`
- **Audience** → `AUTH0_AUDIENCE`

Copiez ces valeurs dans les fichiers `.env` du backend et du frontend.

## Vérifications

1. Connectez-vous sur le frontend via Auth0.
2. Appelez une route protégée de l'API et vérifiez que le claim `roles` contient `ADMIN` ou `CHAUFFEUR` selon l'utilisateur.
