/* Papers Radar — with important-paper tracking */

const KEYWORDS = ['lidar','slam','3d mapping','spatial ai','place recognition','point cloud',
    'localization','sensor fusion','3d perception','multimodal','autonomous driving',
    'robotics','robot learning','field robotics','neural radiance','nerf','gaussian splatting',
    'occupancy','bird\'s eye view','bev','depth estimation'];

const STAR_KEY = 'papers_radar_starred_v1';
let STARRED = new Set();
let ALL_PAPERS = [];

function loadStarred() {
    try {
        const raw = localStorage.getItem(STAR_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        STARRED = new Set(arr);
    } catch {
        STARRED = new Set();
    }
}

function saveStarred() {
    localStorage.setItem(STAR_KEY, JSON.stringify([...STARRED]));
}

function paperId(p) {
    return p.url || p.title || Math.random().toString(36).slice(2);
}

function highlightKeywords(text) {
    if (!text) return [];
    const t = text.toLowerCase();
    return KEYWORDS.filter(k => t.includes(k));
}

function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function paperCard(p) {
    const id = paperId(p);
    const checked = STARRED.has(id) ? 'checked' : '';
    const matched = highlightKeywords((p.title || '') + ' ' + (p.abstract || ''));
    const tags = matched.slice(0, 5).map(k => `<span class="paper-tag matched">${k}</span>`).join('');
    const catTag = p.category ? `<span class="paper-tag">${p.category}</span>` : '';

    const links = [];
    if (p.url)        links.push(`<a class="paper-link" href="${p.url}" target="_blank">Paper →</a>`);
    if (p.pdf_url)    links.push(`<a class="paper-link" href="${p.pdf_url}" target="_blank">PDF →</a>`);
    if (p.github_url) links.push(`<a class="paper-link" href="${p.github_url}" target="_blank">Code →</a>`);

    return `<div class="paper-card" data-cat="${p.category || ''}" data-id="${id}">
        <div class="paper-head-row">
            <label class="star-toggle" title="Mark as important">
                <input type="checkbox" class="important-checkbox" data-id="${id}" ${checked}>
                <span>Important</span>
            </label>
        </div>
        <a class="paper-title" href="${p.url || '#'}" target="_blank">${p.title || 'Untitled'}</a>
        <div class="paper-meta">${p.authors ? p.authors.slice(0, 100) + (p.authors.length > 100 ? '…' : '') : ''} ${p.date ? '· ' + fmtDate(p.date) : ''}</div>
        ${p.abstract ? `<div class="paper-abstract">${p.abstract}</div>` : ''}
        <div class="paper-tags">${catTag}${tags}</div>
        ${links.length ? `<div class="paper-links">${links.join('')}</div>` : ''}
    </div>`;
}

function repoCard(r) {
    return `<div class="repo-card">
        <div class="repo-name"><a class="paper-link" href="${r.url || '#'}" target="_blank" style="border:none;padding:0;font-size:1em">${r.name || '—'}</a></div>
        ${r.description ? `<div class="repo-desc">${r.description}</div>` : ''}
        <div class="repo-meta">⭐ ${r.stars || 0} &nbsp;·&nbsp; ${r.language || ''} ${r.date ? '· ' + fmtDate(r.date) : ''}</div>
    </div>`;
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('#arxiv-list .paper-card').forEach(card => {
                card.style.display = (filter === 'all' || card.dataset.cat === filter) ? '' : 'none';
            });
        });
    });
}

function setupImportantCheckboxes() {
    document.querySelectorAll('.important-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = cb.dataset.id;
            if (cb.checked) STARRED.add(id);
            else STARRED.delete(id);
            saveStarred();
            renderImportantList();
        });
    });
}

function renderImportantList() {
    const el = document.getElementById('important-list');
    if (!el) return;
    const important = ALL_PAPERS.filter(p => STARRED.has(paperId(p)));
    if (!important.length) {
        el.innerHTML = '<div class="empty">No papers starred yet.</div>';
        return;
    }
    el.innerHTML = important.slice(0, 20).map(paperCard).join('');
    setupImportantCheckboxes();
}

function renderSection(id, items, cardFn, emptyMsg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!items.length) {
        el.innerHTML = `<div class="empty">${emptyMsg}</div>`;
        return;
    }
    el.innerHTML = items.map(cardFn).join('');
}

async function loadData() {
    loadStarred();
    try {
        const res = await fetch(`results.json?v=${Date.now()}`);
        if (!res.ok) throw new Error('No data');
        const data = await res.json();

        if (data.last_scan) {
            document.getElementById('timestamp').textContent = `Last scan: ${data.last_scan}`;
        }

        const arxiv = data.arxiv || [];
        const github = data.github || [];
        const pwc = data.pwc || [];

        ALL_PAPERS = [...arxiv, ...pwc];

        const topPicks = arxiv.filter(p => p.relevance === 'high').slice(0, 6);

        renderSection('top-picks-list', topPicks, paperCard, 'No top picks yet.');
        renderSection('arxiv-list', arxiv, paperCard, 'No arXiv papers yet.');
        renderSection('github-list', github, repoCard, 'No GitHub repos yet.');
        renderSection('pwc-list', pwc, paperCard, 'No Papers with Code entries yet.');

        setupFilters();
        setupImportantCheckboxes();
        renderImportantList();

    } catch (e) {
        ['important-list','top-picks-list','arxiv-list','github-list','pwc-list'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div class="empty">No data yet — next scan runs Wednesday 09:00 UTC.</div>';
        });
    }
}

document.addEventListener('DOMContentLoaded', loadData);
