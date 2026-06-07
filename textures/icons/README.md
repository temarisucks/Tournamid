# Character Select Icons

Drop the character icon PNGs in this folder. The character-select screen
(`index.html`) loads them by exact filename — names are **lowercase**:

| Character    | File required                    |
|--------------|----------------------------------|
| The Brawler  | `textures/icons/brawler.png`     |
| The Swordsman| `textures/icons/swordsman.png`   |
| The Mage     | `textures/icons/mage.png`        |
| The Ranger   | `textures/icons/ranger.png`      |
| The Dark Ruler | `textures/icons/darkruler.png` |
| The Telepath | `textures/icons/telepath.png`   |

Notes:
- Recommended size: **square**, ~192×192 px (displayed at 96×96, so 2× keeps it crisp).
  Transparent background (PNG) looks best against the dark menu.
- `image-rendering: pixelated` is applied, so pixel-art icons stay sharp when scaled.
- Until a PNG exists, that card shows a dashed `?` placeholder with the character
  name — nothing breaks, it just falls back gracefully (see `.char-card.no-icon`
  in `css/styles.css`).
- To add more selectable characters later, follow the same pattern: a `<div class="char-card">`
  with `<img class="char-icon" src="textures/icons/<name>.png" ...>` in `index.html`.
