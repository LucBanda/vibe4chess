# PO Backlog initial - expo-chess

Backlog propose par le meta-agent PO. Priorites: P0 (urgent) a P3 (nice to have).

## P0

### Story P0-1: Reconnexion fiable a une partie distante
- Valeur: eviter perte de session et parties "bloquees".
- Critere d acceptation:
  - un joueur peut reprendre une partie en cours apres redemarrage app.
  - message d erreur clair si partie inaccessible.
  - tests couvrant reprise session + erreur join.

### Story P0-2: Validation stricte des transitions d etat de partie
- Valeur: prevenir des etats incoherents en remote/local.
- Critere d acceptation:
  - transitions invalides rejetees avec erreur exploitable.
  - pas de regression sur flux existants (`npm test` vert).

### Story P0-3: Reprise locale automatique et fiable
- Valeur: reprendre une partie locale sans perte de progression.
- Critere d acceptation:
  - sauvegarde locale de l etat de partie (plateau, tour, captures, modes humain/robot).
  - restauration automatique au relancement.
  - bouton explicite "Reprendre partie locale" quand une sauvegarde existe.
  - suppression de la sauvegarde a la sortie volontaire.

## P1

### Story P1-1: Historique des coups enrichi (horodatage + joueur)
- Valeur: meilleure lisibilite et debuggage.
- Critere d acceptation:
  - chaque coup affiche auteur + timestamp.
  - rendu correct web/mobile.

### Story P1-2: Observateur (read-only) d une partie distante
- Valeur: partage de partie sans bloquer les places joueurs.
- Critere d acceptation:
  - mode spectateur sans permission de jouer.
  - synchro en temps reel du plateau.

### Story P1-3: Ergonomie plateau et lisibilite des actions
- Valeur: reduction des erreurs de manipulation et meilleure comprehension du tour.
- Critere d acceptation:
  - affichage des cases cibles legales apres selection d une piece.
  - mise en evidence du dernier coup joue (depart/arrivee).
  - layout adapte petits ecrans et desktop.

## P2

### Story P2-1: Rematch en un clic
- Valeur: retention et fluidite de jeu.
- Critere d acceptation:
  - depuis partie finie, creation instantanee d une nouvelle partie.
  - conservation des pseudos/couleurs par defaut.

### Story P2-2: Indicateurs de presence joueur (online/offline)
- Valeur: clarte multijoueur.
- Critere d acceptation:
  - statut visible par joueur.
  - statut mis a jour sur deconnexion reconnue.

### Story P2-3: Bot plus robuste tactiquement
- Valeur: parties solo plus credibles et moins de coups "suicides".
- Critere d acceptation:
  - le bot penalise les coups exposant immediatement une piece.
  - prise en compte d une contre-capture adverse probable.
  - comportement deterministe a etat identique.

## P3

### Story P3-1: Export PGN/JSON de partie
- Valeur: partage et analyse externe.
- Critere d acceptation:
  - export local en PGN et JSON.
  - format valide et testable.
