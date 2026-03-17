/* Funding Radar - Data Population Script */

const DATE_FMT = { month: 'short', day: 'numeric' };

function byDate(a, b) {
    return new Date(a.date) - new Date(b.date);
}

async function loadData() {
    try {
        const v = Date.now();
        const callsResponse = await fetch(`calls.json?v=${v}`);
        const callsData = await callsResponse.json();
        populateCalls(callsData);

        const newsResponse = await fetch(`news.json?v=${v}`);
        const newsData = await newsResponse.json();
        populateNews(newsData);

        updateTimestamp(callsData.timestamp);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function parseDeadline(deadline) {
    if (!deadline) return null;
    // Keep non-exact deadlines visible (e.g., Q2 2026, Rolling)
    if (/rolling|q[1-4]/i.test(deadline)) return null;

    // Handle ranges like "30/01/2026 - 30/09/2026" by taking the end date.
    const parts = String(deadline).split('-').map(s => s.trim());
    const candidate = parts.length > 1 ? parts[parts.length - 1] : String(deadline).trim();

    // dd/mm/yyyy
    const m = candidate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
        const [, dd, mm, yyyy] = m;
        return new Date(`${yyyy}-${mm}-${dd}T23:59:59`);
    }

    // Fallback to Date parser for formats like "Mar 31, 2026"
    const d = new Date(candidate);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isActiveCall(call) {
    const d = parseDeadline(call.deadline);
    if (!d) return true;
    const now = new Date();
    return d >= now;
}

function populateCalls(data) {
    const tbody = document.getElementById('calls-tbody');
    const activeCalls = data.calls.filter(isActiveCall);

    if (activeCalls.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align:center;color:#666;">No active announcements.</td>';
        tbody.appendChild(row);
        return;
    }

    activeCalls.forEach(call => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="status-${getStatusClass(call.status)}">${call.status}</td>
            <td><strong>${call.program}</strong></td>
            <td>${call.deadline}</td>
            <td>${call.budget}</td>
            <td>${call.support}</td>
            <td>${call.eligible}</td>
            <td>${call.objective}</td>
            <td><a href="${call.link}" class="call-link" target="_blank">Details →</a></td>
        `;
        tbody.appendChild(row);
    });
}

function fmt(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', DATE_FMT);
}

function isUpcoming(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return true;
    // Keep entries whose date is today or in the future.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d >= today;
}

function populateNews(data) {
    const { webinars, announcements, coming_soon } = data.news;

    const webinarsList = document.getElementById('webinars-list');
    [...webinars]
        .filter(w => isUpcoming(w.date))
        .sort(byDate)
        .forEach(w => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="news-date">${fmt(w.date)}</span> ${w.title} — <a href="${w.link}" target="_blank">Register</a>`;
            webinarsList.appendChild(li);
        });

    const announcementsList = document.getElementById('announcements-list');
    [...announcements]
        .filter(a => isUpcoming(a.date))
        .sort(byDate)
        .forEach(a => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="news-date">${fmt(a.date)}</span> ${a.title} — <a href="${a.link}" target="_blank">Read more</a>`;
            announcementsList.appendChild(li);
        });

    const comingSoonList = document.getElementById('coming-soon-list');
    [...coming_soon]
        .filter(cs => isUpcoming(cs.date))
        .sort(byDate)
        .forEach(cs => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="news-date">${fmt(cs.date)}</span> ${cs.program} <span style="color:var(--text-light);font-size:0.85em">${cs.status}</span>`;
            comingSoonList.appendChild(li);
        });
}

function getStatusClass(status) {
    if (status.includes('🔴')) return 'urgent';
    if (status.includes('🟡')) return 'soon';
    if (status.includes('🟢')) return 'coming';
    return 'ongoing';
}

function updateTimestamp(timestamp) {
    const element = document.getElementById('timestamp');
    const formatted = new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    element.textContent = `Last updated: ${formatted}`;
}

document.addEventListener('DOMContentLoaded', loadData);
