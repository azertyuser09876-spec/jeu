# Le Vide

Une lumière seule dans un vide infini, qui grandit.

Un jeu incrémental *interactif*, en français, en HTML / CSS / JavaScript pur, sans aucune dépendance :
tu ne regardes pas des chiffres monter, tu te déplaces, tu attires la lumière, tu pulses. Puis ton territoire
s'étend, même sans toi ; des êtres de lumière vivent, bâtissent et se défendent seuls ; et, aux confins,
des colosses immenses attendent d'être mérités.

## Jouer

Ouvre `index.html` dans un navigateur. C'est tout.

| Action | Souris / tactile | Clavier |
| --- | --- | --- |
| Se déplacer | maintenir le clic ou le doigt | ZQSD, WASD ou flèches |
| Pulsation | bouton rond | Espace |
| Acheter | clic sur une carte | 1 à 9 (Tab : onglet suivant) |
| Ordres de l’armée | barre sous le compteur | G garder · E escorter · C chasser |
| Carte | ◎ en haut à droite | M |
| Zoom | molette, pincement à deux doigts | + / − |
| Menu / pause, options, journal | ≡ en haut à droite | Échap |

La partie est sauvegardée automatiquement dans le navigateur ; le monde continue pendant ton absence.
Depuis le menu, tu peux l'**exporter** en un code (pour la garder ou changer d'appareil) et l'**importer**.

## Ce qui t'attend

- **La récolte** : la lumière flotte dans le vide ; attire-la, pulse pour tout attraper d'un coup.
- **Les villages** : fonde-les où tu veux, du type que tu choisis (jardins, bastion, atelier, observatoire,
  sanctuaire). Chacun a son territoire vivant, qui pousse vers ses bâtiments et grandit lentement, toujours,
  même sans toi ; son cœur blanchit avec le temps.
- **Les êtres** : dans chaque village, des lueurs récoltent le jardin, des bâtisseurs choisissent où construire
  nids, prismes, phares, tours et bien d'autres ; ils se croisent, dansent, ravitaillent les chantiers.
  Confie une part de lumière à l'**intendant** d'un village : il le fait grandir seul.
- **Les ombres** : des marées attirées par ta lumière. Ta pulsation les blesse ; une armée automatique
  (gardiens, étincelles, veilleuses) obéit à tes ordres. Les ombres vaincues laissent des échos ◆.
- **Les zones** : Calme, Brume, Courants, Murmure, Éclat, Gouffre — plus loin, plus riche, plus dangereux.
- **Les colosses** : le Veilleur, la Tisseuse, le Léviathan. Suis leur battement, esquive leurs attaques
  annoncées, brise leurs sceaux, fais-les plier avec ton armée… et ils deviennent tes gardiens.
- **La renaissance** : te dissoudre pour renaître avec des souvenirs ✧ et des bienfaits éternels.
- **Le son et le récit** : tout est synthétisé en direct ; des fragments d'histoire se révèlent au fil du jeu.

## Publier sur GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
Le jeu sera disponible à `https://<utilisateur>.github.io/<dépôt>/`.

## Développement

```
node tests/run.js                         # tests de la logique (aussi : ouvrir tests/tests.html)
node tests/smoke.js                       # test de fumée dans Chromium (nécessite Playwright)
node tests/balance.js 60                  # robot d'équilibrage : une heure de jeu simulée
node tests/balance.js 120 --renaissance   # … avec renaissances, vie après vie
```

```
index.html, style.css
src/core/   logique pure, sans navigateur — entièrement testée
src/app/    affichage (canvas), contrôles, interface, son, stockage
tests/      tests, test de fumée, robot d'équilibrage
```

La méthode de travail et les règles d'architecture sont dans [CLAUDE.md](CLAUDE.md),
l'historique dans [CHANGELOG.md](CHANGELOG.md), la feuille de route dans [ROADMAP.md](ROADMAP.md).
