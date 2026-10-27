# Calm AI theme page

```
index.html            the theme page (Interactive + Narrative views), top right: Related works, Edit
narrative.md           source of the Narrative view's text and figures (markdown + raw HTML)
state.json            saved text edits / arrows / projects of the Interactive view
server.py             local server for the theme page (saves edits to state.json, narrative.md)
start.command         double-click to run server.py
404.html              GitHub Pages 404 page; implements the /2001 edit-unlock trick (see below)
related-works/        Ambient Interfaces dashboard (gallery / board / axis of related work)
  index.html app.js app.css   the dashboard
  catalog.defaults.json       starter cards; catalog.json (your edits) overrides it once it exists
  axes.json settings.json     axis placements and view settings
  server.js start.command     local editor for the dashboard (Node.js)
Claude outputs/       working notes and figures, NOT deployed
.github/workflows/    GitHub Pages deploy
```

## Run locally

- Theme page: double-click `start.command` (or `python3 server.py`), http://127.0.0.1:5500/. Click **Edit** (top right) to edit text and arrows; changes go to `state.json`. In the Narrative view, the same **Edit**/**Done** button makes the rendered text editable in place and saves it back to `narrative.md`.
- Related works, read-only: http://127.0.0.1:5500/related-works/ (opens from the **Related works** link).
- Related works, editable: in `related-works/` run `node server.js` (or double-click its `start.command`), http://127.0.0.1:4173. Edits go to `catalog.json`, `notes/`, `images/`, `axes.json`, `settings.json`. Commit them to publish.

## The Narrative view and `narrative.md`

The Narrative view is rendered client-side from `narrative.md` with [marked](https://github.com/markedjs/marked) (same approach as the project pages on [ziru-wei.github.io](https://github.com/ziru-wei/ziru-wei.github.io)). The file is plain Markdown; its figures (the two big SVG diagrams) and the three "slot" placeholders that borrow the Ways / Directions / Projects widgets from the Interactive view are embedded as raw HTML blocks, which Markdown passes through unchanged. The right-side table of contents is built automatically from the file's `##` headings.

You can edit it two ways, and they stay in sync because the file is always the source of truth:

- **Edit the file directly** (in Obsidian, a text editor, etc.) — the page re-fetches `narrative.md` on every load, so your changes just show up.
- **Edit on the page** — click **Edit**, change the text in the Narrative view, click **Done**. The edited HTML is converted back to Markdown (with [turndown](https://github.com/mixmark-io/turndown)) and saved to `narrative.md`: via `server.py` when running locally, or, on the public site, via a file handle you grant once through the browser's native file picker (see below).

## Editing on the public site: the `/2001` trick

Appending `/2001` to the site's URL (e.g. `https://ziru-wei.github.io/calm-ai-theme/2001` or `.../calm-ai-theme/related-works/2001`) unlocks editing on the live, public GitHub Pages site, for both the theme page and the dashboard — not just on localhost. It works through `404.html`: GitHub Pages serves that file for any unmatched path, and it redirects `/2001` back to the real page with the unlock flag in the URL hash. The unlock is remembered in that browser tab's `sessionStorage`, so it carries over as you navigate between the theme page and the dashboard, until the tab is closed.

GitHub Pages has no backend, so saves there go straight to your local checkout of this repo via the browser's [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) (Chrome/Edge): the first time you click Done (theme page) or **Connect folder to save** (dashboard), you pick the file or folder once, and every save after that writes directly to disk — no download/re-commit round trip. Review the diff and commit as usual to publish. Browsers without that API fall back to downloading the edited file instead.

## Publish (GitHub Pages)

Push to `main`. The workflow in `.github/workflows/pages.yml` copies `index.html`, `state.json`, `narrative.md`, `404.html` and the dashboard files into the site (so `Claude outputs/` is not served). One-time setting: repo **Settings, Pages, Source: GitHub Actions**. Public site: https://ziru-wei.github.io/calm-ai-theme/ . The public page hides Edit and the dashboard is read-only by default — unlock both with the `/2001` trick above.
