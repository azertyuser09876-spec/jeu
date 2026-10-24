# Le Vide

Une lumière seule dans un vide infini.
Récolte la lumière qui flotte dans le noir, deviens plus forte, va plus loin.

Un jeu incrémental *interactif* : tu ne regardes pas des chiffres monter, tu te déplaces, tu attires, tu pulses.
À terme, ton territoire de lumière s'étendra, des êtres de lumière vivront et bâtiront sans toi,
et des colosses immenses rôderont dans les profondeurs (voir [ROADMAP.md](ROADMAP.md)).

## Jouer

Ouvre `index.html` dans un navigateur. Aucune installation, aucune dépendance.

| Action | Souris / tactile | Clavier |
| --- | --- | --- |
| Se déplacer | maintenir le clic ou le doigt | ZQSD, WASD ou flèches |
| Pulsation | bouton rond | Espace |
| Acheter | clic sur une carte | 1 à 9 (Tab : onglet suivant) |
| Menu / pause | ≡ en haut à droite | Échap |

La partie est sauvegardée automatiquement dans le navigateur.

## Publier sur GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
Le jeu sera disponible à `https://<utilisateur>.github.io/<dépôt>/`.

## Développement

```
node tests/run.js        # tests de la logique (aussi : ouvrir tests/tests.html)
node tests/smoke.js      # test de fumée dans Chromium (nécessite Playwright)
node tests/balance.js 30 # robot d'équilibrage : simule 30 minutes de jeu
```

```
index.html, style.css
src/core/   logique pure, sans navigateur — testée
src/app/    affichage (canvas), contrôles, interface, stockage
tests/      tests, test de fumée, robot d'équilibrage
```

La méthode de travail et les règles d'architecture sont dans [CLAUDE.md](CLAUDE.md),
l'historique des versions dans [CHANGELOG.md](CHANGELOG.md).
