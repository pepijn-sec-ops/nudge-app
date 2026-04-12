# Deploying Nudge

## Database: JSON file vs PostgreSQL (Supabase recommended)

| Mode | When to use |
|------|----------------|
| **No `DATABASE_URL`** | Data in `server/data/db.json`. Fine for local dev; production needs a **persistent disk** on the host or you lose data on redeploy. |
| **`DATABASE_URL` set** | **PostgreSQL** (e.g. [Supabase](https://supabase.com/) free tier). Same app logic; data lives in table `app_state` (one JSONB row). **No data loss on deploy** when the DB is hosted. |

### Why Supabase (and not Cloudflare D1 here)

- This server is **Node + Express**. **Supabase = managed Postgres** with a normal connection string — drop-in with `pg`.
- **Cloudflare D1** is SQLite tied to **Workers**, not this Express app. You would rewrite the backend. For this codebase, **Postgres + `DATABASE_URL`** is the practical cloud upgrade.

### Enable Postgres

1. Create a Supabase project → **Settings → Database → Connection string** (URI).  
2. On the server host, set:
   - `DATABASE_URL=postgresql://...`
   - Usually keep SSL on (default). For local Postgres without TLS: `DATABASE_SSL=false`.
3. Deploy/restart the API. On first request, Nudge creates the `app_state` table automatically.

### Migrate existing `db.json` into Postgres

From repo root (with `DATABASE_URL` in `server/.env` or exported):

```bash
cd server
npm run import-json
```

This overwrites the remote `app_state` row with your local JSON. Back up first.

Schema reference: `server/migrations/001_app_state.sql`.

---

## Environment variables

See **`server/.env.example`**.

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | **Required in production** (min 32 characters enforced). |
| `CLIENT_ORIGIN` | Comma-separated allowed **browser** origins for CORS. Include your site and, for mobile, `capacitor://localhost` if needed. |
| `DATABASE_URL` | Optional. If set, use PostgreSQL instead of `db.json`. |
| `ADMIN_EMAIL` | Optional. That email becomes admin when they register (if not already first user). |
| `PORT` | Listen port (default 4000). |

---

## Build and run (single host — recommended)

```bash
npm run build
cd server
npm install
npm start
```

`npm run build` builds the Vite client into `client/dist`. Express serves static files and `/api/*` from one process.

`GET /api/health` returns `{ ok, database: "postgres" | "json-file" }` so you can confirm which store is active.

---

## Admin panel and roles

- URL: **`/admin`** (absolute path; works under React Router).
- **Only `role === "admin"`** (after normalization) grants access — same rule on **server** (`requireAdmin`) and **client** (`isUserAdmin()`). There is no separate `isAdmin` flag.
- If you were promoted to admin **after** logging in, do **log out and log in** so the UI refreshes (the server always reads the current role from the database for API authorization).

---

## Registration modes (who can sign up)

Configured in **Admin → Access**. See the table in `README.md` / earlier docs: Open, Invite codes, or Closed.

---

## Mobile / APK

Set **`VITE_API_BASE_URL`** to your public API origin **before** `npm run build`, then follow **`MOBILE.md`**.

---

## Checklist

1. `JWT_SECRET` strong and set.  
2. `CLIENT_ORIGIN` matches every frontend origin (web + Capacitor if applicable).  
3. Either persistent `db.json` **or** `DATABASE_URL` to Postgres.  
4. HTTPS in production.  
5. First admin: first registered user on empty DB, or `ADMIN_EMAIL`, or create user in Admin.
