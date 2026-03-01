# Tiago Barros - Research Profile

Personal research website featuring my work in 3D perception, robotics, machine learning, and precision agriculture.

## Features

- **Single-page research portfolio** with bio, publications, projects
- **Integrated Funding Radar** - Auto-updating R&D opportunities (Mondays 9 AM UTC)
- **Beautiful design** - Clean, responsive, academic-focused
- **GitHub Pages** - Hosted at `tiagobarros-research.com`
- **Auto-updates** - Funding radar refreshes automatically

## Structure

```
tbarros-research/
├── index.html                 (Main research profile page)
├── assets/
│   ├── css/
│   │   ├── main.css          (Site styling)
│   │   └── funding-radar.css (Radar styling)
│   ├── js/
│   │   ├── main.js           (Navigation, interactions)
│   │   └── radar-loader.js   (Load radar data)
│   └── images/               (Photos, logos)
├── funding-radar/
│   ├── index.html            (Radar dashboard)
│   ├── style.css
│   ├── script.js
│   ├── calls.json            (Auto-generated)
│   └── news.json             (Auto-generated)
├── .github/workflows/
│   └── update-radar.yml      (Auto-update Mondays)
└── README.md
```

## Content

### Main Page Sections
- **Bio** - Research interests and background
- **Research Focus** - Key areas: 3D LiDAR, SLAM, place recognition, precision agriculture
- **Funding Opportunities** - Embedded funding radar
- **Recent Publications** - Latest papers and preprints
- **Active Projects** - Current research projects
- **Talks & Outreach** - Seminars and workshops
- **Collaborations** - International partners
- **Contact** - Email, links to CV, ORCID, Scholar

## Development

Local testing:
```bash
# Just open index.html in browser
open index.html

# Or use Python server
python3 -m http.server 8000
# Visit http://localhost:8000
```

## Deployment

- GitHub Pages automatically deploys from `main` branch
- Custom domain `tiagobarros-research.com` points to GitHub Pages
- Funding radar updates every Monday 9 AM UTC via GitHub Actions

## License

Personal research portfolio - © 2026 Tiago Barros

---

Built with OpenClaw automation
