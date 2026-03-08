# Expo Chess (iOS / Android / Web + Supabase)

## Démarrage

```bash
npm install
npm run start
```

Puis lancez:

- `a` pour Android
- `i` pour iOS (sur macOS + Xcode)
- `w` pour Web

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
- Reprise locale: auto-sauvegarde + restauration automatique + bouton de reprise
- Layout adaptatif mobile/desktop
- Création et synchronisation d'une partie distante dans Supabase (`chess_games`)
- Mode client: créer une partie (avec options joueurs/robots) ou s'inscrire à une partie existante non pleine
- Sélection `Humain/Robot` par couleur avec bot tactique amélioré
