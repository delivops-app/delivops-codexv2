# Résumé des changements (Automatisation du header tenant)

- **Persistance de l'identifiant du tenant** : à partir des paramètres de requête, du stockage local ou du nom d'hôte, l'application retient l'identifiant ou le slug du tenant pour réutilisation dans les appels API suivants.
- **Injection automatique du header `X-Tenant-Id`** : une fois l'information du tenant mémorisée, toutes les requêtes effectuées via le client API incluent automatiquement le header requis sans action supplémentaire de l'utilisateur.
- **Flux de connexion mis à jour** : durant la redirection de connexion, l'application capture les indices de tenant présents dans l'URL de retour et les sauvegarde pour les sessions authentifiées ultérieures.

Ces ajustements garantissent que la première interaction d'un utilisateur avec l'application établit correctement le contexte tenant et que ce contexte est conservé pour toutes les requêtes suivantes.
