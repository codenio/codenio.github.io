(function () {
  const GITHUB_USER = 'codenio';
  const API_USER = `https://api.github.com/users/${GITHUB_USER}`;
  const API_REPOS = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated&type=all`;
  const API_SEARCH_PR = `https://api.github.com/search/issues?q=author%3A${GITHUB_USER}+is%3Apr+is%3Amerged&per_page=100&sort=created&order=desc`;

  function el(id) {
    return document.getElementById(id);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderProjectCard(repo) {
    const desc = repo.description || 'No description';
    const lang = repo.language || 'Other';
    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const url = repo.html_url;
    const name = repo.name;

    return `
      <article class="project-card">
        <a href="${url}" target="_blank" rel="noopener">
          <h3 class="project-name">${escapeHtml(name)}</h3>
          <p class="project-desc">${escapeHtml(desc)}</p>
          <div class="project-meta">
            <span class="project-lang">${escapeHtml(lang)}</span>
            <span class="project-stats">★ ${stars} · ⎇ ${forks}</span>
          </div>
        </a>
      </article>
    `;
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function setHero(profile) {
    const name = profile.name || profile.login;
    const bio = profile.bio || 'Developer · Open source';
    const location = profile.location ? ` · ${profile.location}` : '';
    const company = profile.company ? ` · ${profile.company}` : '';

    if (el('hero-name')) el('hero-name').textContent = name;
    if (el('hero-bio')) el('hero-bio').textContent = bio;
    if (el('hero-meta')) el('hero-meta').textContent = [company, location].filter(Boolean).join('');
    if (el('avatar') && profile.avatar_url) el('avatar').src = profile.avatar_url;
  }

  function setRepoCount(count) {
    const node = el('repo-count');
    if (node) node.textContent = count;
  }

  function getRepoFromRepositoryUrl(url) {
    if (!url) return '';
    var match = url.match(/repos\/([^/]+\/[^/]+)/);
    return match ? match[1] : '';
  }

  function renderPRCard(pr) {
    var title = pr.title || '#' + pr.number;
    var date = formatDate(pr.created_at);
    var url = pr.html_url;
    var num = pr.number;
    return (
      '<article class="pr-card">' +
        '<a href="' + url + '" target="_blank" rel="noopener">' +
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

  function renderPRGroup(repo, prs) {
    var repoUrl = 'https://github.com/' + repo;
    var cards = prs.sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    }).map(renderPRCard).join('');
    return (
      '<details class="pr-repo-group">' +
        '<summary class="pr-repo-heading">' +
          '<a href="' + repoUrl + '" target="_blank" rel="noopener" class="pr-repo-link" onclick="event.stopPropagation()">' + escapeHtml(repo) + '</a>' +
          '<span class="pr-repo-count">' + prs.length + ' merged</span>' +
        '</summary>' +
        '<div class="pr-grid">' + cards + '</div>' +
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
    if (summaryData.prCount != null) { var n = el('summary-pr-count'); if (n) n.textContent = summaryData.prCount; }
    if (summaryData.prRepoCount != null) { var n = el('summary-pr-repos'); if (n) n.textContent = summaryData.prRepoCount; }
    if (summaryData.projectCount != null) { var n = el('summary-project-count'); if (n) n.textContent = summaryData.projectCount; }
  }

  async function loadPRs() {
    var grid = el('pr-grid');
    if (!grid) return;

    try {
      var res = await fetch(API_SEARCH_PR);
      if (!res.ok) throw new Error('PR search failed');
      var data = await res.json();
      var items = data.items || [];

      if (!items.length) {
        grid.innerHTML = '<p class="projects-note">No merged pull requests found.</p>';
        setPRCount(0);
        setPRRepoCount(0);
        summaryData.prCount = 0;
        summaryData.prRepoCount = 0;
        updateSummary();
        return;
      }

      var byRepo = groupPRsByRepo(items);
      var repoKeys = Object.keys(byRepo).sort(function (a, b) {
        return byRepo[b].length - byRepo[a].length;
      });

      var html = repoKeys.map(function (repo) {
        return renderPRGroup(repo, byRepo[repo]);
      }).join('');

      grid.innerHTML = html;
      setPRCount(items.length);
      setPRRepoCount(repoKeys.length);
      summaryData.prCount = items.length;
      summaryData.prRepoCount = repoKeys.length;
      updateSummary();
    } catch (e) {
      grid.innerHTML = '<p class="projects-note">Could not load PRs (API or rate limit).</p>';
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

  async function loadUser() {
    try {
      const res = await fetch(API_USER);
      if (!res.ok) throw new Error('User fetch failed');
      const profile = await res.json();
      setHero(profile);
      return profile;
    } catch (e) {
      if (el('hero-bio')) el('hero-bio').textContent = 'Developer · Open source';
      if (el('hero-meta')) el('hero-meta').textContent = 'Bangalore, India · Myntra';
      return null;
    }
  }

  function isOwnRepo(repo) {
    return !repo.fork;
  }

  function sortByPopularity(repos) {
    return repos.slice().sort(function (a, b) {
      var sa = a.stargazers_count || 0, fa = a.forks_count || 0;
      var sb = b.stargazers_count || 0, fb = b.forks_count || 0;
      if (sb !== sa) return sb - sa;
      return fb - fa;
    });
  }

  async function loadRepos() {
    var grid = el('projects-grid');
    if (!grid) return;

    try {
      const res = await fetch(API_REPOS);
      if (!res.ok) throw new Error('Repos fetch failed');
      const allRepos = await res.json();
      var repos = allRepos.filter(isOwnRepo);
      repos = sortByPopularity(repos);

      setRepoCount(repos.length);
      summaryData.projectCount = repos.length;
      updateSummary();
      grid.innerHTML = repos.length
        ? repos.map(renderProjectCard).join('')
        : '<p class="projects-note">No own repositories yet.</p>';
    } catch (e) {
      grid.innerHTML = '<p class="projects-note">Could not load projects. Check GitHub username and CORS, or use a static list.</p>';
    }
  }

  function init() {
    setYear();
    initNav();
    loadUser().then(function () {});
    loadRepos();
    loadPRs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
