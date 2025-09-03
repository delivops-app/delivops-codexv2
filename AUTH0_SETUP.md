# Auth0 Setup

1. Créer un tenant Auth0 et une Application **Regular Web App**.
2. Activer **RBAC** et "Add Permissions in the Access Token".
3. Créer une API avec l'Identifier `https://delivops-codex.api/`.
4. Ajouter les rôles `ADMIN` et `CHAUFFEUR` et une Action pour injecter le claim `https://delivops/roles`.
5. Dans l'application, renseigner:
   - Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000/`
   - Allowed Web Origins: `http://localhost:3000`
6. Récupérer Domain, Client ID, Client Secret et remplir les fichiers `.env`.
7. Tester login/logout sur le front puis appel d'API protégée.
