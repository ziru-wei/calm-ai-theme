# Ambient Interfaces Dashboard

Local Gallery + Kanban Board with editable centered Notion/Arc-style project peeks. Requires Node.js; no npm install or external backend.

Start in Terminal from the unzipped folder: `node server.js`, then open `http://127.0.0.1:4173`. You can also double-click `start.command`; if macOS Gatekeeper blocks it, using `node server.js` avoids changing security settings.

## Gallery / Board

- The **Card size** slider at bottom right changes both Gallery card width and total card height. Small cards truncate or hide descriptions rather than overflow. Gallery cards do not display individual label pills.
- Labels are section headings in Gallery and columns in Board. Directly beneath each heading, click **Add label note…** to edit contextual notes in place. Labels can be renamed, recolored, reordered, created or deleted under **Labels**. In Board, drag cards to another label column.
- Click a card to open its centered full-height peek (click ×, outside, or Esc to close), where you can edit title, year, label, description, author/venue, and project/paper/video/image URLs. Embedded video appears above the Note.

## Note images

Click inside the Note to type, paste JPEG/PNG/GIF from the clipboard, or drop a local image. There is no separate image upload button. An inline image can be removed from the note with Backspace directly after it, or Delete directly before it. Removing an image from the note removes the reference in its saved note JSON. The original image file is retained in `images/notes/` for recovery rather than deleted irreversibly. If a note begins with an image, that image is used as the Gallery cover.

Existing legacy theory figures, if any, are still shown below the Note as an archive. New images should be pasted into the Note.

## Agent Add

Use **Agent Add → Copy agent prompt**, paste the prompt into any research/coding agent, then paste its JSON response into the same dialog. The app previews the batch and detects possible duplicate titles/years before import. One response may contain 1–100 cards. New label names in an imported batch are created automatically; project attributes and optional text notes are written to the project folder. There is no API key, direct agent connection, or automatic web scraping.

The required format is JSON with a `cards` array. Each card can contain `title`, `year`, `label`, `desc`, `by`, `url`, `paper`, `videoLink`, `img`, `tags`, `note` (optional fields can be empty).

## Saved data and upgrading

- `catalog.json` stores editable cards, labels, and label notes (created on first change); previous catalogs without a label `note` field still work.
- `notes/<card-id>.json` stores editable project notes.
- `images/notes/<card-id>/` stores pasted images and GIFs.
- `images/theory/<card-id>/` retains legacy uploaded figures.
- `settings.json` stores selected view and card size.

**Upgrading an existing installation:** Replace only `index.html`, `app.js`, `app.css`, and `server.js` with files from this archive. Keep your existing `catalog.json`, `notes/`, `images/`, and `settings.json`. `catalog.defaults.json` provides the original research entries only for a fresh project; it does not overwrite your existing catalog. Do not open `index.html` via `file://` because the local server handles disk writes.

## v7 interactions

- Card detail is a full-height centered peek with visible Gallery/Board on both sides; closing restores the same collection view. Video remains between properties and rich-text Note.
- The slider resizes both width and height in **Gallery and Board**; long text is clamped within each card.
- Selecting text in a project Note or label note opens a floating **Bold / Highlight** toolbar. These marks are stored as structured text runs in `notes/*.json` and `catalog.json`, not in browser storage.
- **Labels** opens a compact management popover: edit names, choose colors, reorder, add, or delete labels. Section `···` buttons open the same menu.
- To upgrade, replace `index.html`, `app.js`, `app.css`, and `server.js`. Preserve `catalog.json`, `notes/`, `images/`, and `settings.json`.

## v8 fixes

- Descriptions remain visible even at the minimum card size; Gallery and Board height both scale with card width.
- Kanban columns grow to fit all their cards, without inner vertical scrollbars. Only the full board may scroll horizontally.
- Label editing is a two-level anchored menu: label list, then name/color/order/delete controls. Renaming keeps the label ID and note; deleting moves assigned cards to Unlabeled.

## v9 — Card properties + Axis view

- **Gallery / Board / Axis → Properties ▾**: each view has its own independent property visibility settings for Cover image, Project name, Year, Description, Credit / venue, Keywords, Label, Project / paper links, Video link, and Note link. The defaults retain descriptions in Gallery and Board. Preferences are stored in `settings.json` alongside the card size and active view. This implements property visibility controls, not a code-identical copy of PaperToaster.
- **Axis**: Cards appear in a scrollable left tray; on the right, **+ Dimension** creates independent horizontal axes. Edit a dimension name, either endpoint, and insert multiple intermediate labels via **+ Label**. The small tick above each intermediate label can be dragged horizontally; × removes it.
- Drag a card from the left onto any axis to position it. The placed card sits above the axis with a line connecting it to the corresponding position. Drag a placed card left or right to adjust it, click to open its original peek, or hover and click × to remove it from that dimension. The same card can be placed on multiple dimensions. When cards are near each other, they automatically form stacked lanes without overlap.
- Axis labels and card positions are stored in the new `axes.json` file. No existing catalog fields are changed. Deleting a card also removes its axis placements. `axes.json` is created on the first edit.

**Upgrade from v8**: replace `index.html`, `app.js`, `app.css`, `server.js` only. Keep your existing `catalog.json`, `settings.json`, `notes/`, `images/`, and `axes.json` if you already have them. Do not replace `catalog.defaults.json` for an existing installation. Use `node server.js` from the project folder.
