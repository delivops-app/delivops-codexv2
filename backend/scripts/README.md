# Backend Scripts

## Simulation d'une souscription Stripe

Le script `simulate_stripe_subscription.py` rejoue le parcours Stripe sans faire
appel à l'API réelle. Toutes les commandes ci-dessous sont exécutées dans le
conteneur Docker `api` afin de garantir un environnement identique à celui de
développement.

### 1. Vérifier les variables d'environnement

Le fichier `backend/.env` doit contenir des clés Stripe de test. Si rien n'est
renseigné, le script injecte automatiquement des valeurs factices adaptées à la
simulation. Aucune base de données externe n'est requise : une base SQLite en
mémoire est créée à la volée.

### 2. Lancer la simulation par défaut

```bash
docker compose run --rm api python scripts/simulate_stripe_subscription.py --slug demo
```

Cette commande :

1. crée un tenant « demo » dans la base en mémoire ;
2. appelle `POST /billing/create-checkout-session` et affiche l'URL de checkout simulée ;
3. déclenche le webhook `checkout.session.completed` ;
4. affiche l'état de facturation (`/billing/state`) avec les entitlements provisionnés.

### 3. Ajuster les plafonds simulés

Vous pouvez modifier les quotas provisionnés avant le webhook :

```bash
docker compose run --rm api python scripts/simulate_stripe_subscription.py --slug client-x --chauffeurs-max 50 --users-max 20
```

Le script réécrit temporairement les entitlements du plan `EARLY_PARTNER` pour
refléter ces valeurs. L'état final affiché doit indiquer `chauffeurs_max = 50` et
`users_max = 20`.

### 4. Explorer d'autres scénarios

- Pour tester l'échec de paiement ou la résiliation, modifiez le script et
  définissez `stripe_stub.next_event` sur d'autres événements
  (`invoice.payment_failed`, `customer.subscription.deleted`) avant l'appel au
  webhook.
- Les entités créées résident uniquement dans la base mémoire : relancer le
  script redémarre une session vierge.

### 5. Nettoyer

Aucune action n'est nécessaire : la base en mémoire et les overrides FastAPI sont
supprimés lorsque le script se termine.

En suivant ces étapes, vous pouvez vérifier rapidement le comportement du backend
lors d'une souscription Stripe simulée et ajuster vos paramètres avant une mise
en production.

## Simulation d'activité

Le script `simulate_activity.py` renseigne un tenant de démonstration, des
utilisateurs et plusieurs chauffeurs directement dans la base PostgreSQL
utilisée par l'environnement Docker.

```bash
docker compose run --rm api python scripts/simulate_activity.py
```

La commande se connecte via `DATABASE_URL` tel que défini dans `backend/.env`. Le
script doit donc être exécuté depuis le conteneur `api`.
