/* Funding Radar - Data Population Script */

async function loadData() {
    try {
        // Load calls
        const callsResponse = await fetch('calls.json');
        const callsData = await callsResponse.json();
        populateCalls(callsData);
        
        // Load news
        const newsResponse = await fetch('news.json');
        const newsData = await newsResponse.json();
        populateNews(newsData);
        
        // Update timestamp
        updateTimestamp(callsData.timestamp);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function populateCalls(data) {
    const tbody = document.getElementById('calls-tbody');
    
    data.calls.forEach(call => {
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

function populateNews(data) {
    const { webinars, announcements, coming_soon } = data.news;
    
    // Webinars
    const webinarsList = document.getElementById('webinars-list');
    webinars.forEach(w => {
        const li = document.createElement('li');
        const dateObj = new Date(w.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        li.innerHTML = `<span class="news-date">${formattedDate}</span> ${w.title} — <a href="${w.link}" target="_blank">Register</a>`;
        webinarsList.appendChild(li);
    });
    
    // Announcements
    const announcementsList = document.getElementById('announcements-list');
    announcements.forEach(a => {
        const li = document.createElement('li');
        const dateObj = new Date(a.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        li.innerHTML = `<span class="news-date">${formattedDate}</span> ${a.title} — <a href="${a.link}" target="_blank">Read more</a>`;
        announcementsList.appendChild(li);
    });
    
    // Coming Soon
    const comingSoonList = document.getElementById('coming-soon-list');
    coming_soon.forEach(cs => {
        const li = document.createElement('li');
        const dateObj = new Date(cs.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        li.innerHTML = `<span class="news-date">${formattedDate}</span> ${cs.program} <span style="color:var(--text-light);font-size:0.85em">${cs.status}</span>`;
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
    const date = new Date(timestamp);
    const formatted = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    element.textContent = `Last updated: ${formatted}`;
}

// Load data on page load
document.addEventListener('DOMContentLoaded', loadData);
