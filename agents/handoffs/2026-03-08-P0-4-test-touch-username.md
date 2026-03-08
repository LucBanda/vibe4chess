## Handoff
- Scope: Validation locale des correctifs interactions tactiles mobile + règle pseudo joueur obligatoire pour créer/rejoindre.
- Changements: Aucun changement de code (test-only) sur ce handoff.
- Risques: Aucun blocant détecté en CI locale. Risque résiduel: vérification manuelle sur appareil mobile pour fluidité pinch/pan/double-tap.
- Verification locale:
  - `npm run test:unit` ✅
  - `npm run test:web-build` ✅
  - `npm run test:expo-health` ⚠️ 16/17 (warning connu: duplication `expo-font`)
- Actions suivantes:
  - Vérifier manuellement sur iOS/Android: sélection en mode zoomé, pinch fluide, pan, double-tap reset.
