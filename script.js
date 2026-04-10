(function () {
  var DEFAULT_GITHUB_USER = 'codenio';

  /** GitHub username: alphanumeric or single hyphens inside, 1–39 chars. */
  function isValidGithubLogin(s) {
    if (!s || typeof s !== 'string') return false;
    if (s.length < 1 || s.length > 39) return false;
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(s);
  }

  /**
   * Ensure ?github= is present; default to codenio. Uses replaceState (no extra round trip).
   */
  function ensureGithubQueryParam() {
    var params = new URLSearchParams(window.location.search);
    var raw = params.get('github');
    var trimmed = raw == null ? '' : String(raw).trim().replace(/^@+/, '');
    var user = trimmed && isValidGithubLogin(trimmed) ? trimmed : DEFAULT_GITHUB_USER;
    if (raw == null || !trimmed || !isValidGithubLogin(trimmed)) {
      var url = new URL(window.location.href);
      url.searchParams.set('github', user);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    return user;
  }

  var GITHUB_USER = ensureGithubQueryParam();

  function apiUser() {
    return 'https://api.github.com/users/' + encodeURIComponent(GITHUB_USER);
  }
  function apiRepos() {
    return 'https://api.github.com/users/' + encodeURIComponent(GITHUB_USER) + '/repos?per_page=100&sort=updated&type=all';
  }
  function apiSearchPR() {
    return (
      'https://api.github.com/search/issues?q=' +
      encodeURIComponent('author:' + GITHUB_USER + ' is:pr is:merged') +
      '&per_page=100&sort=created&order=desc'
    );
  }
  function apiOrgs() {
    return 'https://api.github.com/users/' + encodeURIComponent(GITHUB_USER) + '/orgs?per_page=100';
  }

  function el(id) {
    return document.getElementById(id);
  }

  /** Best-effort reset time from GitHub headers (may be hidden by CORS). */
  function parseGithubResetMs(res) {
    var reset = res.headers.get('X-RateLimit-Reset');
    if (reset) {
      var sec = parseInt(reset, 10);
      if (isFinite(sec)) return sec * 1000;
    }
    var ra = res.headers.get('Retry-After');
    if (ra) {
      var retrySec = parseInt(ra, 10);
      if (isFinite(retrySec)) return Date.now() + retrySec * 1000;
    }
    return null;
  }

  /**
   * JSON request to api.github.com; throws Error with .rateLimited, .resetAt, .githubStatus on failure.
   */
  async function fetchGitHubJson(url) {
    var res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    var resetAt = parseGithubResetMs(res);
    var remaining = res.headers.get('X-RateLimit-Remaining');

    var text = await res.text();
    var data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      data = { message: text || res.statusText };
    }

    if (res.ok) return data;

    var msg =
      (typeof data.message === 'string' && data.message) ||
      res.statusText ||
      'Request failed';
    var isRateLimited =
      res.status === 429 ||
      (res.status === 403 && /rate limit/i.test(msg)) ||
      remaining === '0';

    var err = new Error(msg);
    err.githubStatus = res.status;
    err.rateLimited = isRateLimited;
    err.resetAt = isRateLimited ? resetAt : null;
    err.documentationUrl =
      typeof data.documentation_url === 'string' ? data.documentation_url : '';

    throw err;
  }

  function showRateLimitNotice(err) {
    if (!err || !err.rateLimited) return;
    var box = el('github-rate-notice');
    if (!box) return;
    var reset = err.resetAt ? new Date(err.resetAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
    var doc =
      err.documentationUrl &&
      '<a href="' +
        escapeHtml(err.documentationUrl) +
        '" target="_blank" rel="noopener">Rate limiting (docs)</a>';
    var when = reset
      ? ' Estimated reset: <strong>' + escapeHtml(reset) + '</strong> (your local time).'
      : '';
    box.innerHTML =
      '<p><strong>GitHub API rate limit</strong> — ' +
      escapeHtml(err.message) +
      when +
      ' Unauthenticated clients get a low hourly quota; try again after the reset or use a token for higher limits.' +
      (doc ? ' ' + doc : '') +
      '</p>';
    box.hidden = false;
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function setDocumentMeta(profile) {
    var login = profile && profile.login ? profile.login : GITHUB_USER;
    var name = (profile && profile.name) || login;
    document.title = name + ' · GitHub profile';
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Live view of ' + login + ' on GitHub: repos, merged PRs, organizations, and public stats.'
      );
    }
  }

  function setNavAndLinks(profile) {
    var login = profile && profile.login ? profile.login : GITHUB_USER;
    var htmlUrl = (profile && profile.html_url) || 'https://github.com/' + encodeURIComponent(login);

    var navLogo = el('nav-logo');
    if (navLogo) navLogo.textContent = login;

    var heroGithub = el('hero-github-link');
    if (heroGithub) heroGithub.href = htmlUrl;

    var achievementsLink = el('achievements-link');
    if (achievementsLink) achievementsLink.href = htmlUrl + '?tab=achievements';

    var profileLink = el('profile-link');
    if (profileLink) profileLink.href = htmlUrl;

    var prSearch = el('pr-search-link');
    if (prSearch) {
      prSearch.href =
        'https://github.com/search?q=' +
        encodeURIComponent('is:pr is:merged author:' + login) +
        '&type=pullrequests';
    }
  }

  function setHero(profile) {
    var login = profile.login || GITHUB_USER;
    var name = profile.name || login;
    var bio = profile.bio || '';
    var parts = [];
    if (profile.company) parts.push(profile.company);
    if (profile.location) parts.push(profile.location);

    if (el('hero-name')) el('hero-name').textContent = name;
    if (el('hero-login')) el('hero-login').textContent = '@' + login;
    if (el('hero-bio')) el('hero-bio').textContent = bio || 'No bio on GitHub.';
    if (el('hero-meta')) el('hero-meta').textContent = parts.join(' · ');
    if (el('avatar') && profile.avatar_url) {
      el('avatar').src = profile.avatar_url;
      el('avatar').alt = name;
    }
  }

  function setSummaryFromProfile(profile) {
    if (!profile) return;
    var f = el('summary-followers');
    if (f) f.textContent = profile.followers != null ? String(profile.followers) : '—';
    var g = el('summary-following');
    if (g) g.textContent = profile.following != null ? String(profile.following) : '—';
  }

  function setOrgSummary(count) {
    var n = el('summary-org-count');
    if (n) n.textContent = count != null ? String(count) : '—';
  }

  function setRepoCount(count) {
    var node = el('repo-count');
    if (node) node.textContent = count;
  }

  function renderProjectCard(repo) {
    var desc = repo.description || 'No description';
    var lang = repo.language || 'Other';
    var stars = repo.stargazers_count || 0;
    var forks = repo.forks_count || 0;
    var url = repo.html_url;
    var name = repo.name;

    return (
      '<article class="project-card">' +
      '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
      '<h3 class="project-name">' + escapeHtml(name) + '</h3>' +
      '<p class="project-desc">' + escapeHtml(desc) + '</p>' +
      '<div class="project-meta">' +
      '<span class="project-lang">' + escapeHtml(lang) + '</span>' +
      '<span class="project-stats">★ ' + stars + ' · ⎇ ' + forks + '</span>' +
      '</div>' +
      '</a>' +
      '</article>'
    );
  }

  function getRepoFromRepositoryUrl(url) {
    if (!url) return '';
    var match = url.match(/repos\/([^/]+\/[^/]+)/);
    return match ? match[1] : '';
  }

  /** GET /repos/{owner}/{repo} URL for full name "owner/repo". */
  function apiRepoFullName(fullName) {
    var parts = String(fullName).split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return (
      'https://api.github.com/repos/' +
      encodeURIComponent(parts[0]) +
      '/' +
      encodeURIComponent(parts[1])
    );
  }

  function formatCompactCount(n) {
    var x = Number(n);
    if (!isFinite(x) || x < 0) return '0';
    if (x < 1000) return String(Math.round(x));
    if (x < 10000) {
      var t = Math.round((x / 1000) * 10) / 10;
      return (t % 1 === 0 ? String(Math.round(t)) : String(t)) + 'k';
    }
    if (x < 1000000) return Math.round(x / 1000) + 'k';
    return Math.round(x / 1000000) + 'M';
  }

  /** Sum thumbs-up and hearts on merged PRs (from search payload). */
  function sumPrReactionLikes(prs) {
    return prs.reduce(function (acc, pr) {
      var r = pr.reactions;
      if (!r) return acc;
      return acc + (Number(r['+1']) || 0) + (Number(r.heart) || 0);
    }, 0);
  }

  /**
   * Parallel repo metadata; on rate limit some entries stay null; first rate-limit error returned for the banner.
   */
  async function fetchRepoStatsMap(fullNames) {
    var map = {};
    var rateLimitError = null;
    var jobs = fullNames.map(function (fullName) {
      var url = apiRepoFullName(fullName);
      if (!url) {
        map[fullName] = null;
        return Promise.resolve();
      }
      return fetchGitHubJson(url)
        .then(function (j) {
          map[fullName] = {
            stars: j.stargazers_count != null ? j.stargazers_count : null,
            forks: j.forks_count != null ? j.forks_count : null,
            watch: j.subscribers_count != null ? j.subscribers_count : null,
          };
        })
        .catch(function (e) {
          map[fullName] = null;
          if (e.rateLimited && !rateLimitError) rateLimitError = e;
        });
    });
    await Promise.all(jobs);
    return { map: map, rateLimitError: rateLimitError };
  }

  function renderPRCard(pr) {
    var title = pr.title || '#' + pr.number;
    var date = formatDate(pr.created_at);
    var url = pr.html_url;
    var num = pr.number;
    return (
      '<article class="pr-card">' +
      '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
      '<h3 class="pr-title">' + escapeHtml(title) + '</h3>' +
      '<div class="pr-meta">' +
      '<span class="pr-state pr-state--merged">Merged</span>' +
      '<span class="pr-date">' + escapeHtml(date) + '</span>' +
      (num ? '<span class="pr-num">#' + num + '</span>' : '') +
      '</div>' +
      '</a>' +
      '</article>'
    );
  }

  function groupPRsByRepo(items) {
    var byRepo = {};
    items.forEach(function (pr) {
      var repo = getRepoFromRepositoryUrl(pr.repository_url);
      if (!repo) return;
      if (!byRepo[repo]) byRepo[repo] = [];
      byRepo[repo].push(pr);
    });
    return byRepo;
  }

  function renderPRGroup(repo, prs, repoStats) {
    var repoUrl = 'https://github.com/' + repo;
    var cards = prs
      .sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .map(renderPRCard)
      .join('');

    var likesOnPrs = sumPrReactionLikes(prs);
    var stars =
      repoStats && repoStats.stars != null ? formatCompactCount(repoStats.stars) : '—';
    var forks =
      repoStats && repoStats.forks != null ? formatCompactCount(repoStats.forks) : '—';
    var watch =
      repoStats && repoStats.watch != null ? formatCompactCount(repoStats.watch) : '—';
    var likes = formatCompactCount(likesOnPrs);

    var statsHtml =
      '<span class="pr-repo-stats" aria-label="Repository and PR stats">' +
      '<span class="pr-repo-stat" title="Stargazers">★ ' +
      stars +
      '</span>' +
      '<span class="pr-repo-stat" title="Watching (subscribers)">Watch ' +
      watch +
      '</span>' +
      '<span class="pr-repo-stat" title="Forks">⎇ ' +
      forks +
      '</span>' +
      '<span class="pr-repo-stat" title="Thumbs up and hearts on your merged PRs in this repo">♥ ' +
      likes +
      '</span>' +
      '<span class="pr-repo-count">' +
      prs.length +
      ' merged</span>' +
      '</span>';

    return (
      '<details class="pr-repo-group">' +
      '<summary class="pr-repo-heading">' +
      '<a href="' +
      escapeHtml(repoUrl) +
      '" target="_blank" rel="noopener" class="pr-repo-link" onclick="event.stopPropagation()">' +
      escapeHtml(repo) +
      '</a>' +
      statsHtml +
      '</summary>' +
      '<div class="pr-grid">' +
      cards +
      '</div>' +
      '</details>'
    );
  }

  function setPRCount(count) {
    var node = el('pr-count');
    if (node) node.textContent = count;
  }

  function setPRRepoCount(count) {
    var node = el('pr-repo-count');
    if (node) node.textContent = count;
  }

  var summaryData = { prCount: null, prRepoCount: null, projectCount: null };
  function updateSummary() {
    if (summaryData.prCount != null) {
      var n = el('summary-pr-count');
      if (n) n.textContent = summaryData.prCount;
    }
    if (summaryData.prRepoCount != null) {
      var n = el('summary-pr-repos');
      if (n) n.textContent = summaryData.prRepoCount;
    }
    if (summaryData.projectCount != null) {
      var n = el('summary-project-count');
      if (n) n.textContent = summaryData.projectCount;
    }
  }

  async function loadPRs() {
    var grid = el('pr-grid');
    if (!grid) return;

    try {
      var data = await fetchGitHubJson(apiSearchPR());
      var items = data.items || [];

      if (!items.length) {
        grid.innerHTML = '<p class="projects-note">No merged pull requests found in this search window.</p>';
        setPRCount(0);
        setPRRepoCount(0);
        summaryData.prCount = 0;
        summaryData.prRepoCount = 0;
        updateSummary();
        return;
      }

      var byRepo = groupPRsByRepo(items);
      var repoKeys = Object.keys(byRepo);

      var statsResult = await fetchRepoStatsMap(repoKeys);
      var statsMap = statsResult.map;
      if (statsResult.rateLimitError) showRateLimitNotice(statsResult.rateLimitError);

      /** Most popular repos first (stars desc); unknown stars last; ties → merged count, then name. */
      repoKeys.sort(function (a, b) {
        var sa = statsMap[a] && statsMap[a].stars != null ? statsMap[a].stars : null;
        var sb = statsMap[b] && statsMap[b].stars != null ? statsMap[b].stars : null;
        if (sa === null && sb === null) {
          var c0 = byRepo[b].length - byRepo[a].length;
          return c0 !== 0 ? c0 : a.localeCompare(b);
        }
        if (sa === null) return 1;
        if (sb === null) return -1;
        if (sb !== sa) return sb - sa;
        var c1 = byRepo[b].length - byRepo[a].length;
        return c1 !== 0 ? c1 : a.localeCompare(b);
      });

      var html = repoKeys
        .map(function (repo) {
          return renderPRGroup(repo, byRepo[repo], statsMap[repo]);
        })
        .join('');

      grid.innerHTML = html;
      setPRCount(items.length);
      setPRRepoCount(repoKeys.length);
      summaryData.prCount = items.length;
      summaryData.prRepoCount = repoKeys.length;
      updateSummary();
    } catch (e) {
      if (e.rateLimited) showRateLimitNotice(e);
      var extra = e.rateLimited && e.resetAt
        ? ' Resets around ' + new Date(e.resetAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) + '.'
        : '';
      grid.innerHTML =
        '<p class="projects-note">' +
        escapeHtml(e.rateLimited ? 'GitHub API rate limit — try again later.' : 'Could not load PRs.') +
        (e.rateLimited ? extra : '') +
        '</p>';
    }
  }

  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        links.classList.toggle('open');
      });
      document.querySelectorAll('.nav-links a').forEach(function (a) {
        a.addEventListener('click', function () {
          links.classList.remove('open');
        });
      });
    }
  }

  function setYear() {
    var y = el('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function renderProfileDetails(profile) {
    var box = el('profile-content');
    if (!box || !profile) return;

    var login = profile.login || GITHUB_USER;
    var lines = [];

    if (profile.created_at) {
      lines.push('<p><strong>Member since</strong> ' + escapeHtml(formatDate(profile.created_at)) + '</p>');
    }
    if (profile.html_url) {
      lines.push(
        '<p><a href="' +
          escapeHtml(profile.html_url) +
          '" target="_blank" rel="noopener">github.com/' +
          escapeHtml(login) +
          '</a></p>'
      );
    }
    if (profile.blog) {
      var blog = String(profile.blog).trim();
      var href = /^https?:\/\//i.test(blog) ? blog : 'https://' + blog;
      lines.push(
        '<p><strong>Website</strong> · <a href="' +
          escapeHtml(href) +
          '" target="_blank" rel="noopener">' +
          escapeHtml(blog) +
          '</a></p>'
      );
    }
    if (profile.twitter_username) {
      var tw = 'https://twitter.com/' + encodeURIComponent(profile.twitter_username);
      lines.push(
        '<p><strong>X / Twitter</strong> · <a href="' +
          escapeHtml(tw) +
          '" target="_blank" rel="noopener">@' +
          escapeHtml(profile.twitter_username) +
          '</a></p>'
      );
    }
    if (profile.email) {
      lines.push(
        '<p><strong>Email</strong> · <a href="mailto:' +
          escapeHtml(profile.email) +
          '">' +
          escapeHtml(profile.email) +
          '</a></p>'
      );
    }
    lines.push(
      '<p><strong>Public repos</strong> · ' +
        (profile.public_repos != null ? profile.public_repos : '—') +
        '</p>'
    );
    lines.push(
      '<p><strong>Public gists</strong> · ' +
        (profile.public_gists != null ? profile.public_gists : '—') +
        '</p>'
    );
    if (profile.hireable != null) {
      lines.push('<p><strong>Open to opportunities</strong> · ' + (profile.hireable ? 'Yes' : 'No') + '</p>');
    }

    box.innerHTML = lines.length ? lines.join('') : '<p class="projects-note">No extra public fields.</p>';
  }

  function renderContact(profile) {
    var box = el('contact-links');
    if (!box) return;

    if (!profile) {
      box.innerHTML = '<p class="projects-note">Profile unavailable.</p>';
      return;
    }

    var login = profile.login || GITHUB_USER;
    var parts = [];

    parts.push(
      '<a href="' +
        escapeHtml(profile.html_url || 'https://github.com/' + encodeURIComponent(login)) +
        '" target="_blank" rel="noopener" class="contact-link">GitHub</a>'
    );

    if (profile.blog) {
      var blog = String(profile.blog).trim();
      var href = /^https?:\/\//i.test(blog) ? blog : 'https://' + blog;
      parts.push(
        '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener" class="contact-link">Website</a>'
      );
    }

    if (profile.twitter_username) {
      var tw = 'https://twitter.com/' + encodeURIComponent(profile.twitter_username);
      parts.push(
        '<a href="' + escapeHtml(tw) + '" target="_blank" rel="noopener" class="contact-link">X / Twitter</a>'
      );
    }

    if (profile.email) {
      parts.push(
        '<a href="mailto:' + escapeHtml(profile.email) + '" class="contact-link">Email</a>'
      );
    }

    box.innerHTML = parts.length
      ? parts.join('')
      : '<p class="projects-note">No blog, email, or social on the public profile.</p>';
  }

  function renderOrgCard(org) {
    var url = org.html_url || 'https://github.com/' + encodeURIComponent(org.login);
    var avatar = org.avatar_url || '';
    var desc = org.description ? '<p class="org-desc">' + escapeHtml(org.description) + '</p>' : '';
    return (
      '<article class="org-card">' +
      '<a href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noopener" class="org-card-link">' +
      (avatar
        ? '<img src="' + escapeHtml(avatar) + '" alt="" class="org-avatar" width="48" height="48" />'
        : '') +
      '<div class="org-card-body">' +
      '<h3 class="org-name">' +
      escapeHtml(org.login) +
      '</h3>' +
      desc +
      '</div>' +
      '</a>' +
      '</article>'
    );
  }

  async function loadOrgs() {
    var grid = el('orgs-grid');
    if (!grid) return;

    try {
      var orgs = await fetchGitHubJson(apiOrgs());
      var list = Array.isArray(orgs) ? orgs : [];
      setOrgSummary(list.length);

      if (!list.length) {
        grid.innerHTML = '<p class="projects-note">No public organization memberships.</p>';
        return;
      }

      list.sort(function (a, b) {
        return (a.login || '').localeCompare(b.login || '');
      });
      grid.innerHTML = list.map(renderOrgCard).join('');
    } catch (e) {
      if (e.rateLimited) showRateLimitNotice(e);
      setOrgSummary('—');
      grid.innerHTML =
        '<p class="projects-note">' +
        escapeHtml(e.rateLimited ? 'Organizations skipped — GitHub API rate limit.' : 'Could not load organizations.') +
        '</p>';
    }
  }

  async function loadUser() {
    try {
      var profile = await fetchGitHubJson(apiUser());
      setDocumentMeta(profile);
      setNavAndLinks(profile);
      setHero(profile);
      setSummaryFromProfile(profile);
      renderProfileDetails(profile);
      renderContact(profile);
      var foot = el('footer-line');
      if (foot) {
        var y = el('year');
        var yearHtml = y ? y.outerHTML : new Date().getFullYear();
        foot.innerHTML = '© ' + yearHtml + ' · ' + escapeHtml(profile.name || profile.login || GITHUB_USER);
      }
      return profile;
    } catch (e) {
      if (e.rateLimited) showRateLimitNotice(e);
      if (el('hero-bio')) {
        el('hero-bio').textContent = e.rateLimited
          ? 'GitHub API rate limit — profile could not be loaded. Try again later.'
          : 'Could not load this GitHub user.';
      }
      if (el('hero-login')) el('hero-login').textContent = '@' + GITHUB_USER;
      if (el('profile-content')) {
        el('profile-content').innerHTML =
          '<p class="projects-note">User not found or API error. Check the <code>github</code> query parameter.</p>';
      }
      if (el('contact-links')) {
        el('contact-links').innerHTML =
          '<a href="https://github.com/' +
          encodeURIComponent(GITHUB_USER) +
          '" target="_blank" rel="noopener" class="contact-link">Try on GitHub</a>';
      }
      var foot = el('footer-line');
      if (foot) {
        var y = el('year');
        var yearHtml = y ? y.outerHTML : String(new Date().getFullYear());
        foot.innerHTML = '© ' + yearHtml + ' · @' + escapeHtml(GITHUB_USER);
      }
      setNavAndLinks(null);
      return null;
    }
  }

  function isOwnRepo(repo) {
    return !repo.fork;
  }

  function isOwnPublicProject(repo) {
    if (!isOwnRepo(repo)) return false;
    if (!repo.owner || repo.owner.login.toLowerCase() !== GITHUB_USER.toLowerCase()) return false;
    return repo.private === false;
  }

  function sortByPopularity(repos) {
    return repos.slice().sort(function (a, b) {
      var sa = a.stargazers_count || 0;
      var fa = a.forks_count || 0;
      var sb = b.stargazers_count || 0;
      var fb = b.forks_count || 0;
      if (sb !== sa) return sb - sa;
      return fb - fa;
    });
  }

  async function loadRepos() {
    var grid = el('projects-grid');
    if (!grid) return;

    try {
      var allRepos = await fetchGitHubJson(apiRepos());
      var repos = allRepos.filter(isOwnPublicProject);
      repos = sortByPopularity(repos);

      setRepoCount(repos.length);
      summaryData.projectCount = repos.length;
      updateSummary();
      grid.innerHTML = repos.length
        ? repos.map(renderProjectCard).join('')
        : '<p class="projects-note">No public repositories (or only forks).</p>';
    } catch (e) {
      if (e.rateLimited) showRateLimitNotice(e);
      grid.innerHTML =
        '<p class="projects-note">' +
        escapeHtml(e.rateLimited ? 'Repositories skipped — GitHub API rate limit.' : 'Could not load repositories.') +
        '</p>';
    }
  }

  function init() {
    setYear();
    initNav();
    /** Load profile first so one request runs before search/repos/orgs (helps stay under burst limits). */
    loadUser().then(function () {
      loadOrgs();
      loadRepos();
      loadPRs();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
