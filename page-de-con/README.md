# Page de con

Userscript qui remplit les formulaires de candidature (SuccessFactors, Workday, Taleo…) à partir d'un profil.
Il ne clique **jamais** sur « Postuler » : il remplit, puis liste les champs obligatoires encore vides (encadrés en rouge).

## Installation (une fois)
1. Installer l'extension **Tampermonkey** (Chrome / Firefox / Edge).
2. Tampermonkey → *Créer un nouveau script* → coller le contenu de `page-de-con.user.js` → Enregistrer.
3. Remplir le bloc `PROFIL` en haut du script (entreprise actuelle, titre, diplôme, mobilité…).

Sans extension : ouvrir la console (F12) sur la page, coller le script, Entrée.

## Utilisation
- Bouton **Page de con** (en bas à droite) : remplit la page, affiche un journal.
- Bouton **Scan** : affiche dans la console (F12) tous les champs détectés, leur libellé normalisé et s'ils ont une règle.
  Sert à ajouter une règle quand un site utilise un libellé inconnu.

## Ajouter une règle
Dans `PROFIL.champs` : `[/^debut du libelle normalise/, 'valeur']`.
Pour une liste déroulante, une liste de candidats : `[/^devise/, ['EUR', 'Euro']]` — le premier présent dans la liste gagne.
Les sections répétables (expériences, diplômes, langues) sont dans `PROFIL.sections`, une entrée par ligne ;
le script clique sur « Ajouter » s'il manque des lignes.

## Autre site
Ajouter une ligne `// @match *://*.domaine.com/*` dans l'en-tête du script.
