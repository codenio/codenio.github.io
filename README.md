# codenio.github.io

Personal portfolio for **Aananth K** ([codenio](https://github.com/codenio)). Single-page site built with HTML, CSS, and JS. Data is loaded from the GitHub API and external services when the page loads. Hosted on **GitHub Pages** at [https://codenio.github.io/](https://codenio.github.io/).

## What’s on the site

- **Hero** — Avatar, name, bio, location/company from GitHub. Buttons: **View contributions**, **View projects**, **GitHub**.
- **Summary** — Infographic cards: merged PR count, repos contributed to, projects with traction (numbers filled from API).
- **About** — Short professional intro and link to [LinkedIn](https://www.linkedin.com/in/codenio/).
- **Merged pull requests** — Only **merged** PRs (closed/unmerged are ignored). Grouped by repo, **collapsible by default**; click a repo row to expand. Data from GitHub Search API (`author:codenio is:pr is:merged`).
- **Contribution activity** — Year-wise commit graph via [ghchart](https://ghchart.rshah.org/) and [github-calendar](https://github.com/Bloggify/github-calendar).
- **Popular OSS contributions** — **Own repos only** (no forks), with at least 1 star or 1 fork, sorted by stars then forks. Placed at the bottom; OSS contributions to other repos are covered in Merged PRs.
- **Holopin Badges** — Embedded [Holopin](https://holopin.io) badge board (`user=codenio`).
- **Contact** — GitHub, LinkedIn, Email, Twitter.

## Deploy to GitHub Pages

1. Clone or push this repo to **codenio/codenio.github.io**.
2. In the repo: **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** (or **master**) → Folder: **/ (root)** → Save.
3. Site is live at **https://codenio.github.io/**.

No build step. Only static files: `index.html`, `styles.css`, `script.js`, plus the calendar script/styles loaded from unpkg.

## Customize

- **GitHub user**: In `script.js`, set `const GITHUB_USER = 'codenio';` (or your username).
- **About**: Edit the `#about` section in `index.html`.
- **Contact**: Edit the links in the `#contact` section in `index.html`.
- **Holopin**: If your Holopin username is not `codenio`, change the `user=codenio` in the Holopin image URL and the profile link in the **Holopin Badges** section in `index.html`.

## How data is loaded

- **Profile**: `GET /users/codenio` (avatar, name, bio, company, location).
- **Merged PRs**: `GET /search/issues?q=author:codenio+is:pr+is:merged` (grouped by repo in the UI).
- **Own projects**: `GET /users/codenio/repos` → filter to non-fork repos with stars or forks, sort by popularity.
- **Contribution graph**: External services (ghchart image + github-calendar). GitHub does not expose contribution activity via API.

All requests run in the browser when the page loads. No backend and no API token. Unauthenticated GitHub API limit: 60 requests/hour per IP.
