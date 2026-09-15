# Cancer Support Network Foundation website

A modern Node.js/Express website and lightweight CMS for Cancer Support Network Foundation (CSNF), Ghana.

## Features
- Modern responsive public website
- News, events, survivor stories and programs
- Team and donation/contact information
- Protected admin dashboard
- Create/edit/publish/delete content without editing code
- Editable homepage/contact/donation settings
- SQLite-backed content with automatic first-run seed data
- Railway-ready health endpoint (`/health`)

## Local setup
```bash
cp .env.example .env
npm install
npm start
```
Open `http://localhost:3000` and `/admin/login`.

## Production variables
Set `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in Railway. For durable CMS data on Railway, attach a persistent volume and set `DB_PATH` to a path on that volume (for example `/data/csnf.sqlite`).

## Content note
Seed copy was composed from CSNF's public website, public LinkedIn profile, and publicly reported activities. Review and replace image URLs and any placeholder biography copy before final organizational sign-off.
