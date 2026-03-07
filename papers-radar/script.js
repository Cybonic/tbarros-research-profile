/* Papers Radar — Data Population Script */

const KEYWORDS = ['lidar','slam','3d mapping','spatial ai','place recognition','point cloud',
    'localization','sensor fusion','3d perception','multimodal','autonomous driving',
    'robotics','robot learning','field robotics','neural radiance','nerf','gaussian splatting',
    'occupancy','bird\'s eye view','bev','depth estimation'];

function highlightKeywords(text) {
    if (!text) return '';
    let t = text.toLowerCase();
    let matched = KEYWORDS.filter(k => t.includes(k));
    return matched;
}

function relBadge(rel) {
    const r = (rel || 'low').toLowerCase();
    return `<span class="rel-badge ${r}">${r}</span>`;
}

function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function paperCard(p) {
    const matched = highlightKeywords((p.title || '') + ' ' + (p.abstract || ''));
    const tags = matched.slice(0, 5).map(k => `<span class="paper-tag matched">${k}</span>`).join('');
    const catTag = p.category ? `<span class="paper-tag">${p.category}</span>` : '';

    const links = [];
    if (p.url)        links.push(`<a class="paper-link" href="${p.url}" target="_blank">Paper →</a>`);
    if (p.pdf_url)    links.push(`<a class="paper-link" href="${p.pdf_url}" target="_blank">PDF →</a>`);
    if (p.github_url) links.push(`<a class="paper-link" href="${p.github_url}" target="_blank">Code →</a>`);

    return `<div class="paper-card" data-cat="${p.category || ''}">
        <a class="paper-title" href="${p.url || '#'}" target="_blank">${p.title || 'Untitled'}</a>
        <div class="paper-meta">${p.authors ? p.authors.slice(0, 80) + (p.authors.length > 80 ? '…' : '') : ''} ${p.date ? '· ' + fmtDate(p.date) : ''}</div>
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

async function loadData() {
    try {
        const res = await fetch(`results.json?v=${Date.now()}`);
        if (!res.ok) throw new Error('No data');
        const data = await res.json();

        if (data.last_scan) {
            document.getElementById('timestamp').textContent = `Last scan: ${data.last_scan}`;
        }

        const arxiv   = (data.arxiv   || []);
        const github  = (data.github  || []);
        const pwc     = (data.pwc     || []);

        // Top picks: high relevance from all sources (first 6)
        const topPicks = arxiv.filter(p => p.relevance === 'high').slice(0, 6);

        renderSection('top-picks-list', topPicks, paperCard, 'No top picks yet — check back after Monday\'s scan.');
        renderSection('arxiv-list',     arxiv,     paperCard, 'No arXiv papers yet.');
        renderSection('github-list',    github,    repoCard,  'No GitHub repos yet.');
        renderSection('pwc-list',       pwc,       paperCard, 'No Papers with Code entries yet.');

        setupFilters();

    } catch (e) {
        console.warn('Could not load results.json:', e.message);
        ['top-picks-list','arxiv-list','github-list','pwc-list'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div class="empty">No data yet — next scan runs Monday 10:00 UTC.</div>';
        });
    }
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

document.addEventListener('DOMContentLoaded', loadData);
