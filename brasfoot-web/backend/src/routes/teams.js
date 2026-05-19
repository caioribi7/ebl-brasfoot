const express = require('express');
const router = express.Router();
const { prepare } = require('../db-wrapper');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const search = req.query.search || '';
  let teams;
  if (search) {
    teams = prepare('SELECT * FROM teams WHERE name LIKE ? ORDER BY name').all(`%${search}%`);
  } else {
    teams = prepare('SELECT * FROM teams ORDER BY name').all();
  }
  res.json(teams);
});

router.get('/count', (req, res) => {
  const result = prepare('SELECT COUNT(*) as count FROM teams').get();
  res.json(result);
});

router.get('/:id', (req, res) => {
  const team = prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Time não encontrado' });
  res.json(team);
});

router.get('/:id/players', (req, res) => {
  const players = prepare('SELECT * FROM players WHERE team_id = ? ORDER BY is_starter DESC, overall DESC').all(req.params.id);
  res.json(players.map(p => ({
    ...p,
    characteristics: {
      primary: p.char_primary || '',
      secondary: p.char_secondary || '',
    },
  })));
});

router.get('/:id/tactics', (req, res) => {
  const tactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(req.params.id);
  if (!tactics) return res.status(404).json({ error: 'Táticas não encontradas' });
  res.json(tactics);
});

router.put('/:id/tactics', (req, res) => {
  const { formation, mentality, pressing, width, depth } = req.body;
  const existing = prepare('SELECT * FROM tactics WHERE team_id = ?').get(req.params.id);

  if (existing) {
    prepare('UPDATE tactics SET formation = ?, mentality = ?, pressing = ?, width = ?, depth = ? WHERE team_id = ?')
      .run(formation, mentality, pressing, width, depth, req.params.id);
  } else {
    prepare('INSERT INTO tactics (id, team_id, formation, mentality, pressing, width, depth) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), req.params.id, formation, mentality, pressing, width, depth);
  }

  res.json({ success: true });
});

router.put('/:id/players/:playerId', (req, res) => {
  const player = prepare('SELECT * FROM players WHERE id = ? AND team_id = ?').get(req.params.playerId, req.params.id);
  if (!player) return res.status(404).json({ error: 'Jogador não encontrado' });

  const { overall, pace, shooting, passing, dribbling, defending, physical, stamina, is_starter, is_captain, is_star, is_top_world } = req.body;

  prepare(`
    UPDATE players SET 
      overall = ?, pace = ?, shooting = ?, passing = ?, dribbling = ?,
      defending = ?, physical = ?, stamina = ?, is_starter = ?, is_captain = ?,
      is_star = ?, is_top_world = ?
    WHERE id = ? AND team_id = ?
  `).run(
    overall ?? player.overall,
    pace ?? player.pace,
    shooting ?? player.shooting,
    passing ?? player.passing,
    dribbling ?? player.dribbling,
    defending ?? player.defending,
    physical ?? player.physical,
    stamina ?? player.stamina,
    is_starter ?? player.is_starter,
    is_captain ?? player.is_captain,
    is_star ?? player.is_star,
    is_top_world ?? player.is_top_world,
    req.params.playerId,
    req.params.id
  );

  res.json({ success: true });
});

router.post('/', (req, res) => {
  const { name, short_name, players } = req.body;
  const id = uuidv4();

  prepare('INSERT INTO teams (id, name, short_name) VALUES (?, ?, ?)').run(id, name, short_name);
  prepare('INSERT INTO tactics (id, team_id) VALUES (?, ?)').run(uuidv4(), id);

  if (players) {
    const insertPlayer = prepare('INSERT INTO players (id, team_id, name, position, overall) VALUES (?, ?, ?, ?, ?)');
    for (const player of players) {
      insertPlayer.run(uuidv4(), id, player.name, player.position, player.overall || 50);
    }
  }

  res.status(201).json({ id, name });
});

module.exports = router;
