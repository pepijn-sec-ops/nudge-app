/**
 * One-time migration: copy server/data/db.json into PostgreSQL app_state.
 * Usage (from repo root or server folder):
 *   DATABASE_URL="postgresql://..." node server/scripts/import-json-to-pg.mjs
 */
import 'dotenv/config';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, '..', 'data', 'db.json');

const pool = new Pool({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

const raw = await readFile(jsonPath, 'utf-8');
const data = JSON.parse(raw);

await pool.query(`
  CREATE TABLE IF NOT EXISTS app_state (
    id int PRIMARY KEY CHECK (id = 1),
    data jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
  );
`);

await pool.query(
  `INSERT INTO app_state (id, data) VALUES (1, $1::jsonb)
   ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
  [JSON.stringify(data)],
);

console.log('Imported', jsonPath, 'into app_state.');
await pool.end();
