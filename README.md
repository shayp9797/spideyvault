# SpideyVault Live — 278 catalogue entries

A private installable Spider-Person Funko tracker with:

- Local Owned / Incoming / Need status tracking
- Purchase price, manual value and personal notes
- Funko release-candidate monitoring with approve/ignore review queue
- Official eBay Browse API active-listing estimates
- PWA/offline catalogue support
- Backup export/import

## Important limitations

1. eBay data is **active asking-price data**, not confirmed sold prices.
2. Funko does not provide a public catalogue API for this use. The monitor reads public Funko search HTML, so it may need maintenance if Funko changes its site.
3. Credentials are not included. You must create your own free eBay Developer and Supabase accounts.
4. Approved Funko candidates are marked approved in the review queue; they are not automatically appended to the bundled catalogue JSON. This prevents an incorrect match from silently changing your master list. Send an approved candidate list to update the master catalogue.

## Deploy from GitHub to Vercel

1. Upload every file in this folder to a GitHub repository.
2. Create a free Supabase project.
3. In Supabase → SQL Editor, run `supabase-schema.sql`.
4. In Supabase → Connect/API Keys, copy the project URL and **secret key**.
5. Join the free eBay Developers Program and create Production application keys.
6. Import the GitHub repository into Vercel.
7. In Vercel → Project → Settings → Environment Variables, add every variable from `.env.example`.
8. Deploy again after adding the variables.
9. Open `/api/cron/funko-scan` once with an Authorization header `Bearer YOUR_CRON_SECRET`, or wait for the daily cron.
10. On iPhone Safari: Share → Add to Home Screen.

## Environment variables

- `EBAY_CLIENT_ID`: eBay Production App ID
- `EBAY_CLIENT_SECRET`: eBay Production Cert ID
- `EBAY_MARKETPLACE_ID`: defaults to `EBAY_US`
- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_SECRET_KEY`: server-side secret key; never expose this in browser code
- `CRON_SECRET`: random secret used to protect the scanner endpoint

## Updating through ChatGPT

Export a backup from Settings before major changes. Upload this entire ZIP plus your requested changes. Collection statuses remain in your browser unless you clear site data or move devices; use Export/Import to transfer them.


## Catalogue loading fix
This build includes both `data/catalogue.json` and an embedded `data/catalogue.js` fallback. Upload the contents of this folder to the repository root, not the containing folder.
