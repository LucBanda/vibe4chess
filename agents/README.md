# Agents Codex - guide rapide

## Lancer en parallele (VS Code)

Option rapide:
- `npm run agents:start` (prepare les worktrees par role et affiche les commandes de lancement)

1. Ouvre 7 fenetres VS Code (ou 7 sessions chat).
2. Dans chaque session, colle le prompt de role correspondant:
   - `agents/meta-po.md`
   - `agents/development.md`
   - `agents/testing.md`
   - `agents/review.md`
   - `agents/network-security.md`
   - `agents/integration.md`
   - `agents/documentation.md`
3. Le `meta-po` assigne les stories a traiter et centralise les decisions.
4. Chaque agent envoie un handoff standard avant passage au suivant.

## Suivi quotidien (obligatoire)

1. Le `meta-po` met a jour `agents/status.md` au debut et a la fin de chaque cycle.
2. Chaque agent ecrit son compte-rendu dans `agents/handoffs/`.
3. Les stories actives sont detaillees dans `agents/stories/`.
4. `integration` ne valide un lot que si `status.md` et handoffs sont coherents.

## Option recommandee avec git worktree

```bash
git worktree add ../expo-chess-dev dev/story-001
git worktree add ../expo-chess-test test/story-001
git worktree add ../expo-chess-review review/story-001
git worktree add ../expo-chess-security sec/story-001
git worktree add ../expo-chess-int int/story-001
```

Puis lance une session Codex dans chaque repertoire pour eviter les conflits.

## Definition of done globale

- Critere d acceptation PO valide
- `npm test` passe
- revue sans findings bloquants
- integration validee
- documentation usage/technique mise a jour

## Fichiers de pilotage

- tableau global: `agents/status.md`
- backlog produit: `agents/po-backlog.md`
- runbook operatoire: `agents/RUNBOOK.md`
- template story: `agents/stories/STORY_TEMPLATE.md`
- templates handoff: `agents/handoffs/`
