/* Research Radar — concise view */

function fmtDate(dateStr) {
  if (!dateStr || dateStr === 'unknown') return '<span style="color:#aaa">TBD</span>';
  return dateStr;
}

function relBadge(rel) {
  const r = (rel || 'low').toLowerCase();
  return `<span class="rel-badge ${r}">${r}</span>`;
}

function linkBtn(url) {
  if (!url) return '—';
  return `<a href="${url}" class="call-link" target="_blank">Open →</a>`;
}

async function loadData() {
  try {
    const res = await fetch(`results.json?v=${Date.now()}`);
    if (!res.ok) throw new Error('No data');
    const data = await res.json();

    const items = (data.upcoming || []);
    if (data.last_scan) document.getElementById('timestamp').textContent = `Last scan: ${data.last_scan}`;

    // essential-only slices
    const high = items.filter(i => i.relevance === 'high').slice(0, 12);
    const medium = items.filter(i => i.relevance === 'medium').slice(0, 12);
    const urgent = items.filter(i => i.deadline && i.deadline !== 'unknown').slice(0, 8);

    render('urgent-tbody', urgent, rowUrgent, 6, 'No explicit deadline entries found.');
    render('conf-tbody', high, rowMain, 7, 'No high-relevance entries.');
    render('journal-tbody', medium, rowSecondary, 6, 'No medium-relevance entries.');
    render('workshop-tbody', [], rowMain, 5, 'Hidden for concise mode.');
  } catch (e) {
    ['urgent-tbody','conf-tbody','journal-tbody','workshop-tbody'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<tr><td colspan="7" class="empty">No data yet.</td></tr>';
    });
  }
}

function render(id, items, rowFn, cols, emptyMsg) {
  const tb = document.getElementById(id);
  if (!tb) return;
  if (!items.length) {
    tb.innerHTML = `<tr><td colspan="${cols}" class="empty">${emptyMsg}</td></tr>`;
    return;
  }
  tb.innerHTML = items.map(rowFn).join('');
}

function rowUrgent(i) {
  return `<tr>
    <td>${fmtDate(i.deadline)}</td>
    <td><strong>${i.name}</strong></td>
    <td>${i.type || '—'}</td>
    <td>${i.location || '—'}</td>
    <td>${relBadge(i.relevance)}</td>
    <td>${linkBtn(i.url)}</td>
  </tr>`;
}

function rowMain(i) {
  return `<tr>
    <td><strong>${i.name}</strong></td>
    <td>${fmtDate(i.deadline)}</td>
    <td>${fmtDate(i.notification)}</td>
    <td>${i.event_date || '—'}</td>
    <td>${i.location || '—'}</td>
    <td>${relBadge(i.relevance)}</td>
    <td>${linkBtn(i.url)}</td>
  </tr>`;
}

function rowSecondary(i) {
  return `<tr>
    <td><strong>${i.name}</strong></td>
    <td>${fmtDate(i.deadline)}</td>
    <td><span class="type-badge">${i.type || '—'}</span></td>
    <td>${relBadge(i.relevance)}</td>
    <td style="font-size:0.85em;color:var(--text-light)">${i.notes || '—'}</td>
    <td>${linkBtn(i.url)}</td>
  </tr>`;
}

document.addEventListener('DOMContentLoaded', loadData);
