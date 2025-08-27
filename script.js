// Single-page terminal-style portfolio (About+terminal integrated)
// - Contact section removed
// - Logo fixed and sketch image included in About
// NOTE: YouTube API key is NOT hardcoded here. See getYouTubeApiKey() for how the key is
// read from a secret injection (meta tag, window.__SAFE_SECRETS, or serverless proxy).
const CONFIG = {
  GITHUB_USER: 'safe11811',
  // Do NOT put your API key here. Leave null and inject it as a secret at build/runtime.
  YOUTUBE_API_KEY: null,
  YOUTUBE_CHANNEL_ID: 'UCdGAezwvTu0T2w83E2RopxA' // your UC... channel id
};

/*
  How the YouTube API key is resolved at runtime (in order):
  1) window.__SAFE_SECRETS.YOUTUBE_API_KEY - injected by your build/deploy system (recommended)
  2) <meta name="yt-api-key" content="..."> in index.html (e.g., injected at deploy)
  3) If neither exists, the script will attempt to call a server-side proxy at /api/youtube
     (you must implement the proxy as a serverless function and store the key server-side).
  If none of these are available the site falls back to a friendly link to the channel.
*/

function getYouTubeApiKey() {
  try {
    // 1) Window-injected secrets (e.g., your host injects a small object at runtime)
    if (typeof window !== 'undefined' && window.__SAFE_SECRETS && window.__SAFE_SECRETS.YOUTUBE_API_KEY) {
      return String(window.__SAFE_SECRETS.YOUTUBE_API_KEY).trim() || null;
    }

    // 2) Meta tag injection (can be written at deploy time)
    const meta = document.querySelector('meta[name="yt-api-key"]');
    if (meta && meta.content) return String(meta.content).trim() || null;

    // 3) CONFIG fallback (should be null in committed code)
    if (CONFIG.YOUTUBE_API_KEY) return String(CONFIG.YOUTUBE_API_KEY).trim() || null;
  } catch (e) {
    // ignore
  }
  return null;
}

// Helper: call server-side proxy to fetch videos if client-side key is not provided.
// Your serverless function should accept query params: channelId, maxResults and return
// the same simplified structure as fetchLatestYouTubeVideos returns.
async function fetchYouTubeViaProxy(channelId, maxResults = 3) {
  const proxyUrls = [
    `/api/youtube?channelId=${encodeURIComponent(channelId)}&maxResults=${encodeURIComponent(maxResults)}`,
    `/.netlify/functions/youtube?channelId=${encodeURIComponent(channelId)}&maxResults=${encodeURIComponent(maxResults)}`
  ];

  for (const url of proxyUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      // If your proxy returns the items array, normalize it to the shape below
      if (Array.isArray(json.items)) {
        return json.items.map(it => {
          const snip = it.snippet || {};
          return {
            id: snip.resourceId ? snip.resourceId.videoId : (it.id && it.id.videoId) || it.id,
            title: snip.title || it.title || '',
            description: snip.description || it.description || '',
            thumb: (snip.thumbnails && (snip.thumbnails.medium || snip.thumbnails.default)) ? (snip.thumbnails.medium.url || snip.thumbnails.default.url) : '',
            publishedAt: snip.publishedAt || it.publishedAt || ''
          };
        });
      }
      // If proxy returns already-normalized array
      if (Array.isArray(json)) return json;
    } catch (err) {
      // try next proxy
    }
  }
  throw new Error('No proxy available or proxy failed');
}

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const typingEl = document.getElementById('typing');
  const yearEl = document.getElementById('year');
  const ytSection = document.getElementById('ytSection');
  const ghSection = document.getElementById('ghSection');
  const cmdButtons = document.querySelectorAll('.cmd');
  const aboutOutput = document.getElementById('aboutOutput');
  const aboutCmd = document.getElementById('aboutCmd');
  const miniBody = document.getElementById('miniBody');
  const miniCmd = document.getElementById('miniCmd');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Typing intro
  const introLines = [
    "Initializing neon-shell v1.3...",
    "Loading modules: ui, media, core, coffee...",
    "Welcome, I'm Safe. Explore using the About terminal to the right — try `help`."
  ];
  startTyping(introLines, typingEl);

  // Nav buttons scroll smoothly
  cmdButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      btn.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }], { duration: 180, fill: 'forwards' });
    });
  });

  // About terminal welcome
  if (aboutOutput) printAbout("about-shell ready. Type 'help'.");

  // Hook about input
  if (aboutCmd) {
    aboutCmd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = aboutCmd.value.trim();
        if (raw) {
          printAbout(`~$ ${raw}`);
          handleAboutCommand(raw);
        }
        aboutCmd.value = '';
      }
    });
  }

  // Buttons that run commands
  document.querySelectorAll('[data-run]').forEach(b => {
    b.addEventListener('click', () => {
      const cmd = b.getAttribute('data-run');
      if (cmd && aboutOutput) {
        printAbout(`~$ ${cmd}`);
        handleAboutCommand(cmd);
      }
    });
  });

  // Mini terminal
  if (miniCmd) {
    printMini("neon-mini ready. Type 'help'.");
    miniCmd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = miniCmd.value.trim();
        if (raw) {
          printMini(`~$ ${raw}`);
          handleMiniCommand(raw);
        }
        miniCmd.value = '';
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        miniCmd.focus();
        e.preventDefault();
      }
    });
  }

  // PROJECTS: GitHub fetching (with extra insight)
  fetchGitHubRepos(CONFIG.GITHUB_USER, 6).then(async repos => {
    // show latest 3 with extra data
    const top = repos.slice(0, 3);
    const detailed = await Promise.all(top.map(async r => {
      const [langs, commit] = await Promise.allSettled([
        fetchRepoLanguages(r.owner.login, r.name),
        fetchLatestCommit(r.owner.login, r.name)
      ]);
      return {
        repo: r,
        languages: langs.status === 'fulfilled' ? langs.value : null,
        latestCommit: commit.status === 'fulfilled' ? commit.value : null
      };
    }));
    renderReposDetailed(detailed, ghSection);
  }).catch(err => {
    if (ghSection) ghSection.innerHTML = `<div class="muted small">Failed to load GitHub repos: ${err.message}</div>`;
  });

  // PROJECTS: YouTube optional (resolve key from secret or proxy)
  (async function loadYouTube() {
    if (!ytSection) return;
    const channelId = CONFIG.YOUTUBE_CHANNEL_ID;
    const apiKey = getYouTubeApiKey();

    if (apiKey) {
      try {
        const videos = await fetchLatestYouTubeVideos(apiKey, channelId, 3);
        renderYTVideos(videos, ytSection);
        return;
      } catch (err) {
        // if client-side key failed, fall through to try proxy
        console.warn('YouTube client fetch failed:', err);
      }
    }

    // Try server-side proxy if no client key or client fetch failed
    try {
      const videos = await fetchYouTubeViaProxy(channelId, 3);
      renderYTVideos(videos, ytSection);
      return;
    } catch (err) {
      // final fallback UI
      ytSection.innerHTML = `<div class="media-card"><div style="padding:10px"><p class="muted small">YouTube videos will appear here when a YouTube API key is provided (via secret injection) or when a server-side proxy is available.</p><a class="social-link" href="https://www.youtube.com/@safe11881" target="_blank" rel="noopener">Open channel</a></div></div>`;
    }
  })();

  // -------------------- About terminal command handler --------------------
  function handleAboutCommand(raw) {
    const args = raw.split(/\s+/).filter(Boolean);
    const cmd = args[0].toLowerCase();

    if (!aboutOutput) return;

    switch (cmd) {
      case 'help':
        printAbout("commands: help, whoami, bio, skills, learning, projects, social, clear, echo, theme");
        break;
      case 'whoami':
        printAbout("Safe — 16 years old, from India. I like programming and editing. Studying in 11th grade.");
        break;
      case 'bio':
        printAbout("Hi — I'm Safe (in this online world). I make videos, code, and edit. I explore Godot and Python while learning new things.");
        break;
      case 'skills':
        printAbout("Skills: programming basics, editing, game dev (Godot), Python basics.");
        break;
      case 'learning':
        printAbout("Currently learning: Godot (game dev), Python (scripting & automation).");
        break;
      case 'projects':
        document.querySelector('#projects').scrollIntoView({ behavior: 'smooth' });
        printAbout("Jumping to projects section...");
        break;
      case 'social':
        document.querySelector('#social').scrollIntoView({ behavior: 'smooth' });
        printAbout("Opening social section...");
        break;
      case 'clear':
        aboutOutput.innerHTML = '';
        break;
      case 'echo':
        printAbout(args.slice(1).join(' '));
        break;
      case 'theme':
        document.documentElement.classList.toggle('alt-theme');
        printAbout("Toggled theme.");
        break;
      default:
        printAbout(`Command not found: ${cmd}`);
        break;
    }
  }

  function printAbout(text) {
    if (!aboutOutput) return;
    const d = document.createElement('div');
    d.textContent = text;
    aboutOutput.appendChild(d);
    aboutOutput.scrollTop = aboutOutput.scrollHeight;
  }

  // -------------------- Mini terminal handler ------------------------------
  function printMini(text) {
    if (!miniBody) return;
    const line = document.createElement('div');
    line.textContent = text;
    miniBody.appendChild(line);
    miniBody.scrollTop = miniBody.scrollHeight;
  }

  function handleMiniCommand(raw) {
    const parts = raw.split(/\s+/).filter(Boolean);
    const cmd = parts[0].toLowerCase();
    switch (cmd) {
      case 'help':
        printMini("mini-commands: help, ls, about, projects, social, home, clear, echo, theme");
        break;
      case 'ls':
        printMini("about  projects  social  home");
        break;
      case 'about':
        printMini("navigating to about...");
        document.querySelector('#about').scrollIntoView({ behavior: 'smooth' });
        break;
      case 'projects':
        printMini("navigating to projects...");
        document.querySelector('#projects').scrollIntoView({ behavior: 'smooth' });
        break;
      case 'social':
        printMini("navigating to social...");
        document.querySelector('#social').scrollIntoView({ behavior: 'smooth' });
        break;
      case 'home':
        printMini("navigating home...");
        document.querySelector('#home').scrollIntoView({ behavior: 'smooth' });
        break;
      case 'clear':
        if (miniBody) miniBody.innerHTML = '';
        break;
      case 'echo':
        printMini(parts.slice(1).join(' ') || '');
        break;
      case 'theme':
        document.documentElement.classList.toggle('alt-theme');
        printMini("toggled theme");
        break;
      default:
        printMini(`command not found: ${cmd}`);
        break;
    }
  }

  // -------------------- GitHub helpers ------------------------------------
  async function fetchGitHubRepos(user, per_page = 6) {
    const url = `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=${per_page}`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' }});
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    const data = await res.json();
    data.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
    return data;
  }

  async function fetchRepoLanguages(owner, repo) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`languages ${res.status}`);
    const data = await res.json();
    return data; // object {Language: bytes, ...}
  }

  async function fetchLatestCommit(owner, repo) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`commits ${res.status}`);
    const data = await res.json();
    if (!data || !data.length) return null;
    const c = data[0];
    return {
      message: c.commit && c.commit.message ? c.commit.message.split('\n')[0] : '',
      date: c.commit && c.commit.author ? c.commit.author.date : null,
      url: c.html_url
    };
  }

  function renderReposDetailed(list, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!list || list.length === 0) {
      container.innerHTML = '<div class="muted small">No public repos found.</div>';
      return;
    }
    list.forEach(item => {
      const r = item.repo;
      const langs = item.languages || {};
      const langKeys = Object.keys(langs);
      const langDisplay = langKeys.length ? langKeys.slice(0,3).join(', ') : '—';
      const last = item.latestCommit;
      const el = document.createElement('article');
      el.className = 'project';
      el.innerHTML = `
        <h3><a href="${r.html_url}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></h3>
        <p class="muted">${r.description ? escapeHtml(r.description) : 'No description'}</p>
        <div class="repo-meta">
          <span class="tag">${langDisplay}</span>
          <span class="tag">★ ${r.stargazers_count}</span>
          <span class="tag">Forks: ${r.forks_count}</span>
          <span class="tag">Open issues: ${r.open_issues_count}</span>
        </div>
        <div style="margin-top:10px" class="muted small">
          ${ last ? `Last commit: "${escapeHtml(last.message)}" — ${new Date(last.date).toLocaleString()}` : 'No recent commit info' }
        </div>
      `;
      container.appendChild(el);
    });
  }

  // -------------------- YouTube helpers (optional) ------------------------
  async function fetchLatestYouTubeVideos(apiKey, channelId, maxResults = 3) {
    const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`;
    const chRes = await fetch(chUrl);
    if (!chRes.ok) throw new Error(`YouTube channels API error: ${chRes.status}`);
    const chJson = await chRes.json();
    const items = chJson.items || [];
    if (!items.length) throw new Error('Channel not found or invalid API key/channel ID.');
    const uploadsPlaylistId = items[0].contentDetails.relatedPlaylists.uploads;
    if (!uploadsPlaylistId) throw new Error('Uploads playlist not found.');

    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=${maxResults}&key=${encodeURIComponent(apiKey)}`;
    const plRes = await fetch(plUrl);
    if (!plRes.ok) throw new Error(`YouTube playlistItems API error: ${plRes.status}`);
    const plJson = await plRes.json();
    return plJson.items.map(it => {
      const snip = it.snippet;
      return {
        id: snip.resourceId.videoId,
        title: snip.title,
        description: snip.description,
        thumb: (snip.thumbnails && (snip.thumbnails.medium || snip.thumbnails.default)) ? (snip.thumbnails.medium.url || snip.thumbnails.default.url) : '',
        publishedAt: snip.publishedAt
      };
    });
  }

  function renderYTVideos(videos, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!videos || !videos.length) {
      container.innerHTML = '<div class="muted small">No videos found.</div>';
      return;
    }
    videos.forEach(v => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
          <img class="media-thumb" src="${v.thumb}" alt="${escapeHtml(v.title)}" />
        </a>
        <div style="padding-top:8px">
          <strong style="color:var(--neon-cyan)">${escapeHtml(v.title)}</strong>
          <div class="muted small">${new Date(v.publishedAt).toLocaleDateString()}</div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // -------------------- Utilities ----------------------------------------
  function startTyping(lines, el) {
    if (!el) return;
    el.textContent = '';
    let li = 0, ci = 0;
    function step() {
      if (li >= lines.length) return;
      const line = lines[li];
      if (ci <= line.length) {
        el.textContent = lines.slice(0, li).join('\n') + (li ? '\n' : '') + line.slice(0, ci);
        ci++;
        setTimeout(step, 24 + Math.random() * 30);
      } else {
        li++; ci = 0;
        setTimeout(step, 400);
      }
    }
    step();
  }

  function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

});