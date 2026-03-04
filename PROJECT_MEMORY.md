# tbarros-research Project Memory

**Project:** Tiago Barros Research Portfolio Website  
**Canonical Path:** `/swift_workspace/Dropbox/tbarros-research/`  
**Created:** March 1, 2026  
**Status:** Complete (awaiting GitHub push)

---

## Project Overview

Single-page research portfolio for Tiago Barros, PhD (Institute of Systems and Robotics, University of Coimbra).

Features:
- Minimalist, academic design (Georgia serif typography, black/white/gray palette)
- Sections: About, News, Publications, Projects (6 items), Talks/Workshops/Poster Sessions (by role), Collaborations
- Integrated funding radar (separate page) for weekly R&D opportunity monitoring
- Team photo integration (AI Green project)
- 1200px max-width responsive layout

---

## Repository Structure

```
tbarros-research/
├── index.html                          # Main single-page portfolio
├── assets/
│   ├── css/
│   │   └── main.css                   # Minimalist styling (Georgia, black/white/gray)
│   ├── js/
│   │   └── main.js                    # Smooth scroll, nav highlighting
│   └── images/
│       ├── tiago.png                  # Profile photo (300px max-width)
│       ├── email.png                  # Email logo (official)
│       ├── google-scholar.png         # Google Scholar badge (474x474, square)
│       ├── orcid.png                  # ORCID identifier (260x260, cropped to square)
│       └── team.png                   # AI Green team photo (350px max-width)
├── funding-radar/
│   ├── index.html                     # Funding radar dashboard
│   ├── style.css                      # Radar styling
│   ├── script.js                      # Radar interactions
│   ├── calls.json                     # Active funding calls (8 portals)
│   └── news.json                      # News/webinars/announcements
├── .github/
│   └── workflows/
│       └── update-radar.yml           # Auto-update workflow (Monday 9 AM UTC)
├── README.md                          # Project documentation
├── CNAME                              # Domain: tiagobarros-research.com
└── .git/                              # Full git history

```

---

## Design Specifications

### Typography & Colors
- **Font:** Georgia serif (academic, professional)
- **Colors:** Black (#000000), white (#ffffff), gray (#333333, #666666, #e0e0e0)
- **Accents:** Blue (#1e90ff) for role labels in Talks section only
- **Effects:** NO gradients, NO rounded corners on main elements, NO shadows

### Layout
- **Container:** 1200px max-width
- **Padding:** 50px horizontal, 60px vertical sections, 50px gaps between sections
- **Profile Photo:** 300px max-width, 8px border-radius, 1px border
- **Team Photo:** 350px max-width, 8px border-radius, 1px border
- **Talks Section:** Single-column layout, left-aligned
  - Format: `(YYYY) Role | Title` on first line, `Location` on second line

### Image Specifications
- Social icons: 40x40px containers, 32x32px images with `object-fit: contain`
- Logo aspect ratios:
  - Email: rectangular (dimensions unspecified, functional)
  - Google Scholar: 474x474px (square)
  - ORCID: 260x260px (square, cropped with ImageMagick)

---

## Sections Breakdown

### 1. About Me
- Profile photo (300px max-width) left-aligned
- Bio text: "Tiago Barros, PhD, is a research scientist..."
- Social contact links with official logos (email, Google Scholar, ORCID)

### 2. News
- Placeholder (placeholder content; will be populated)

### 3. Publications
- Numbered list of journal articles, conferences, preprints
- Organized chronologically (most recent first)

### 4. Projects (6 items)
1. **PharmaRobot** (2025-2028) — Hospital medication delivery robot
2. **VESTA** (2024-2025) — Vegetation management with Earth Observation + AI
3. **XPro** (2024-2026) — Probabilistic explainability for robot perception
4. **PPS18** (2022-2025) — Intelligent warehouse management with AMR stackers
5. **GreenBotics** (2022-2025) — Precision agriculture with multimodal sensing
6. **AI Green** (2022-2025) — Multimodal spatio-temporal probabilistic inference (with team photo)
7. **Multi-modal Perception for Long-term Localization** (2022-2025) — FCT PhD Grant

### 5. Talks, Workshops & Poster Sessions
Organized by role (5 categories):
- **Speaker** (3 entries)
- **Speaker & Organizer** (3 entries)
- **Invited Speaker** (1 entry)
- **Poster Presenter** (4 entries)
- **Organizer & Conference Leadership** (2 entries)

Format: `(YYYY) Role | Title` → `Location`

### 6. Collaborations (5 institutions)
- Institute of Systems and Robotics, University of Coimbra
- Politecnico di Milano
- University of Graz
- Freie Universität Berlin
- Technical University of Denmark

### 7. Funding Radar (Separate Page)
- URL: `/funding-radar/`
- Table A: Active Calls (8 portals monitoring)
- Table B: News/Webinars/Announcements
- Auto-update: Monday 9 AM UTC via GitHub Actions

---

## Git History

Latest commits (as of Mar 1, 03:00 UTC):
- `7c44e1c` — Format Talks section: single column layout, year first, left-aligned
- `8365d5f` — Reorganized Talks section by role with blue labels at row start
- `0ba5127` — Refined layout: larger profile image (300px), wider content (1200px max-width), increased spacing, removed About Me heading

**Total commits:** 10+  
**Branch:** main  
**Remote:** git@github.com:tiagobarros/tbarros-research.git (not yet created on GitHub)

---

## Deployment Status

### ✅ Local
- Python http.server running at `http://localhost:8000`
- All pages accessible and tested
- Responsive design verified

### ⏳ GitHub Pages
- **Blocker:** Repository doesn't exist on GitHub yet
- **Action Required:** Create repo at https://github.com/tiagobarros/tbarros-research (public)
- **Then:** `git push -u origin main` from container
- **Setup:** Enable GitHub Pages, point CNAME to domain registrar

### ⏳ DNS & Domain
- **Domain:** tiagobarros-research.com
- **Status:** Pending GitHub Pages setup and DNS configuration

---

## Known Blockers & TODOs

### 🔴 CRITICAL
1. **GitHub Repository Creation** — Repo doesn't exist yet
   - User must create at https://github.com/new (public, no initial files)
   - OR provide Personal Access Token for automated creation
   
2. **GitHub Pages Deployment** — After repo exists:
   - Enable in repo settings (Settings → Pages)
   - Source: main branch, root directory
   - Wait ~5 minutes for first deployment
   - Add CNAME: `tiagobarros-research.com`

3. **DNS Configuration** — Point domain to GitHub Pages nameservers
   - Pending after GitHub Pages is live

### 🟡 MEDIUM
1. **Funding Radar Data** — Currently 8 sample funding calls
   - Real scraping implementation pending
   - Portals: 8 focused on Portuguese + EU AI/Robotics/Digitization
   - GitHub Actions workflow ready (Monday 9 AM UTC)

2. **News Section** — Currently empty placeholder
   - Structure ready; awaiting content

### 🟢 COMPLETE
- ✅ All HTML/CSS/JS built and tested
- ✅ All images optimized and integrated
- ✅ Git repository initialized with full history
- ✅ Responsive design implemented
- ✅ All sections populated (except News, Funding Radar data)

---

## Technical Notes

### Local Server
```bash
cd /swift_workspace/Dropbox/tbarros-research
python3 -m http.server 8000
```
Access: http://localhost:8000

### Git Workflow
```bash
cd /swift_workspace/Dropbox/tbarros-research
git add -A
git commit -m "Description"
git push -u origin main  # Once repo exists on GitHub
```

### SSH Key
- Location: `~/.ssh/github_key`
- Config: `~/.ssh/config` (already configured for github.com)
- Status: ✅ Accessible from container

---

## Contact & Resources

**User:** Tiago Barros, PhD  
**Email:** tiagobarros@isr.uc.pt  
**Institution:** Institute of Systems and Robotics (ISR), University of Coimbra (UC), Portugal  
**Live Website:** https://www.tiagobarros-research.com/  
**Research Focus:** 3D LiDAR perception, machine learning, robotics, precision agriculture  

---

## Last Updated
**Date:** March 1, 2026, 03:29 UTC  
**Status:** Awaiting GitHub repository creation and push
