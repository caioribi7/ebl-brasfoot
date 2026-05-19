const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'brasfoot.db');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();

  let buffer;
  try {
    buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } catch {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      short_name TEXT,
      logo TEXT,
      overall_strength INTEGER DEFAULT 50,
      attack_strength INTEGER DEFAULT 50,
      midfield_strength INTEGER DEFAULT 50,
      defense_strength INTEGER DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      position_name TEXT,
      overall INTEGER DEFAULT 50,
      pace INTEGER DEFAULT 50,
      shooting INTEGER DEFAULT 50,
      passing INTEGER DEFAULT 50,
      dribbling INTEGER DEFAULT 50,
      defending INTEGER DEFAULT 50,
      physical INTEGER DEFAULT 50,
      stamina INTEGER DEFAULT 50,
      age INTEGER DEFAULT 25,
      country INTEGER DEFAULT 0,
      side INTEGER DEFAULT 0,
      is_starter BOOLEAN DEFAULT 0,
      is_captain BOOLEAN DEFAULT 0,
      is_star BOOLEAN DEFAULT 0,
      is_top_world BOOLEAN DEFAULT 0,
      char_primary TEXT,
      char_secondary TEXT,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tactics (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL UNIQUE,
      formation TEXT DEFAULT '4-4-2',
      mentality TEXT DEFAULT 'balanced',
      pressing INTEGER DEFAULT 50,
      width INTEGER DEFAULT 50,
      depth INTEGER DEFAULT 50,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS championships (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'league',
      status TEXT DEFAULT 'pending',
      current_round INTEGER DEFAULT 0,
      total_rounds INTEGER DEFAULT 0,
      config TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate existing rows: add config column if missing
  try { db.run('ALTER TABLE championships ADD COLUMN config TEXT DEFAULT \'{}\''); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS championship_teams (
      championship_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      goals_for INTEGER DEFAULT 0,
      goals_against INTEGER DEFAULT 0,
      PRIMARY KEY (championship_id, team_id),
      FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      championship_id TEXT,
      round INTEGER DEFAULT 0,
      round_name TEXT DEFAULT '',
      home_team_id TEXT NOT NULL,
      away_team_id TEXT NOT NULL,
      home_score INTEGER DEFAULT 0,
      away_score INTEGER DEFAULT 0,
      winner_team_id TEXT,
      status TEXT DEFAULT 'pending',
      match_state TEXT DEFAULT 'pending',
      current_minute INTEGER DEFAULT 0,
      events TEXT DEFAULT '[]',
      started_at DATETIME,
      finished_at DATETIME,
      FOREIGN KEY (championship_id) REFERENCES championships(id),
      FOREIGN KEY (home_team_id) REFERENCES teams(id),
      FOREIGN KEY (away_team_id) REFERENCES teams(id)
    )
  `);

  try { db.run('ALTER TABLE matches ADD COLUMN round_name TEXT DEFAULT \'\''); } catch (e) {}
  try { db.run('ALTER TABLE matches ADD COLUMN winner_team_id TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE matches ADD COLUMN match_state TEXT DEFAULT \'pending\''); } catch (e) {}
  try { db.run('ALTER TABLE matches ADD COLUMN current_minute INTEGER DEFAULT 0'); } catch (e) {}
  try { db.run('ALTER TABLE matches ADD COLUMN stats TEXT DEFAULT \'{}\''); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS match_player_stats (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      championship_id TEXT,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      yellow_cards INTEGER DEFAULT 0,
      red_cards INTEGER DEFAULT 0,
      rating REAL DEFAULT 6.0,
      FOREIGN KEY (match_id) REFERENCES matches(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);

  saveDatabase();
  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

module.exports = { initDatabase, getDb, saveDatabase };
