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
  - lecture autorisée si partie publique, propriétaire, ou joueur assigné
  - insertion autorisée au propriétaire authentifié
  - mise à jour autorisée au propriétaire et aux joueurs assignés

## Fonctionnalités incluses

- Échiquier jouable (tap pour sélectionner et déplacer)
- Gestion des règles via `chess.js`
- Historique des coups
- Reset de partie locale
- Création et synchronisation d'une partie distante dans Supabase (`chess_games`)
- Création multijoueur: visibilité `publique/privée` + sélection des joueurs (UUID Supabase par couleur)
