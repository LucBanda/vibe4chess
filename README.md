# Expo Chess (iOS / Android / Web + Supabase)

## Genèse du projet (vibe codé)

Ce projet a été construit en mode "vibe codé": itérations courtes guidées par le besoin produit, implémentation directe dans le code, tests fréquents (`npm test`) et ajustements continus à partir des retours d'usage. L'objectif est de privilégier la vitesse d'expérimentation, puis de stabiliser par des règles explicites, des garde-fous et des commits incrémentaux.

## Démarrage

```bash
npm install
npm run start
```

Puis lancez:

- `a` pour Android
- `i` pour iOS (sur macOS + Xcode)
- `w` pour Web

### Expo Go iOS (recommande)

Si Expo Go bloque ou si les ports par defaut sont deja pris:

```bash
npm run start:tunnel
```

Puis dans Expo Go iOS:
1. mettre Expo Go a jour via App Store
2. scanner le QR du terminal
3. si echec, ouvrir Expo Go > Profile > Settings > Clear cache, puis rescanner

## Vérifications automatiques

- `npm run test:unit`: tests unitaires Node
- `npm run test:web-build`: build web Expo (détecte régressions de bundling web)
- `npm run test:expo-health`: contrôle de compatibilité SDK/dépendances Expo
- `npm test`: enchaîne les 3 checks ci-dessus

## Variables d'environnement

1. Copiez `.env.example` vers `.env`
2. Renseignez les valeurs Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Configuration Supabase

1. Créez un projet Supabase
2. Activez `Anonymous sign-ins` dans Authentication > Providers > Anonymous
3. Ouvrez SQL Editor
4. Exécutez (ou réexécutez) le script [`supabase/schema.sql`](supabase/schema.sql)
5. Relancez l'app Expo

## Sécurité Supabase (important)

- La clé `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` est publique par design et peut être exposée côté client.
- Ne mettez jamais la clé `service_role` dans le frontend.
- Les accès DB sont protégés par RLS dans `supabase/schema.sql`:
  - toutes les parties sont publiques en lecture pour les clients authentifiés
  - insertion autorisée au propriétaire authentifié
  - mise à jour autorisée au propriétaire et aux joueurs assignés
  - inscription à une partie existante via la fonction RPC `join_chess_game`

## Fonctionnalités incluses

- Échiquier jouable (tap pour sélectionner et déplacer)
- Règles 4 joueurs gérées par moteur local (`src/game/*`)
- Aide ergonomique: cases légales mises en évidence après sélection
- Lisibilité: dernier coup mis en évidence (départ/arrivée)
- Mobile: zoom du plateau (`+`/`-`) + glisser du plateau quand le zoom est > 100%
- Layout adaptatif mobile/desktop
- Création et synchronisation d'une partie distante dans Supabase (`chess_games`)
- Mode client: créer une partie (avec options joueurs/robots) ou s'inscrire à une partie existante non pleine
- Sélection `Humain/Robot` par couleur:
  - mode local: contrôle complet des 4 sièges
  - mode remote: options robot appliquées à la création uniquement (pas d'ajout automatique)
- Présence remote robuste:
  - si l'owner quitte, la partie est supprimée et non reprenable
  - si un invité se déconnecte, la partie est mise en pause en attente de reconnexion
