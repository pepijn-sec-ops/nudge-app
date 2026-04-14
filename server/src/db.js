import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { normalizeRole } from './roles.js';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'db.json');

const usePg = Boolean(process.env.DATABASE_URL?.trim());

let pool = null;
if (usePg) {
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized },
    max: 10,
  });
  pool.on('error', (err) => {
    console.error('PostgreSQL pool error', err);
  });
}

const defaultDb = () => ({
  users: [],
  tasks: [],
  sessions: [],
  notes: [],
  moods: [],
  globalConfig: {
    globalXpMultiplier: 1,
    systemNudge: { message: '', updatedAt: null },
    registrationMode: 'open',
    inviteCodes: [],
  },
});

function normalizeDb(db) {
  if (!db.globalConfig || typeof db.globalConfig !== 'object') {
    db.globalConfig = defaultDb().globalConfig;
  }
  const mult = Number(db.globalConfig.globalXpMultiplier);
  db.globalConfig.globalXpMultiplier =
    Number.isFinite(mult) && mult > 0 ? Math.min(5, Math.max(0.25, mult)) : 1;
  if (!db.globalConfig.systemNudge || typeof db.globalConfig.systemNudge !== 'object') {
    db.globalConfig.systemNudge = { message: '', updatedAt: null };
  }
  db.globalConfig.systemNudge.message = String(db.globalConfig.systemNudge.message || '').slice(0, 500);
  const uAt = db.globalConfig.systemNudge.updatedAt;
  db.globalConfig.systemNudge.updatedAt =
    uAt == null || typeof uAt === 'string' ? uAt : null;
  const rm = db.globalConfig.registrationMode;
  db.globalConfig.registrationMode = ['open', 'invite', 'closed'].includes(rm) ? rm : 'open';
  if (!Array.isArray(db.globalConfig.inviteCodes)) db.globalConfig.inviteCodes = [];
  db.globalConfig.inviteCodes = db.globalConfig.inviteCodes
    .filter((x) => x && typeof x === 'object' && String(x.code || '').trim())
    .map((x, i) => ({
      id: String(x.id || '').trim() || `ic_${i}_${Math.random().toString(36).slice(2, 11)}`,
      code: String(x.code || '').trim().slice(0, 32).toUpperCase(),
      note: String(x.note || '').slice(0, 120),
      maxUses: x.maxUses == null ? null : Math.min(10000, Math.max(1, Math.round(Number(x.maxUses)))),
      uses: Math.max(0, Math.round(Number(x.uses) || 0)),
      createdAt: typeof x.createdAt === 'string' ? x.createdAt : new Date().toISOString(),
      active: x.active !== false,
    }));

  if (Array.isArray(db.users)) {
    for (const u of db.users) {
      u.role = normalizeRole(u.role);
    }
  }
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.tasks)) db.tasks = [];
  if (!Array.isArray(db.sessions)) db.sessions = [];
  if (!Array.isArray(db.notes)) db.notes = [];
  if (!Array.isArray(db.moods)) db.moods = [];
}

async function ensurePgTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id int PRIMARY KEY CHECK (id = 1),
      data jsonb NOT NULL,
      updated_at timestamptz DEFAULT now()
    );
  `);
}

async function ensureFile() {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  try {
    await readFile(DATA_PATH, 'utf-8');
  } catch {
    await writeFile(DATA_PATH, JSON.stringify(defaultDb(), null, 2), 'utf-8');
  }
}

let fileCache = null;
let writeChain = Promise.resolve();

export async function readDb() {
  if (usePg) {
    const client = await pool.connect();
    try {
      await ensurePgTable(client);
      const { rows } = await client.query('SELECT data FROM app_state WHERE id = 1');
      if (!rows[0]) {
        const fresh = defaultDb();
        normalizeDb(fresh);
        await client.query(
          'INSERT INTO app_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING',
          [JSON.stringify(fresh)],
        );
        const { rows: r2 } = await client.query('SELECT data FROM app_state WHERE id = 1');
        const raw2 = r2[0].data;
        const parsed2 = typeof raw2 === 'string' ? JSON.parse(raw2) : structuredClone(raw2);
        normalizeDb(parsed2);
        return structuredClone(parsed2);
      }
      const raw = rows[0].data;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
      normalizeDb(parsed);
      return structuredClone(parsed);
    } finally {
      client.release();
    }
  }

  await ensureFile();
  if (fileCache) return structuredClone(fileCache);
  const raw = await readFile(DATA_PATH, 'utf-8');
  fileCache = JSON.parse(raw);
  normalizeDb(fileCache);
  return structuredClone(fileCache);
}

export function getDbSync() {
  if (usePg) throw new Error('getDbSync is not supported with PostgreSQL');
  if (!fileCache) throw new Error('DB not loaded');
  return fileCache;
}

export async function writeDb(mutator) {
  if (usePg) {
    writeChain = writeChain.then(async () => {
      const client = await pool.connect();
      try {
        await ensurePgTable(client);
        await client.query('BEGIN');
        let { rows } = await client.query('SELECT data FROM app_state WHERE id = 1 FOR UPDATE');
        if (!rows[0]) {
          const seed = defaultDb();
          normalizeDb(seed);
          await client.query(
            'INSERT INTO app_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING',
            [JSON.stringify(seed)],
          );
          const again = await client.query('SELECT data FROM app_state WHERE id = 1 FOR UPDATE');
          rows = again.rows;
        }
        if (!rows[0]) {
          await client.query('ROLLBACK');
          throw new Error('Could not initialize app_state');
        }
        const raw = rows[0].data;
        let parsed = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
        normalizeDb(parsed);
        await Promise.resolve(mutator(parsed));
        normalizeDb(parsed);
        await client.query('UPDATE app_state SET data = $1::jsonb, updated_at = now() WHERE id = 1', [
          JSON.stringify(parsed),
        ]);
        await client.query('COMMIT');
      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
        throw e;
      } finally {
        client.release();
      }
    });
    return writeChain;
  }

  writeChain = writeChain.then(async () => {
    await ensureFile();
    const db = await readDb();
    fileCache = db;
    await Promise.resolve(mutator(fileCache));
    normalizeDb(fileCache);
    await writeFile(DATA_PATH, JSON.stringify(fileCache, null, 2), 'utf-8');
    fileCache = structuredClone(fileCache);
  });
  return writeChain;
}

export function invalidateCache() {
  fileCache = null;
}

export async function closeDb() {
  if (pool) await pool.end();
}

export function isUsingPostgres() {
  return usePg;
}
