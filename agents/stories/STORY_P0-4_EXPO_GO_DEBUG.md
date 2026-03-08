# Story debug Expo Go

## Header

- Story ID: P0-4
- Priorite: P0
- Statut: in_progress
- Owner: meta-po

## Objectif utilisateur

- En tant que joueur mobile iOS
- Je veux lancer et utiliser l application via Expo Go sans erreur de compatibilite
- Afin de pouvoir tester et jouer sans blocage environnement

## Criteres d acceptation

1. `expo-doctor` passe (0 erreur) sur le projet.
2. Le projet demarre via `expo start --clear` et expose un QR exploitable.
3. Un protocole de debug Expo Go iOS est documente (version app, mode LAN/Tunnel, cache, logs).
4. Les checks de test detectent les regressions de compatibilite Expo (SDK/dependances).
5. Le workflow agents inclut validation securite reseau et doc avant cloture.

## Contraintes techniques

- Impacts API/schema: aucun attendu.
- Compatibilite: Expo SDK 55 + Expo Go iOS correspondant.
- Performance/Securite: ne pas exposer de secrets, verifier variables `EXPO_PUBLIC_*`.

## Plan d execution multi-agent

1. Dev:
- corriger les erreurs runtime bloquantes (web/mobile) et stabiliser le demarrage.

2. Test:
- executer `npm run test:unit` et `npm run test:expo-health`.
- verifier `npm run test:web-build` quand l environnement le permet.

3. Review:
- revue des risques de regression runtime (initialisation, hooks, startup flow).

4. Network-Security:
- verifier config reseau Supabase, gestion erreurs et exposition de secrets.

5. Integration:
- converger les correctifs et relancer la suite de checks.

6. Documentation:
- mettre a jour README + runbook de debug Expo Go iOS.

## Definition of done

- [ ] code implemente
- [ ] tests ajoutes/verts
- [ ] revue sans blocant
- [ ] validation network-security sans critical ouvert
- [ ] integration validee
- [ ] documentation mise a jour
- [ ] `agents/status.md` mis a jour
