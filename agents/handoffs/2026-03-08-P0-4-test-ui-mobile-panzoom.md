## Handoff
- Scope: Validation fonctionnelle et non-regression apres simplification du menu en partie et ajout pan/zoom mobile dans `App.js`.
- Changements: Aucun changement code par l agent `test`; execution de la suite locale sur l etat committe.
- Risques: Pas de regression detectee par les checks automatises executes. Couverture manuelle mobile tactile toujours recommandee (gestes reel appareil).
- Verification locale:
  - `npm run test:unit` ✅
  - `npm run test:web-build` ✅
- Actions suivantes:
  1. Tester sur iOS/Android reel le drag du plateau a zoom > 100%.
  2. Verifier ergonomie du menu replie en paysage mobile.
