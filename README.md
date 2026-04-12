# Nudge

ADHD-friendly focus app: timers, tasks, stats, and gentle UX.

## Quick start (local)

1. **Server**
   - `cd server`
   - Copy `server/.env.example` to `server/.env` and adjust if needed.
   - `npm install`
   - `npm run dev` (API on port 4000 by default)

2. **Client**
   - `cd client`
   - `npm install`
   - `npm run dev` (Vite proxies `/api` to the server)

3. Open `http://localhost:5173`. The first registered user becomes **admin** (or match `ADMIN_EMAIL` in `.env`).

## Admin panel

- URL: **`/admin`** (also an **Admin** link in the header when your role is admin).
- Access uses **`role === 'admin'`** everywhere (normalized from the database).

## Database

- **Default (no env):** `server/data/db.json`
- **Production:** set `DATABASE_URL` (PostgreSQL, e.g. Supabase). See `DEPLOYMENT.md`.
- **Migrate JSON → Postgres:** `cd server && npm run import-json` (requires `DATABASE_URL`).

## Mobile APK

See **`MOBILE.md`** (Capacitor + `VITE_API_BASE_URL`).

## Deploy

See **`DEPLOYMENT.md`**.
