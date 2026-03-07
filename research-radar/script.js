/* Research Radar — Data Population Script */

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
    if (days <= 14)  return 'status-urgent';
    if (days <= 30)  return 'status-soon';
    if (days <= 90)  return 'status-coming';
    return 'status-ongoing';
}

function urgencyDot(days) {
    if (days <= 14)  return '🔴';
    if (days <= 30)  return '🟡';
    if (days <= 90)  return '🟢';
    return '⚪';
}

function relBadge(rel) {
    const r = (rel || 'low').toLowerCase();
    return `<span class="rel-badge ${r}">${r}</span>`;
}

function typeBadge(type) {
    return `<span class="type-badge">${type || '—'}</span>`;
}

function linkBtn(url) {
    if (!url) return '—';
    return `<a href="${url}" class="call-link" target="_blank">Open →</a>`;
}

async function loadData() {
    try {
        const res = await fetch(`results.json?v=${Date.now()}`);
        if (!res.ok) throw new Error('No data yet');
        const data = await res.json();

        const items = (data.upcoming || []);
        const scanTime = data.last_scan || null;

        if (scanTime) {
            const el = document.getElementById('timestamp');
            el.textContent = `Last scan: ${scanTime}`;
        }

        const urgent    = items.filter(i => daysDiff(i.deadline) <= 30).sort((a,b) => daysDiff(a.deadline) - daysDiff(b.deadline));
        const confs     = items.filter(i => i.type === 'conference').sort((a,b) => daysDiff(a.deadline) - daysDiff(b.deadline));
        const journals  = items.filter(i => i.type === 'journal' || i.type === 'special_issue').sort((a,b) => daysDiff(a.deadline) - daysDiff(b.deadline));
        const workshops = items.filter(i => i.type === 'workshop').sort((a,b) => daysDiff(a.deadline) - daysDiff(b.deadline));

        renderUrgent(urgent);
        renderConferences(confs);
        renderJournals(journals);
        renderWorkshops(workshops);

    } catch (e) {
        console.warn('Could not load results.json:', e.message);
        ['urgent-tbody', 'conf-tbody', 'journal-tbody', 'workshop-tbody'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<tr><td colspan="7" class="empty">No data yet — next scan runs Monday 09:30 UTC.</td></tr>';
        });
    }
}

function renderUrgent(items) {
    const tbody = document.getElementById('urgent-tbody');
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No deadlines in the next 30 days.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(i => {
        const days = daysDiff(i.deadline);
        return `<tr>
            <td class="${urgencyClass(days)}">${urgencyDot(days)} ${fmtDate(i.deadline)} <small style="color:#999">(${days}d)</small></td>
            <td><strong>${i.name}</strong></td>
            <td>${typeBadge(i.type)}</td>
            <td>${i.location || '—'}</td>
            <td>${relBadge(i.relevance)}</td>
            <td>${linkBtn(i.url)}</td>
        </tr>`;
    }).join('');
}

function renderConferences(items) {
    const tbody = document.getElementById('conf-tbody');
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No conferences found in latest scan.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(i => `<tr>
        <td><strong>${i.name}</strong></td>
        <td>${fmtDate(i.deadline)}</td>
        <td>${fmtDate(i.notification)}</td>
        <td>${i.event_date || '—'}</td>
        <td>${i.location || '—'}</td>
        <td>${relBadge(i.relevance)}</td>
        <td>${linkBtn(i.url)}</td>
    </tr>`).join('');
}

function renderJournals(items) {
    const tbody = document.getElementById('journal-tbody');
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No journal calls found in latest scan.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(i => `<tr>
        <td><strong>${i.name}</strong></td>
        <td>${fmtDate(i.deadline)}</td>
        <td>${typeBadge(i.type)}</td>
        <td>${relBadge(i.relevance)}</td>
        <td style="font-size:0.85em;color:var(--text-light)">${i.notes || '—'}</td>
        <td>${linkBtn(i.url)}</td>
    </tr>`).join('');
}

function renderWorkshops(items) {
    const tbody = document.getElementById('workshop-tbody');
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No workshops found in latest scan.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(i => `<tr>
        <td><strong>${i.name}</strong></td>
        <td>${fmtDate(i.deadline)}</td>
        <td>${i.event_date || '—'}</td>
        <td>${relBadge(i.relevance)}</td>
        <td>${linkBtn(i.url)}</td>
    </tr>`).join('');
}

document.addEventListener('DOMContentLoaded', loadData);
