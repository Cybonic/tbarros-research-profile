/* Professor Radar — Data Population Script */

const TODAY = new Date();

function daysDiff(dateStr) {
    if (!dateStr || dateStr === 'unknown') return Infinity;
    const d = new Date(dateStr);
    return Math.round((d - TODAY) / (1000 * 60 * 60 * 24));
}

function fmtDate(dateStr) {
    if (!dateStr || dateStr === 'unknown') return '<span style="color:#aaa">TBD</span>';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function urgencyClass(days) {
    if (days <= 14) return 'status-urgent';
    if (days <= 30) return 'status-soon';
    if (days <= 90) return 'status-coming';
    return 'status-ongoing';
}

function sourceBadge(src) {
    const map = { euraxess: 'EURAXESS', dre: 'DRE', university_direct: 'University' };
    return `<span class="type-badge">${map[src] || src || '—'}</span>`;
}

function linkBtn(url) {
    if (!url) return '—';
    return `<a href="${url}" class="call-link" target="_blank">Open →</a>`;
}

function statusDot(src_status) {
    const map = { ok: '✅', empty: '⬜', 'js-heavy': '⚠️', '404': '❌', error: '❌' };
    return map[src_status] || '⬜';
}

async function loadData() {
    try {
        const res = await fetch(`results.json?v=${Date.now()}`);
        if (!res.ok) throw new Error('No data yet');
        const data = await res.json();

        const positions = (data.positions || []);
        const scanTime  = data.last_scan || null;
        const sources   = data.scan_sources || {};

        if (scanTime) {
            document.getElementById('timestamp').textContent = `Last scan: ${scanTime}`;
        }

        const relevant = positions.filter(p => p.relevant === true)
            .sort((a, b) => daysDiff(a.deadline) - daysDiff(b.deadline));
        const other = positions.filter(p => p.relevant !== true)
            .sort((a, b) => daysDiff(a.deadline) - daysDiff(b.deadline));

        renderPositions('relevant-tbody', relevant, 6);
        renderPositions('other-tbody', other, 6);
        renderSources(sources);

    } catch (e) {
        console.warn('Could not load results.json:', e.message);
        ['relevant-tbody', 'other-tbody'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<tr><td colspan="6" class="empty">No data yet — next scan runs Monday 09:00 UTC.</td></tr>';
        });
    }
}

function renderPositions(tbodyId, items, cols) {
    const tbody = document.getElementById(tbodyId);
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="${cols}" class="empty">No positions found.</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(p => {
        const days = daysDiff(p.deadline);
        const deadlineCell = days === Infinity
            ? fmtDate(p.deadline)
            : `<span class="${urgencyClass(days)}">${fmtDate(p.deadline)}${days < 999 ? ` <small style="color:#999">(${days}d)</small>` : ''}</span>`;
        return `<tr>
            <td><strong>${p.university || '—'}</strong></td>
            <td>${p.title || '—'}</td>
            <td style="font-size:0.88em">${p.department || '—'}</td>
            <td>${deadlineCell}</td>
            <td>${sourceBadge(p.source)}</td>
            <td>${linkBtn(p.link)}</td>
        </tr>`;
    }).join('');
}

function renderSources(sources) {
    const list = document.getElementById('sources-list');
    const entries = Object.entries(sources);
    if (!entries.length) {
        list.innerHTML = '<li class="empty">No source data available.</li>';
        return;
    }
    list.innerHTML = entries.map(([name, status]) =>
        `<li>${statusDot(status)} <strong>${name}</strong> — <span style="color:var(--text-light);font-size:0.88em">${status}</span></li>`
    ).join('');
}

document.addEventListener('DOMContentLoaded', loadData);
