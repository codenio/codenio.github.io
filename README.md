# codenio.github.io

Static **GitHub profile portfolio** for [codenio](https://github.com/codenio). It loads public data from the GitHub REST API in the browser (no build step). Hosted on **GitHub Pages**.

## URLs

| URL | Behavior |
|-----|----------|
| **https://codenio.github.io/** | Redirects to `/portfolio?github=codenio`. |
| **https://codenio.github.io/?github=octocat** | Redirects to `/portfolio?github=octocat` (valid usernames only). |
| **https://codenio.github.io/portfolio?github=_login_** | Main app: live profile for that GitHub login. Missing or invalid `github` is normalized to `codenio` via `history.replaceState`. |

Default profile user is **`codenio`** (see `DEFAULT_GITHUB_USER` in `script.js`).

## What’s on the page

- **Hero** — Name, `@login`, bio, company/location, avatar (from `GET /users/{login}`).
- **Summary** — Merged PR count, repos contributed to, public repo count, followers, following, org count.
- **Organizations** — Public org memberships (`GET /users/{login}/orgs`).
- **Merged pull requests** — Search API: merged PRs by `author:{login}`, grouped by repo, sorted by repo popularity (stars). Per-repo stars, watchers, forks, and PR reaction totals where data exists.
- **Public repositories** — User’s non-fork public repos, sorted by stars then forks.
- **Profile / contact** — Extra public fields (website, X, email if exposed by API), links built from profile data.

Shared assets live at the site root: **`/styles.css`**, **`/script.js`**. The app lives under **`/portfolio/`** on disk (`portfolio/index.html`); the script normalizes the URL to **`/portfolio?github=…`** (no slash before `?`).

## Rate limits and cache

Unauthenticated use of `api.github.com` is limited (see [GitHub REST rate limits](https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api)). The script detects rate-limit responses and shows a short banner.

**Per-user cache** in `localStorage` (key prefix `gh_portfolio_v1_`) stores a slim snapshot after successful loads. If a request is rate limited, the UI falls back to cached data for that `github` user when available.

## Deploy (GitHub Pages)

1. Push this repo to **`codenio/codenio.github.io`** (user site) or your own `&lt;user&gt;.github.io` repo.
2. **Settings → Pages** → deploy from branch **main** (or **master**) → folder **`/` (root)**.
3. Site root: **https://YOUR_USER.github.io/** → redirects to **/portfolio?github=codenio** (or whatever you set as `DEFAULT_GITHUB_USER`).

## Customize

- **Default GitHub user** — `DEFAULT_GITHUB_USER` in `script.js`.
- **Layout / copy** — Edit `portfolio/index.html`.
- **Styles / behavior** — `styles.css`, `script.js`.

## Project layout

```
index.html          # Redirect only → /portfolio?github=…
portfolio/index.html   # Portfolio app markup
styles.css
script.js
README.md
LICENSE
```

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE).
