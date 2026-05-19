const express = require('express');
const router = express.Router();
const { prepare } = require('../db-wrapper');
const { v4: uuidv4 } = require('uuid');
const { simulateMatch, simulateMatchLive, resumeMatchFromHalftime, setPenaltyKicker, getMatchSimulation } = require('../services/matchEngine');

router.get('/', (req, res) => {
  const matches = prepare(`
    SELECT m.*, 
      ht.name as home_team_name, ht.short_name as home_short_name,
      at.name as away_team_name, at.short_name as away_short_name
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    ORDER BY m.started_at DESC
  `).all();
  res.json(matches);
});

router.get('/:id', (req, res) => {
  const match = prepare(`
    SELECT m.*, 
      ht.name as home_team_name, ht.short_name as home_short_name,
      at.name as away_team_name, at.short_name as away_short_name
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  res.json(match);
});

router.get('/:id/events', (req, res) => {
  const match = prepare('SELECT events FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  res.json(JSON.parse(match.events || '[]'));
});

router.get('/:id/stats', (req, res) => {
  const match = prepare('SELECT stats FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  res.json(JSON.parse(match.stats || '{}'));
});

router.get('/:id/player-stats', (req, res) => {
  const match = prepare('SELECT id, championship_id FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  const stats = prepare(`
    SELECT mps.*, p.name as player_name, p.position as player_position
    FROM match_player_stats mps
    JOIN players p ON mps.player_id = p.id
    WHERE mps.match_id = ?
    ORDER BY mps.rating DESC
  `).all(req.params.id);
  res.json(stats);
});

router.post('/', (req, res) => {
  const { home_team_id, away_team_id, championship_id, round } = req.body;
  const id = uuidv4();

  prepare(`
    INSERT INTO matches (id, championship_id, round, home_team_id, away_team_id, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, championship_id || null, round || 0, home_team_id, away_team_id);

  res.status(201).json({ id, home_team_id, away_team_id, status: 'pending' });
});

router.post('/:id/simulate', (req, res) => {
  const match = prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  if (match.status !== 'pending') return res.status(400).json({ error: 'Partida já foi simulada' });

  const result = simulateMatch(req.params.id);
  res.json(result);
});

router.get('/:id/live', (req, res) => {
  const match = prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  if (match.status !== 'pending' && match.status !== 'live') return res.status(400).json({ error: 'Partida já foi finalizada' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event) => {
    try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch (e) {}
  };

  const sim = getMatchSimulation(req.params.id);

  // Halftime reconnection
  if (match.status === 'live' && match.match_state === 'halftime') {
    const events = JSON.parse(match.events || '[]');
    const halftimeHomeScore = sim?.homeScore ?? match.home_score ?? 0;
    const halftimeAwayScore = sim?.awayScore ?? match.away_score ?? 0;
    const injuredPlayers = sim?.getInjuredPlayers ? sim.getInjuredPlayers() : [];
    sendEvent({ type: 'reconnect', homeScore: halftimeHomeScore, awayScore: halftimeAwayScore, events, matchState: 'halftime', paused: true });
    if (sim) sim.updateCallback(sendEvent);
    sendEvent({ type: 'halftime_paused', paused: true, homeScore: halftimeHomeScore, awayScore: halftimeAwayScore, injuredPlayers: injuredPlayers.map(i => ({ playerId: i.playerId, playerName: i.playerName, severity: i.severity })) });
    return;
  }

  // Penalty reconnection
  if (match.status === 'live' && match.match_state === 'penalty') {
    const events = JSON.parse(match.events || '[]');
    const penaltyHomeScore = sim?.homeScore ?? match.home_score ?? 0;
    const penaltyAwayScore = sim?.awayScore ?? match.away_score ?? 0;
    sendEvent({ type: 'reconnect', homeScore: penaltyHomeScore, awayScore: penaltyAwayScore, events, matchState: 'penalty', paused: true, chooseTeam: sim?.penaltyChooseTeam || (match.home_score <= match.away_score ? 'home' : 'away') });
    if (sim) {
      sim.updateCallback(sendEvent);
      sendEvent({
        type: 'penalty_choose',
        chooseTeam: sim.penaltyChooseTeam || (match.home_score <= match.away_score ? 'home' : 'away'),
        homeScore: penaltyHomeScore,
        awayScore: penaltyAwayScore,
        paused: true,
      });
    }
    return;
  }

  if (match.status === 'pending') {
    sendEvent({ type: 'init', matchId: match.id });
    const newSim = simulateMatchLive(req.params.id, (event) => {
      sendEvent(event);
      if (event.finished) res.end();
    }, { duration: parseInt(req.query.duration) || 180 });
    // Match continues running in background even if SSE disconnects
    req.on('close', () => { /* keep running in background */ });
  } else {
    // Reconnecting to an already-running match
    const existingSim = getMatchSimulation(req.params.id);
    if (existingSim) {
      existingSim.updateCallback((event) => {
        sendEvent(event);
        if (event.finished) res.end();
      });
    }
    // Use simulation in-memory state (may be ahead of DB)
    const currentHomeScore = existingSim?.homeScore ?? match.home_score ?? 0;
    const currentAwayScore = existingSim?.awayScore ?? match.away_score ?? 0;
    const currentMatchState = existingSim?.phase === 'first_half' ? 'first_half' : existingSim?.phase === 'second_half' ? 'second_half' : match.match_state;
    sendEvent({ type: 'reconnect', homeScore: currentHomeScore, awayScore: currentAwayScore, events: JSON.parse(match.events || '[]'), matchState: currentMatchState, finished: match.status === 'finished' });
    if (match.status === 'finished') res.end();
  }
});

router.put('/:id/halftime-tactics', (req, res) => {
  const match = prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  if (match.status !== 'live') return res.status(400).json({ error: 'Partida não está ao vivo' });

  const { home_tactics, away_tactics } = req.body;
  if (home_tactics) {
    prepare('UPDATE tactics SET formation = ?, mentality = ?, pressing = ?, width = ?, depth = ? WHERE team_id = ?').run(home_tactics.formation, home_tactics.mentality, home_tactics.pressing, home_tactics.width, home_tactics.depth, match.home_team_id);
  }
  if (away_tactics) {
    prepare('UPDATE tactics SET formation = ?, mentality = ?, pressing = ?, width = ?, depth = ? WHERE team_id = ?').run(away_tactics.formation, away_tactics.mentality, away_tactics.pressing, away_tactics.width, away_tactics.depth, match.away_team_id);
  }
  res.json({ success: true });
});

router.post('/:id/resume', (req, res) => {
  const match = prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
  if (match.match_state !== 'halftime') return res.status(400).json({ error: 'Partida não está no intervalo' });

  const sim = getMatchSimulation(req.params.id);
  if (sim) {
    resumeMatchFromHalftime(req.params.id);
  } else {
    return res.status(400).json({ error: 'Simulação perdida. Reconecte à partida para continuar.' });
  }
  res.json({ success: true, message: 'Segundo tempo iniciado' });
});

router.post('/:id/penalty-kicker', (req, res) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: 'playerId é obrigatório' });

  const success = setPenaltyKicker(req.params.id, playerId);
  if (!success) return res.status(400).json({ error: 'Nenhum pênalti pendente ou partida não encontrada' });
  res.json({ success: true, message: 'Batedor definido' });
});

module.exports = router;
