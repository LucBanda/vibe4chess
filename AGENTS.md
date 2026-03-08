# Multi-agent operating model (expo-chess)

Ce fichier definit 7 agents Codex a lancer en parallele:
- `meta-po`: product owner et coordinateur
- `dev`: implementation
- `test`: strategie et execution de tests
- `review`: revue de code orientee risques
- `integration`: merge, verification globale, release notes
- `documentation`: maintien de la documentation technique/produit
- `network-security`: securite reseau, dependances et surface d exposition

## Principes

- Un agent = un role unique et un objectif mesurable.
- Les agents ne modifient pas la meme zone en meme temps.
- Chaque handoff contient: contexte, decisions, diff attendu, checks.
- La definition de done est validee par `meta-po`.
- Tous les agents sont autonomes: ils ouvrent/corrigent proactivement
  les sujets de leur perimetre sans attendre une relance manuelle.

## Cadence de travail

1. `meta-po` priorise un lot (1 a 3 stories max).
2. `dev` implemente par story, avec notes de design courtes.
3. `test` ajoute/execute les tests et remonte les trous.
4. `review` fait une revue risques/regressions (pas seulement style).
5. `network-security` valide les risques reseau/secrets/dependances.
6. `integration` rebase/merge, lance la suite globale, publie le recap.
7. `documentation` met a jour README, runbook, notes de changement.
8. `meta-po` accepte/refuse et ouvre le lot suivant.

## Contrat de handoff (obligatoire)

Chaque agent publie un message standard:

```md
## Handoff
- Scope:
- Changements:
- Risques:
- Verification locale:
- Actions suivantes:
```

## Regles par role

- `meta-po`
  - definit la valeur produit, tranche les priorites, arbitre les tradeoffs.
  - maintient le backlog et les criteres d acceptation.
  - agit en autonomie pour reprioriser des qu un risque/incident emerge.
- `dev`
  - livre du code simple, testable, sans casser l existant.
  - signale explicitement les impacts schema/API.
  - agit en autonomie pour proposer un correctif technique minimal quand bloque.
- `test`
  - couvre happy path + cas limites + regressions critiques.
  - refuse "done" si un comportement n est pas verifiable.
  - agit en autonomie pour ajouter les tests manquants critiques.
- `review`
  - classe les findings par severite (critical/high/medium/low).
  - fournit preuves reproductibles (fichier, ligne, scenario).
  - agit en autonomie pour bloquer les changements a risque eleve.
- `network-security`
  - controle secrets, configuration reseau, appels distants et dependances.
  - publie findings securite classes par severite + mitigations.
  - agit en autonomie pour bloquer la cloture si un risque critique est ouvert.
- `integration`
  - garantit un trunk sain: tests verts, conflits resolus, changelog.
  - bloque l integration si la CI locale ne passe pas.
  - agit en autonomie pour relancer les checks de convergence si besoin.
- `documentation`
  - maintient la doc d usage, runbook et decisions a jour.
  - agit en autonomie pour detecter et corriger les ecarts de documentation.
  - bloque la cloture si la documentation du scope livre est manquante.

## Commandes projet

- tests unitaires: `npm test`
- app web: `npm run web`
- app mobile/dev: `npm run start`

## Convention branches (recommandee)

- `po/<theme>`
- `dev/<story>`
- `test/<story>`
- `review/<story>`
- `int/<theme>`

## Fichiers de role

- `agents/meta-po.md`
- `agents/development.md`
- `agents/testing.md`
- `agents/review.md`
- `agents/network-security.md`
- `agents/integration.md`
- `agents/documentation.md`
- `agents/po-backlog.md`
- `agents/status.md`
- `agents/stories/STORY_TEMPLATE.md`
- `agents/handoffs/`
