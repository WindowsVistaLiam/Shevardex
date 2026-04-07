const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'shevardex.db'));

db.exec(`
  -- Joueurs : pulls disponibles + horodatage de la dernière recharge
  CREATE TABLE IF NOT EXISTS players (
    user_id     TEXT PRIMARY KEY,
    pulls       INTEGER NOT NULL DEFAULT 10,
    last_update INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Collection : une ligne par carte obtenue (les doublons ont leur propre ligne)
  CREATE TABLE IF NOT EXISTS collection (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL,
    card_id     TEXT    NOT NULL,
    obtained_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Wishes actifs (un seul par joueur, consommé au prochain /multi)
  CREATE TABLE IF NOT EXISTS wishes (
    user_id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL
  );

  -- Configuration globale du bot (modifiable via /change-tirage)
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO config (key, value) VALUES
    ('pulls_per_hour', '1'),
    ('max_pulls',      '10'),
    ('wish_boost',     '5'),
    ('staff_role_id',  '');
`);

module.exports = db;
