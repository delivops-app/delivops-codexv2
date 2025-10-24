# Backend Scripts

## Simulation d'une souscription Stripe

Ce dépôt inclut le script `simulate_stripe_subscription.py` qui permet de rejouer le
parcours Stripe sans dépendre de l'API réelle. Voici les étapes pour lancer la
simulation de bout en bout.

### 1. Préparer l'environnement Python

Assurez-vous d'exécuter les commandes dans un shell où les dépendances du backend
sont installées (par exemple via `poetry shell` ou un virtualenv activé). Placez-vous
à la racine du dépôt.

### 2. Vérifier les variables d'environnement

Le script positionne automatiquement des valeurs de test pour Stripe si rien n'est
défini. Si votre `.env` contient déjà d'autres clés Stripe, vérifiez qu'elles
correspondent à un environnement de test. Aucune base de données externe n'est
requise : une base SQLite en mémoire est créée à la volée.

### 3. Lancer la simulation par défaut

```bash
python backend/scripts/simulate_stripe_subscription.py --slug demo
```

Cette commande :

1. crée un tenant "demo" dans la base en mémoire ;
2. appelle `POST /billing/create-checkout-session` et affiche l'URL de checkout simulée ;
3. déclenche le webhook `checkout.session.completed` ;
4. affiche l'état de facturation (`/billing/state`) avec les entitlements provisionnés.

### 4. Ajuster les plafonds simulés

Vous pouvez modifier les quotas provisionnés avant le webhook :

```bash
python backend/scripts/simulate_stripe_subscription.py --slug client-x --chauffeurs-max 50 --users-max 20
```

Le script réécrit temporairement les entitlements du plan `EARLY_PARTNER` pour
refléter ces valeurs. L'état final affiché doit indiquer `chauffeurs_max = 50` et
`users_max = 20`.

### 5. Explorer d'autres scénarios

- Pour tester l'échec de paiement ou la résiliation, vous pouvez modifier le script
  et définir `stripe_stub.next_event` sur d'autres événements (`invoice.payment_failed`,
  `customer.subscription.deleted`) avant l'appel au webhook.
- Les entités créées résident uniquement dans la base mémoire : relancer le script
  redémarre une session vierge.

### 6. Nettoyer

Aucune action n'est nécessaire : la base en mémoire et les overrides FastAPI sont
supprimés lorsque le script se termine.

En suivant ces étapes, vous pouvez vérifier rapidement le comportement du backend
lors d'une souscription Stripe simulée et ajuster vos paramètres avant une mise en
production.
