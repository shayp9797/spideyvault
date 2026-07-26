# SpideyVault V1.1

A mobile-first, installable PWA for a personal Spider-Man Funko collection.

## Catalogue
- 278 entries imported from `spider_man_funko_pop_master_checklist_core_formats.xlsx`
- Stable record IDs derived from catalogue fields
- Core formats only, matching the master checklist scope
- Catalogue records stay separate from personal collection data

## Included
- Dashboard and completion stats
- Search by name, character, number, line, variant or exclusive
- Status and product-type filters
- Sorting by name, Pop number, estimated value or recent update
- Pop detail editor
- Need / Owned / Incoming tracking
- Purchase price and personal notes
- LocalStorage persistence
- JSON export/import backup with replacement confirmation
- Offline service worker and installable manifest
- No accounts, cloud sync, eBay integration or monitoring

## Run locally
```bash
npm run start
```
Open http://localhost:4173.

## Deploy
Upload the contents of this folder to GitHub Pages, Netlify, Vercel or Cloudflare Pages. It is a static site with no build step.

## Data architecture
`catalogue.js` contains immutable catalogue records. Personal fields are stored separately in LocalStorage under `spideyvault-v1`, so future catalogue updates do not overwrite statuses, purchase prices or notes.
