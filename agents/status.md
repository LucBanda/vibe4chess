# Multi-agent status board

Derniere mise a jour: 2026-03-08
Owner mise a jour: meta-po

## Sprint courant

- Sprint: `S3`
- Objectif: debuggage Expo Go iOS + stabilite web/dev runtime
- WIP max: 3 stories

## Board

| Story | Priorite | Statut | Owner | Branche | PR | Notes |
|---|---|---|---|---|---|---|
| P0-1 Reconnexion fiable | P0 | todo | meta-po | - | - | Prete pour refinement |
| P0-2 Validation transitions etat | P0 | todo | meta-po | - | - | Depend de conventions etat |
| P0-4 Debug Expo Go iOS | P0 | in_progress | meta-po/dev/test/review/sec/int/doc | dev/story-active | - | Session multi-agent active |
| P0-3 Reprise locale fiable | P0 | done | dev/test/review/int/doc | main | - | Auto-save + auto-resume + bouton reprise |
| P1-3 Ergonomie plateau | P1 | done | dev/test/review/int/doc | main | - | Cases legales + dernier coup + layout compact |
| P2-3 Bot tactique | P2 | done | dev/test/review/int/doc | main | - | Penalite d exposition + contre-capture |
| P1-1 Historique enrichi | P1 | todo | meta-po | - | - | UI + data model |

Statuts autorises: `todo`, `in_progress`, `blocked`, `review`, `done`.

## Decisions sprint

- Les stories P0 passent avant toute story P1/P2.
- Toute story `done` doit avoir:
  - handoff `dev`
  - handoff `test`
  - verdict `review`
  - handoff `network-security`
  - handoff `integration`
  - handoff `documentation`

## Blocages

- P0-4: verifier version Expo Go iOS installée et mode de connexion (`lan`/`tunnel`) cote appareil.
