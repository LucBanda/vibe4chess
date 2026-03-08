# Runbook multi-agent

## Demarrage d un cycle

1. `meta-po` choisit jusqu a 3 stories dans `agents/po-backlog.md`.
2. `meta-po` cree/maj les fiches dans `agents/stories/` a partir du template.
3. `meta-po` met `agents/status.md` a jour (owner, statut, branche).

## Execution

1. `dev` implemente et publie un handoff dans `agents/handoffs/`.
2. `test` complete couverture + execution `npm test`, puis handoff.
3. `review` publie findings + verdict.
4. `network-security` publie findings securite + mitigations.
5. `integration` valide convergence et publie handoff final.
6. `documentation` met a jour README/guides/notes et publie handoff doc.

## Cloture

1. `meta-po` valide acceptance criteria.
2. `meta-po` verifie les handoffs `network-security` et `documentation`.
3. `meta-po` passe la story a `done` dans `agents/status.md`.
4. `meta-po` documente les decisions cle dans `agents/status.md`.
