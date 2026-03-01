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
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Configuration Supabase

1. Créez un projet Supabase
2. Ouvrez SQL Editor
3. Exécutez le script [`supabase/schema.sql`](supabase/schema.sql)
4. Relancez l'app Expo

## Fonctionnalités incluses

- Échiquier jouable (tap pour sélectionner et déplacer)
- Gestion des règles via `chess.js`
- Historique des coups
- Reset de partie locale
- Création et synchronisation d'une partie distante dans Supabase (`chess_games`)
