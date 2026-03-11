/* Papers Radar — selected cards + tracked tokens + metadata */

const KEYWORDS = ['lidar','slam','3d mapping','spatial ai','place recognition','point cloud',
  'localization','sensor fusion','3d perception','multimodal','autonomous driving',
  'robotics','robot learning','field robotics','neural radiance','nerf','gaussian splatting',
  'occupancy','bird\'s eye view','bev','depth estimation'];

const STAR_KEY = 'papers_radar_starred_v1';
const DISMISS_KEY = 'papers_radar_dismissed_v1';
const TRACKED_KEY = 'papers_radar_tracked_tokens_v1';
const MANUAL_KEY = 'papers_radar_manual_links_v1';

let STARRED = new Set();
let DISMISSED = new Set();
let TRACKED = { authors: [], institutions: [], keywords: [] };
let MANUAL = [];
let ALL_PAPERS = [];

function uniq(arr) { return [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))]; }

async function fetchTextSmart(url) {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.text();
  } catch {}
  // CORS fallback proxy (client-side static site constraint)
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const r2 = await fetch(proxy);
  if (!r2.ok) throw new Error(`Fetch failed for ${url}`);
  return await r2.text();
}

async function fetchJsonSmart(url) {
  const txt = await fetchTextSmart(url);
  return JSON.parse(txt);
}

function loadState() {
  try { STARRED = new Set(JSON.parse(localStorage.getItem(STAR_KEY) || '[]')); } catch { STARRED = new Set(); }
  try { DISMISSED = new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch { DISMISSED = new Set(); }
  try {
    const raw = JSON.parse(localStorage.getItem(TRACKED_KEY) || '{}');
    TRACKED = {
      authors: uniq(raw.authors || []),
      institutions: uniq(raw.institutions || []),
      keywords: uniq(raw.keywords || []),
    };
  } catch {
    TRACKED = { authors: [], institutions: [], keywords: [] };
  }

  try {
    const raw = JSON.parse(localStorage.getItem(MANUAL_KEY) || '[]');
    MANUAL = Array.isArray(raw) ? dedupePapers(raw) : [];
  } catch {
    MANUAL = [];
  }
}

function saveState() {
  localStorage.setItem(STAR_KEY, JSON.stringify([...STARRED]));
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...DISMISSED]));
  localStorage.setItem(TRACKED_KEY, JSON.stringify(TRACKED));
  localStorage.setItem(MANUAL_KEY, JSON.stringify(MANUAL));
}

function canonicalPaperKeyFromUrl(url) {
  const u = String(url || '');
  const arx = u.match(/arxiv\.org\/(?:abs|pdf)\/([^/?#]+)(?:\.pdf)?/i);
  if (arx) return `arxiv:${arx[1]}`;
  const hf = u.match(/huggingface\.co\/papers\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i);
  if (hf) return `arxiv:${hf[1]}`;
  return u;
}

function paperId(p) {
  return canonicalPaperKeyFromUrl(p?.url) || p?.title || Math.random().toString(36).slice(2);
}

function metadataScore(p) {
  let s = 0;
  if (p?.title && !String(p.title).startsWith('http')) s += 2;
  if (p?.authors) s += 2;
  if (p?.abstract) s += 2;
  if (p?.pdf_url) s += 1;
  if (p?.venue && p.venue !== 'Manual link') s += 1;
  if (p?.date) s += 1;
  if (p?.citations && p.citations !== 'Unknown') s += 1;
  return s;
}

function dedupePapers(items) {
  const map = new Map();
  const order = [];
  for (const p of (items || [])) {
    const key = paperId(p);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, p);
      order.push(key);
    } else {
      const cur = map.get(key);
      if (metadataScore(p) > metadataScore(cur)) map.set(key, p);
    }
  }
  return order.map(k => map.get(k));
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function textIncludesAny(text, tokens) {
  const t = (text || '').toLowerCase();
  return (tokens || []).filter(k => t.includes(String(k).toLowerCase()));
}

function computeTrackedHits(p) {
  const base = `${p.title || ''} ${p.abstract || ''} ${p.authors || ''} ${p.venue || ''} ${p.category || ''}`;
  const kw = textIncludesAny(base, TRACKED.keywords);
  const au = textIncludesAny(p.authors || '', TRACKED.authors);
  const inst = textIncludesAny((Array.isArray(p.institutions) ? p.institutions.join(' ') : (p.institutions || '')), TRACKED.institutions);
  return uniq([...kw, ...au, ...inst]);
}

function keywordTags(text) {
  const t = (text || '').toLowerCase();
  return KEYWORDS.filter(k => t.includes(k));
}

function scorePaper(p) {
  const starBoost = STARRED.has(paperId(p)) ? 1000 : 0;
  const trackedBoost = (p._trackedHits || []).length * 30;
  const relBoost = p.relevance === 'high' ? 20 : (p.relevance === 'medium' ? 10 : 0);
  return starBoost + trackedBoost + relBoost;
}

function tokenChip(token, cat) {
  return `<button class="paper-tag token-add" data-cat="${cat}" data-token="${token}" type="button">+ ${token}</button>`;
}

function paperCard(p) {
  const id = paperId(p);
  const checked = STARRED.has(id) ? 'checked' : '';
  const matched = keywordTags(`${p.title || ''} ${p.abstract || ''}`);
  const tags = matched.slice(0, 5).map(k => `<span class="paper-tag matched">${k}</span>`).join('');
  const catTag = p.category ? `<span class="paper-tag">${p.category}</span>` : '';

  const links = [];
  if (p.url) links.push(`<a class="paper-link" href="${p.url}" target="_blank">Paper →</a>`);
  if (p.pdf_url) links.push(`<a class="paper-link" href="${p.pdf_url}" target="_blank">PDF →</a>`);
  if (p.github_url) links.push(`<a class="paper-link" href="${p.github_url}" target="_blank">Code →</a>`);

  const venue = p.venue || (p.category ? `arXiv ${p.category}` : 'Unknown');
  const institutionsList = Array.isArray(p.institutions) ? p.institutions : (p.institutions ? [p.institutions] : []);
  const institutions = institutionsList.length ? institutionsList.join(', ') : 'Unknown';
  const citations = (p.citations ?? 'Unknown');
  const source = p.source || 'arXiv/Papers Radar';

  const authorTokens = (p.authors || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 6)
    .map(a => tokenChip(a, 'authors')).join('');
  const instTokens = institutionsList.slice(0, 6).map(i => tokenChip(i, 'institutions')).join('');
  const keywordTokens = matched.slice(0, 8).map(k => tokenChip(k, 'keywords')).join('');

  const triggerLine = (p._trackedHits && p._trackedHits.length)
    ? `<div class="trigger-line">Triggered by: ${p._trackedHits.map(t => `<span class="trigger-chip">${t}</span>`).join('')}</div>`
    : '';

  const preview = (p.abstract || '').slice(0, 420);
  const previewBlock = preview
    ? `<div class="paper-preview" style="display:none;">${preview}${(p.abstract || '').length > 420 ? '…' : ''}</div>`
    : `<div class="paper-preview" style="display:none; color:#999;">No abstract preview available.</div>`;

  const inlinePdf = (p.pdf_url || '').trim();
  const pdfBlock = inlinePdf
    ? `<div class="pdf-inline-wrap" style="display:none;"><iframe src="${inlinePdf}#toolbar=0&navpanes=0&scrollbar=1&zoom=page-fit&view=FitH" loading="lazy" referrerpolicy="no-referrer"></iframe></div>`
    : `<div class="pdf-inline-wrap" style="display:none;"><div class="empty">No PDF link available.</div></div>`;

  const metaBox = `<div class="paper-metadata" style="display:none;">
      <div><strong>Authors:</strong> ${p.authors || 'Unknown'}</div>
      <div class="token-row">${authorTokens || '<span class="empty">No author tokens</span>'}</div>
      <div><strong>Institutions:</strong> ${institutions}</div>
      <div class="token-row">${instTokens || '<span class="empty">No institution tokens</span>'}</div>
      <div><strong>Citations:</strong> ${citations}</div>
      <div><strong>Venue:</strong> ${venue}</div>
      <div><strong>Category:</strong> ${p.category || 'Unknown'}</div>
      <div><strong>Published:</strong> ${p.date ? fmtDate(p.date) : 'Unknown'}</div>
      <div><strong>Relevance:</strong> ${p.relevance || 'n/a'}</div>
      <div><strong>Source:</strong> ${source}</div>
      <div><strong>Keywords:</strong></div>
      <div class="token-row">${keywordTokens || '<span class="empty">No keyword tokens</span>'}</div>
  </div>`;

  return `<div class="paper-card" data-cat="${p.category || ''}" data-id="${id}">
      <div class="paper-head-row">
          <label class="star-toggle" title="Mark as important">
              <input type="checkbox" class="important-checkbox" data-id="${id}" ${checked}>
              <span>Important</span>
          </label>
      </div>
      <a class="paper-title" href="${p.url || '#'}" target="_blank">${p.title || 'Untitled'}</a>
      <div class="paper-meta">${p.authors ? p.authors.slice(0, 110) + (p.authors.length > 110 ? '…' : '') : ''} ${p.date ? '· ' + fmtDate(p.date) : ''}</div>
      <div class="paper-tags">${catTag}${tags}</div>
      ${triggerLine}
      ${previewBlock}
      <div class="paper-links">
          <button class="paper-link preview-toggle" data-id="${id}" type="button">Preview</button>
          <button class="paper-link pdf-toggle" data-id="${id}" type="button">PDF inline</button>
          <button class="paper-link meta-toggle" data-id="${id}" type="button">Metadata</button>
          <button class="paper-link remove-toggle" data-id="${id}" type="button">Remove</button>
          ${links.join('')}
      </div>
      ${metaBox}
      ${pdfBlock}
  </div>`;
}

function repoCard(r) {
  return `<div class="repo-card"><div class="repo-name"><a class="paper-link" href="${r.url || '#'}" target="_blank" style="border:none;padding:0;font-size:1em">${r.name || '—'}</a></div>${r.description ? `<div class="repo-desc">${r.description}</div>` : ''}<div class="repo-meta">⭐ ${r.stars || 0} &nbsp;·&nbsp; ${r.language || ''} ${r.date ? '· ' + fmtDate(r.date) : ''}</div></div>`;
}

function renderSection(id, items, cardFn, emptyMsg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) { el.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
  el.innerHTML = items.map(cardFn).join('');
}

function setupFilters() {
  document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('#arxiv-list .paper-card').forEach(card => {
        card.style.display = (filter === 'all' || card.dataset.cat === filter) ? '' : 'none';
      });
    });
  });
}

function renderTrackedLists() {
  const totalTracked = (TRACKED.authors.length + TRACKED.institutions.length + TRACKED.keywords.length);
  const summary = document.querySelector('#tracked-dropdown summary');
  if (summary) summary.textContent = `🎯 Tracked Tokens (${totalTracked})`;

  const map = [
    ['tracked-authors', 'authors'],
    ['tracked-institutions', 'institutions'],
    ['tracked-keywords', 'keywords']
  ];
  map.forEach(([id, cat]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const arr = TRACKED[cat] || [];
    if (!arr.length) { el.innerHTML = '<div class="empty">None</div>'; return; }
    el.innerHTML = arr.map(t => `<span class="track-chip">${t}<button class="chip-x" data-cat="${cat}" data-token="${t}" type="button">×</button></span>`).join('');
  });

  document.querySelectorAll('.chip-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const tok = btn.dataset.token;
      TRACKED[cat] = (TRACKED[cat] || []).filter(x => x !== tok);
      saveState();
      loadData();
    });
  });
}

function setupTokenActions() {
  document.querySelectorAll('.token-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const tok = (btn.dataset.token || '').trim();
      if (!tok) return;
      TRACKED[cat] = uniq([...(TRACKED[cat] || []), tok]);
      saveState();
      renderTrackedLists();
      loadData();
    });
  });

  const addSel = document.getElementById('add-selection-btn');
  const catSel = document.getElementById('token-category');
  if (addSel && catSel) {
    addSel.onclick = () => {
      const selected = (window.getSelection()?.toString() || '').trim();
      if (!selected) return;
      const cat = catSel.value;
      TRACKED[cat] = uniq([...(TRACKED[cat] || []), selected]);
      saveState();
      renderTrackedLists();
      loadData();
    };
  }

  const exportBtn = document.getElementById('export-tracked-btn');
  const copyBtn = document.getElementById('copy-tracked-btn');
  const out = document.getElementById('tracked-json-output');
  if (exportBtn && copyBtn && out) {
    exportBtn.onclick = () => {
      out.style.display = '';
      out.value = JSON.stringify(TRACKED, null, 2);
      copyBtn.style.display = '';
    };
    copyBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(out.value || ''); copyBtn.textContent = 'Copied ✓'; }
      catch { copyBtn.textContent = 'Copy failed'; }
      setTimeout(() => (copyBtn.textContent = 'Copy JSON'), 1200);
    };
  }
}

let HANDLERS_READY = false;
function setupCardActions() {
  if (HANDLERS_READY) return;
  HANDLERS_READY = true;

  document.addEventListener('change', (e) => {
    const cb = e.target.closest('.important-checkbox');
    if (!cb) return;
    const id = cb.dataset.id;
    if (cb.checked) STARRED.add(id); else STARRED.delete(id);
    saveState();
    loadData();
  });

  document.addEventListener('click', (e) => {
    const previewBtn = e.target.closest('.preview-toggle');
    if (previewBtn) {
      const card = previewBtn.closest('.paper-card');
      const panel = card?.querySelector('.paper-preview');
      if (!panel) return;
      const show = panel.style.display === 'none';
      panel.style.display = show ? 'block' : 'none';
      previewBtn.textContent = show ? 'Hide preview' : 'Preview';
      return;
    }

    const pdfBtn = e.target.closest('.pdf-toggle');
    if (pdfBtn) {
      const card = pdfBtn.closest('.paper-card');
      const panel = card?.querySelector('.pdf-inline-wrap');
      if (!panel) return;
      const show = panel.style.display === 'none';
      panel.style.display = show ? 'block' : 'none';
      pdfBtn.textContent = show ? 'Hide PDF' : 'PDF inline';
      return;
    }

    const metaBtn = e.target.closest('.meta-toggle');
    if (metaBtn) {
      const card = metaBtn.closest('.paper-card');
      const panel = card?.querySelector('.paper-metadata');
      if (!panel) return;
      const show = panel.style.display === 'none';
      panel.style.display = show ? 'block' : 'none';
      metaBtn.textContent = show ? 'Hide metadata' : 'Metadata';
      return;
    }

    const removeBtn = e.target.closest('.remove-toggle');
    if (removeBtn) {
      const id = removeBtn.dataset.id;
      DISMISSED.add(id);
      STARRED.delete(id);
      MANUAL = MANUAL.filter(p => paperId(p) !== id);
      saveState();
      loadData();
      return;
    }
  });
}

function normalizePaperUrl(url) {
  try {
    let s = String(url || '').trim();
    // Handle Slack-style wrapped links: <https://...>
    if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim();
    // Remove trailing punctuation accidentally copied
    s = s.replace(/[),.;]+$/, '');
    const u = new URL(s);
    return u.toString();
  } catch {
    return '';
  }
}

async function enrichArxiv(normalized, id) {
  try {
    const xml = await fetchTextSmart(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`);

    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
    const entry = entryMatch ? entryMatch[1] : xml;

    const get = (tag) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };

    const title = get('title').replace(/^arXiv:\d+\.\d+\s*/i, '').trim() || `arXiv ${id}`;
    const summary = get('summary');
    const published = get('published');

    const authorMatches = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/gi)].map(m => m[1].trim());
    const authors = uniq(authorMatches).join(', ');

    return {
      title,
      url: normalized,
      pdf_url: `https://arxiv.org/pdf/${id}`,
      authors,
      abstract: summary,
      category: 'arXiv',
      date: published ? published.slice(0, 10) : '',
      relevance: 'medium',
      venue: 'arXiv',
      source: 'Manual input (arXiv)',
      citations: 'Unknown',
      institutions: []
    };
  } catch {
    return null;
  }
}

async function enrichSemanticScholarArxiv(id) {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/ARXIV:${encodeURIComponent(id)}?fields=title,abstract,authors,venue,year,citationCount`;
    const d = await fetchJsonSmart(url);

    const authors = (d.authors || []).map(a => a.name).filter(Boolean).join(', ');
    const institutions = uniq((d.authors || []).flatMap(a => (a.affiliations || []).map(x => (x.name || x)).filter(Boolean)));

    return {
      title: d.title || `arXiv ${id}`,
      url: `https://arxiv.org/abs/${id}`,
      pdf_url: `https://arxiv.org/pdf/${id}`,
      authors,
      institutions,
      abstract: d.abstract || '',
      category: 'arXiv',
      date: d.year ? String(d.year) : '',
      relevance: 'medium',
      venue: d.venue || 'arXiv',
      source: 'Manual input (Semantic Scholar)',
      citations: d.citationCount ?? 'Unknown'
    };
  } catch {
    return null;
  }
}

async function searchArxivByTitle(title) {
  try {
    const q = String(title || '').trim();
    if (!q || q.length < 12) return null;

    const query = encodeURIComponent(`ti:\"${q.slice(0, 180)}\"`);
    const xml = await fetchTextSmart(`https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=3`);

    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(m => m[1]);
    if (!entries.length) return null;

    const pick = (block, tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };

    // pick best by token overlap with title
    const tokens = new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2));
    let best = null, bestScore = -1;
    for (const e of entries) {
      const t = pick(e, 'title').toLowerCase();
      const et = new Set(t.split(/[^a-z0-9]+/).filter(x => x.length > 2));
      let hit = 0;
      tokens.forEach(tok => { if (et.has(tok)) hit++; });
      const score = tokens.size ? hit / tokens.size : 0;
      if (score > bestScore) { bestScore = score; best = e; }
    }

    if (!best || bestScore < 0.35) return null;

    const idMatch = best.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/i);
    const id = idMatch ? idMatch[1].trim() : '';
    if (!id) return null;

    const titleOut = pick(best, 'title');
    const summary = pick(best, 'summary');
    const published = pick(best, 'published');
    const authors = [...best.matchAll(/<name>([\s\S]*?)<\/name>/gi)].map(m => m[1].trim()).join(', ');

    return {
      title: titleOut || q,
      url: `https://arxiv.org/abs/${id}`,
      pdf_url: `https://arxiv.org/pdf/${id}`,
      authors,
      institutions: [],
      abstract: summary,
      category: 'arXiv',
      date: published ? published.slice(0, 10) : '',
      relevance: 'medium',
      venue: 'arXiv',
      source: 'Manual input (title->arXiv match)',
      citations: 'Unknown'
    };
  } catch {
    return null;
  }
}

async function enrichCrossref(normalized, doi) {
  try {
    const data = await fetchJsonSmart(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    const m = data?.message || {};
    const title = (m.title && m.title[0]) || normalized;
    const authors = (m.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ').trim()).filter(Boolean).join(', ');
    const venue = (m['container-title'] && m['container-title'][0]) || 'Unknown venue';
    const year = m?.issued?.['date-parts']?.[0]?.[0];
    const abstract = (m.abstract || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim();

    return {
      title,
      url: normalized,
      pdf_url: '',
      authors,
      abstract,
      category: 'DOI',
      date: year ? String(year) : '',
      relevance: 'medium',
      venue,
      source: 'Manual input (Crossref DOI)',
      citations: m['is-referenced-by-count'] ?? 'Unknown',
      institutions: []
    };
  } catch {
    return null;
  }
}

async function enrichFromGenericPage(normalized) {
  try {
    const html = await fetchTextSmart(normalized);

    const pick = (re) => {
      const m = html.match(re);
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };

    const title = pick(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                  pick(/<title>([\s\S]*?)<\/title>/i) ||
                  normalized;

    const description = pick(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                        pick(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                        '';

    // Try find arXiv link inside page
    const arxivLink = pick(/https?:\/\/arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i);
    if (arxivLink) {
      const id = arxivLink;
      const canonical = `https://arxiv.org/abs/${id}`;
      const enriched = await enrichArxiv(canonical, id);
      if (enriched) return enriched;
      return {
        title,
        url: canonical,
        pdf_url: `https://arxiv.org/pdf/${id}`,
        authors: '',
        abstract: description,
        category: 'arXiv',
        date: '',
        relevance: 'medium',
        venue: 'arXiv',
        source: 'Manual input (generic->arXiv)',
        citations: 'Unknown',
        institutions: []
      };
    }

    return {
      title,
      url: normalized,
      pdf_url: '',
      authors: '',
      abstract: description,
      category: 'manual',
      date: '',
      relevance: 'medium',
      venue: 'Manual link',
      source: 'Manual input (generic enriched)',
      citations: 'Unknown',
      institutions: []
    };
  } catch {
    return null;
  }
}

async function manualPaperFromUrl(url) {
  const normalized = normalizePaperUrl(url);
  if (!normalized) return null;

  // HuggingFace papers link with arXiv id in path
  const hfArxiv = normalized.match(/huggingface\.co\/papers\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i);
  if (hfArxiv) {
    const id = hfArxiv[1];
    const canonical = `https://arxiv.org/abs/${id}`;
    const enriched = await enrichArxiv(canonical, id);
    if (enriched) return { ...enriched, source: 'Manual input (HF->arXiv)' };

    const ss = await enrichSemanticScholarArxiv(id);
    if (ss) return { ...ss, source: 'Manual input (HF->SemanticScholar)' };

    return {
      title: `arXiv ${id}`,
      url: canonical,
      pdf_url: `https://arxiv.org/pdf/${id}`,
      authors: '',
      abstract: '',
      category: 'arXiv',
      date: '',
      relevance: 'medium',
      venue: 'arXiv',
      source: 'Manual input (HF fallback)',
      citations: 'Unknown',
      institutions: []
    };
  }

  // arXiv URL support (abs/pdf)
  const arxivAbs = normalized.match(/arxiv\.org\/(abs|pdf)\/([^?#/]+)(?:\.pdf)?/i);
  if (arxivAbs) {
    const id = arxivAbs[2];
    const canonical = `https://arxiv.org/abs/${id}`;
    const enriched = await enrichArxiv(canonical, id);
    if (enriched) return enriched;

    const ss = await enrichSemanticScholarArxiv(id);
    if (ss) return ss;

    return {
      title: `Manual arXiv paper: ${id}`,
      url: canonical,
      pdf_url: `https://arxiv.org/pdf/${id}`,
      authors: '', abstract: '', category: 'arXiv', date: '', relevance: 'medium',
      venue: 'arXiv', source: 'Manual input (arXiv fallback)', citations: 'Unknown', institutions: []
    };
  }

  // DOI URL support
  const doiMatch = normalized.match(/doi\.org\/(10\.[^\s]+)/i);
  if (doiMatch) {
    const doi = decodeURIComponent(doiMatch[1]);
    const enriched = await enrichCrossref(normalized, doi);
    if (enriched) return enriched;
  }

  // IEEE Xplore fallback (extract arnumber)
  const ieee = normalized.match(/ieeexplore\.ieee\.org\/(?:abstract\/document|document|stamp\/stamp\.jsp\?arnumber=)(\d+)/i)
    || normalized.match(/[?&]arnumber=(\d+)/i);
  if (ieee) {
    const ar = ieee[1];

    // Try generic enrichment first to capture page title/description when accessible
    const g = await enrichFromGenericPage(normalized);
    if (g && g.title && !String(g.title).includes('ieeexplore.ieee.org')) {
      const byTitle = await searchArxivByTitle(g.title);
      if (byTitle) return { ...byTitle, source: 'Manual input (IEEE title->arXiv)' };
      return {
        ...g,
        url: `https://ieeexplore.ieee.org/document/${ar}`,
        pdf_url: g.pdf_url || `https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?tp=&arnumber=${ar}`,
        venue: 'IEEE Xplore',
        source: 'Manual input (IEEE generic enriched)'
      };
    }

    return {
      title: `IEEE Xplore paper #${ar}`,
      url: `https://ieeexplore.ieee.org/document/${ar}`,
      pdf_url: `https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?tp=&arnumber=${ar}`,
      authors: '',
      abstract: 'IEEE metadata endpoint is restricted without API/browser session. Add DOI for full auto-enrichment.',
      category: 'IEEE',
      date: '',
      relevance: 'medium',
      venue: 'IEEE Xplore',
      source: 'Manual input (IEEE fallback)',
      citations: 'Unknown',
      institutions: []
    };
  }

  // Generic page enrichment (title/desc + arXiv link sniffing)
  const generic = await enrichFromGenericPage(normalized);
  if (generic) {
    if (!generic.pdf_url || !generic.authors || !generic.abstract) {
      const byTitle = await searchArxivByTitle(generic.title || '');
      if (byTitle) return byTitle;
    }
    return generic;
  }

  // Final fallback
  return {
    title: normalized,
    url: normalized,
    pdf_url: '',
    authors: '',
    abstract: '',
    category: 'manual',
    date: '',
    relevance: 'medium',
    venue: 'Manual link',
    source: 'Manual input',
    citations: 'Unknown',
    institutions: []
  };
}

function setupManualAdd() {
  const input = document.getElementById('manual-paper-url');
  const btn = document.getElementById('manual-paper-add');
  if (!input || !btn) return;

  const submit = async () => {
    const raw = (input.value || '').trim();
    if (!raw) return;

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Adding...';

    try {
      let paper = null;
      try {
        paper = await manualPaperFromUrl(raw);
      } catch {
        paper = null;
      }

      // Hard fallback: ALWAYS add something
      if (!paper) {
        const normalized = normalizePaperUrl(raw) || raw;
        paper = {
          title: normalized,
          url: normalized,
          pdf_url: '',
          authors: '',
          abstract: '',
          category: 'manual',
          date: '',
          relevance: 'medium',
          venue: 'Manual link',
          source: 'Manual input (hard fallback)',
          citations: 'Unknown',
          institutions: []
        };
      }

      const pid = paperId(paper);
      const idx = MANUAL.findIndex(p => paperId(p) === pid);
      if (idx >= 0) {
        // Upsert: replace stale/partial entry with latest parsed metadata
        MANUAL[idx] = paper;
      } else {
        MANUAL.unshift(paper);
      }

      // If this paper was removed before, bringing it back should un-dismiss it
      DISMISSED.delete(pid);

      STARRED.add(pid);
      saveState();
      input.value = '';
      await loadData();
    } finally {
      btn.textContent = old;
      btn.disabled = false;
    }
  };

  btn.onclick = submit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') submit();
  };
}

function renderSelectedDropdown() {
  const box = document.getElementById('selected-list');
  const summary = document.querySelector('#selected-dropdown summary');
  if (!box || !summary) return;
  const selected = ALL_PAPERS.filter(p => STARRED.has(paperId(p)) && !DISMISSED.has(paperId(p)));
  summary.textContent = `⭐ Selected Papers (${selected.length})`;
  if (!selected.length) { box.innerHTML = '<div class="empty">No selected papers yet.</div>'; return; }
  box.innerHTML = selected.slice(0, 50).map(p => {
    const id = paperId(p);
    return `<div class="selected-item"><a href="${p.url || '#'}" target="_blank">${p.title || 'Untitled'}</a><button class="paper-link unselect-btn" data-id="${id}" type="button">Unselect</button></div>`;
  }).join('');

  box.querySelectorAll('.unselect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STARRED.delete(btn.dataset.id);
      saveState();
      loadData();
    });
  });
}

function renderImportantList() {
  const el = document.getElementById('important-list');
  if (!el) return;
  const important = ALL_PAPERS.filter(p => STARRED.has(paperId(p)) && !DISMISSED.has(paperId(p)));
  if (!important.length) { el.innerHTML = '<div class="empty">No papers starred yet.</div>'; return; }
  el.innerHTML = important.slice(0, 20).map(paperCard).join('');
  setupCardActions();
  setupTokenActions();
}

function setupPriorityExport() {
  const exportBtn = document.getElementById('export-priority-btn');
  const copyBtn = document.getElementById('copy-priority-btn');
  const output = document.getElementById('priority-json-output');
  if (!exportBtn || !copyBtn || !output) return;

  exportBtn.onclick = () => {
    const topics = uniq([...(TRACKED.keywords || []), 'slam', 'point cloud', 'localization', 'sensor fusion']).slice(0, 16);
    const suggested = { priority_ratio: 0.25, topics };
    output.style.display = '';
    output.value = JSON.stringify(suggested, null, 2);
    copyBtn.style.display = '';
  };

  copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(output.value || ''); copyBtn.textContent = 'Copied ✓'; }
    catch { copyBtn.textContent = 'Copy failed'; }
    setTimeout(() => (copyBtn.textContent = 'Copy JSON'), 1200);
  };
}

async function loadData() {
  loadState();
  try {
    const res = await fetch(`results.json?v=${Date.now()}`);
    if (!res.ok) throw new Error('No data');
    const data = await res.json();

    if (data.last_scan) document.getElementById('timestamp').textContent = `Last scan: ${data.last_scan}`;

    const arxivRaw = data.arxiv || [];
    const github = data.github || [];
    const pwcRaw = data.pwc || [];

    const arxiv = arxivRaw.filter(p => !DISMISSED.has(paperId(p))).map(p => ({ ...p, _trackedHits: computeTrackedHits(p) }));
    const pwc = pwcRaw.filter(p => !DISMISSED.has(paperId(p))).map(p => ({ ...p, _trackedHits: computeTrackedHits(p) }));
    const manual = MANUAL.filter(p => !DISMISSED.has(paperId(p))).map(p => ({ ...p, _trackedHits: computeTrackedHits(p) }));

    const merged = dedupePapers([...arxiv, ...manual, ...pwc]).map(p => ({ ...p, _trackedHits: computeTrackedHits(p) }));

    ALL_PAPERS = merged;

    const topPicks = [...merged].filter(p => p.relevance === 'high').sort((a,b)=>scorePaper(b)-scorePaper(a)).slice(0, 6);
    const arxivSorted = [...dedupePapers([...arxiv, ...manual])].sort((a,b)=>scorePaper(b)-scorePaper(a));
    const pwcSorted = [...pwc].sort((a,b)=>scorePaper(b)-scorePaper(a));

    renderSection('top-picks-list', topPicks, paperCard, 'No top picks yet.');
    renderSection('arxiv-list', arxivSorted, paperCard, 'No arXiv papers yet.');
    renderSection('github-list', github, repoCard, 'No GitHub repos yet.');
    renderSection('pwc-list', pwcSorted, paperCard, 'No Papers with Code entries yet.');

    setupFilters();
    renderImportantList();
    renderSelectedDropdown();
    renderTrackedLists();
    setupTokenActions();
    setupCardActions();
    setupManualAdd();
    setupPriorityExport();

  } catch {
    ['important-list','top-picks-list','arxiv-list','github-list','pwc-list'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="empty">No data yet — next scan runs Wednesday 09:00 UTC.</div>';
    });
  }
}

document.addEventListener('DOMContentLoaded', loadData);
