# Specification Du Jeu - V1

## 1. Perimetre
- Jeu d echecs a 4 joueurs (blanc, rouge, noir, bleu) sur plateau 14x14 avec cases non jouables.
- Modes: local et remote (Supabase).
- Clients cibles: web, iOS, Android (Expo).

## 2. Regles de jeu
- Ordre des tours: blanc -> rouge -> noir -> bleu.
- Un joueur elimine est saute au tour suivant.
- Fin de partie: il ne reste qu un seul joueur vivant.
- Mouvement des pieces: roi, dame, tour, fou, cavalier, pion (sens du pion par couleur).
- Promotion: pion promu en dame sur la ligne/colonne d arrivee de sa couleur.
- Capture du roi: le joueur capturant absorbe toutes les pieces restantes du joueur elimine.

## 3. Mode local
- Les 4 couleurs peuvent etre configurees en Humain/Robot.
- Les robots jouent automatiquement a leur tour.
- Les interactions humaines ne doivent jamais jouer a la place d un robot.

## 4. Mode remote
- Creation de partie:
  - Le createur devient owner de la partie.
  - Les options robot choisies au menu de creation sont appliquees explicitement aux couleurs selectionnees.
  - Le siege `white` du createur ne peut pas etre remplace par un robot.
- Rejoindre une partie:
  - Un joueur rejoint une couleur libre (jamais un siege deja assigne ou robot).
- Synchronisation:
  - Etat de partie persiste en base et diffuse via realtime + polling fallback.

## 5. Presence et resilence remote
- Si l owner quitte:
  - la partie est supprimee,
  - tous les clients quittent la session,
  - aucune reprise possible de cette partie.
- Si un invite est deconnecte:
  - aucun robot ne doit etre ajoute automatiquement,
  - la partie passe en pause,
  - un statut explicite de pause/reconnexion est affiche.
- Reprise:
  - reprise remote possible uniquement si la partie existe encore.

## 6. Invariants anti-regression
- I1: Aucune conversion implicite Humain -> Robot en remote.
- I2: Les robots remote proviennent uniquement des options explicites de creation.
- I3: Le moteur robot ne joue en remote que pour les sieges `robot`, et seulement depuis le client owner.
- I4: Les regles de pause remote bloquent les coups (humains et robots) tant que la presence n est pas validee.
- I5: Le siege `white` d une creation remote appartient toujours a un utilisateur humain.

## 7. Definition of done V1
- Tests unitaires verts.
- Build web vert.
- Comportements des sections 4 et 5 verifies manuellement.
