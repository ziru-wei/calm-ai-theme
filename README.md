# Calm AI theme page

```
index.html            the theme page (Interactive + Narrative views), top right: Related works, Edit
state.json            saved text edits / arrows / projects of the theme page
server.py             local server for the theme page (saves edits to state.json)
start.command         double-click to run server.py
related-works/        Ambient Interfaces dashboard (gallery / board / axis of related work)
  index.html app.js app.css   the dashboard
  catalog.defaults.json       starter cards; catalog.json (your edits) overrides it once it exists
  axes.json settings.json     axis placements and view settings
  server.js start.command     local editor for the dashboard (Node.js)
Claude outputs/       working notes and figures, NOT deployed
.github/workflows/    GitHub Pages deploy
```

## Run locally

- Theme page: double-click `start.command` (or `python3 server.py`), http://127.0.0.1:5500/. Click **Edit** (top right) to edit text and arrows; changes go to `state.json`.
- Related works, read-only: http://127.0.0.1:5500/related-works/ (opens from the **Related works** link).
- Related works, editable: in `related-works/` run `node server.js` (or double-click its `start.command`), http://127.0.0.1:4173. Edits go to `catalog.json`, `notes/`, `images/`, `axes.json`, `settings.json`. Commit them to publish.

## Publish (GitHub Pages)

Push to `main`. The workflow in `.github/workflows/pages.yml` copies only `index.html`, `state.json` and the dashboard files into the site (so `Claude outputs/` is not served). One-time setting: repo **Settings, Pages, Source: GitHub Actions**. Public site: https://ziru-wei.github.io/calm-ai-theme/ . The public page hides Edit; the dashboard is read-only there.
