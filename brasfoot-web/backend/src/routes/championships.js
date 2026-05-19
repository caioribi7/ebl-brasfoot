const express = require('express');
const router = express.Router();
const { prepare } = require('../db-wrapper');
const { v4: uuidv4 } = require('uuid');

const ROUND_NAMES = {
  2: ['Final'],
  4: ['Semifinal', 'Final'],
  8: ['Quartas de Final', 'Semifinal', 'Final'],
  16: ['Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'],
  32: ['1\u00aa Fase', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'],
};

router.get('/', (req, res) => {
  const championships = prepare('SELECT * FROM championships ORDER BY created_at DESC').all();
  res.json(championships);
});

router.get('/:id', (req, res) => {
  const championship = prepare('SELECT * FROM championships WHERE id = ?').get(req.params.id);
  if (!championship) return res.status(404).json({ error: 'Campeonato n\u00e3o encontrado' });
  res.json(championship);
});

router.get('/:id/standings', (req, res) => {
  const championship = prepare('SELECT * FROM championships WHERE id = ?').get(req.params.id);
  if (!championship) return res.status(404).json({ error: 'Campeonato n\u00e3o encontrado' });

  if (championship.type === 'cup') {
    const teams = prepare(`
      SELECT ct.*, t.name as team_name, t.short_name
      FROM championship_teams ct
      JOIN teams t ON ct.team_id = t.id
      WHERE ct.championship_id = ?
      ORDER BY t.name
    `).all(req.params.id);
    return res.json(teams);
  }

  const standings = prepare(`
    SELECT ct.*, t.name as team_name, t.short_name
    FROM championship_teams ct
    JOIN teams t ON ct.team_id = t.id
    WHERE ct.championship_id = ?
    ORDER BY ct.points DESC, ct.wins DESC, (ct.goals_for - ct.goals_against) DESC
  `).all(req.params.id);
  res.json(standings);
});

router.get('/:id/matches', (req, res) => {
  const matches = prepare(`
    SELECT m.*, 
      ht.name as home_team_name, ht.short_name as home_short_name,
      at.name as away_team_name, at.short_name as away_short_name
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.championship_id = ?
    ORDER BY m.round, m.id
  `).all(req.params.id);
  res.json(matches);
});

router.get('/:id/bracket', (req, res) => {
  const championship = prepare('SELECT * FROM championships WHERE id = ?').get(req.params.id);
  if (!championship) return res.status(404).json({ error: 'Campeonato n\u00e3o encontrado' });

  const matches = prepare(`
    SELECT m.*, 
      ht.name as home_team_name, ht.short_name as home_short_name,
      at.name as away_team_name, at.short_name as away_short_name
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.championship_id = ?
    ORDER BY m.round, m.id
  `).all(req.params.id);

  const config = JSON.parse(championship.config || '{}');
  const numTeams = config.numTeams || 4;
  const roundNames = ROUND_NAMES[numTeams] || [`Rodada ${championship.current_round}`];

  const bracket = {};
  for (const match of matches) {
    const name = match.round_name || roundNames[match.round - 1] || `Rodada ${match.round}`;
    if (!bracket[match.round]) {
      bracket[match.round] = { round: match.round, name, matches: [] };
    }
    bracket[match.round].matches.push(match);
  }

  res.json({ rounds: Object.values(bracket).sort((a, b) => a.round - b.round), roundNames });
});

router.post('/', (req, res) => {
  const { name, type, teams, config } = req.body;
  const id = uuidv4();

  prepare('INSERT INTO championships (id, name, type, config) VALUES (?, ?, ?, ?)').run(id, name, type || 'league', JSON.stringify(config || {}));

  if (!teams || teams.length === 0) {
    return res.status(201).json({ id, name });
  }

  const insertTeam = prepare('INSERT INTO championship_teams (championship_id, team_id) VALUES (?, ?)');
  for (const teamId of teams) {
    insertTeam.run(id, teamId);
  }

  if (type === 'cup') {
    const numTeams = config?.numTeams || teams.length;
    const roundNames = ROUND_NAMES[numTeams] || ['Final'];
    const totalRounds = roundNames.length;
    const rounds = generateKnockoutRounds(teams, numTeams, roundNames);

    const insertMatch = prepare(`
      INSERT INTO matches (id, championship_id, round, round_name, home_team_id, away_team_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);

    rounds.forEach((matchArr, roundIndex) => {
      matchArr.forEach(match => {
        insertMatch.run(uuidv4(), id, roundIndex + 1, match.roundName, match.home, match.away);
      });
    });

    prepare('UPDATE championships SET total_rounds = ?, current_round = 1 WHERE id = ?').run(totalRounds, id);
  } else {
    const rounds = generateLeagueRounds(teams);
    const insertMatch = prepare(`
      INSERT INTO matches (id, championship_id, round, home_team_id, away_team_id, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);

    rounds.forEach((round, roundIndex) => {
      round.forEach(match => {
        insertMatch.run(uuidv4(), id, roundIndex + 1, match.home, match.away);
      });
    });

    prepare('UPDATE championships SET total_rounds = ?, current_round = 1 WHERE id = ?').run(rounds.length, id);
  }

  res.status(201).json({ id, name });
});

router.post('/:id/simulate-round', (req, res) => {
  const championship = prepare('SELECT * FROM championships WHERE id = ?').get(req.params.id);
  if (!championship) return res.status(404).json({ error: 'Campeonato n\u00e3o encontrado' });

  const matches = prepare('SELECT * FROM matches WHERE championship_id = ? AND round = ? AND status = ?')
    .all(req.params.id, championship.current_round, 'pending');

  if (matches.length === 0) {
    return res.status(400).json({ error: 'Nenhuma partida pendente nesta rodada' });
  }

  const { simulateMatch } = require('../services/matchEngine');
  const results = [];
  const config = JSON.parse(championship.config || '{}');

  // simulateMatch already updates match scores + league standings in DB
  for (const match of matches) {
    const result = simulateMatch(match.id);
    results.push({ matchId: match.id, homeScore: result.homeScore, awayScore: result.awayScore, events: result.events });
  }

  if (championship.type === 'cup') {
    const winnerIds = [];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const r = results[i];
      let winnerId;
      if (r.homeScore !== r.awayScore) {
        winnerId = r.homeScore > r.awayScore ? m.home_team_id : m.away_team_id;
      } else {
        winnerId = Math.random() < 0.5 ? m.home_team_id : m.away_team_id;
        if (winnerId === m.home_team_id) {
          r.homeScore += 1;
          r.events.push({ type: 'penalty_goal', team: 'home', minute: 120, narration: 'Nos p\u00eanaltis, o time da casa vence!' });
        } else {
          r.awayScore += 1;
          r.events.push({ type: 'penalty_goal', team: 'away', minute: 120, narration: 'Nos p\u00eanaltis, o time visitante vence!' });
        }
        prepare('UPDATE matches SET home_score = ?, away_score = ?, winner_team_id = ?, events = ? WHERE id = ?')
          .run(r.homeScore, r.awayScore, winnerId, JSON.stringify(r.events), m.id);
      }
      prepare('UPDATE matches SET winner_team_id = ? WHERE id = ?').run(winnerId, m.id);
      winnerIds.push(winnerId);
    }

    if (winnerIds.length === 1) {
      prepare('UPDATE championships SET status = ? WHERE id = ?').run('finished', req.params.id);
    } else {
      const nextRound = championship.current_round + 1;
      const numTeams = config.numTeams || winnerIds.length * 2;
      const roundNames = ROUND_NAMES[numTeams] || ['Final'];
      const nextRoundName = roundNames[nextRound - 1] || 'Rodada ' + nextRound;

      const insertMatch = prepare(`
        INSERT INTO matches (id, championship_id, round, round_name, home_team_id, away_team_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);

      for (let i = 0; i < winnerIds.length; i += 2) {
        if (i + 1 < winnerIds.length) {
          insertMatch.run(uuidv4(), req.params.id, nextRound, nextRoundName, winnerIds[i], winnerIds[i + 1]);
        }
      }

      prepare('UPDATE championships SET current_round = ? WHERE id = ?').run(nextRound, req.params.id);
    }

    return res.json({ round: championship.current_round, results });
  }

  // League: standings already updated by simulateMatch, just advance round
  const nextRound = championship.current_round + 1;
  if (nextRound > championship.total_rounds) {
    prepare('UPDATE championships SET status = ? WHERE id = ?').run('finished', req.params.id);
  } else {
    prepare('UPDATE championships SET current_round = ? WHERE id = ?').run(nextRound, req.params.id);
  }

  res.json({ round: championship.current_round, results });
});

router.get('/:id/live-round', (req, res) => {
  const championship = prepare('SELECT * FROM championships WHERE id = ?').get(req.params.id);
  if (!championship) return res.status(404).json({ error: 'Campeonato não encontrado' });

  const matches = prepare(`
    SELECT m.*, 
      ht.name as home_team_name, ht.short_name as home_short_name,
      at.name as away_team_name, at.short_name as away_short_name
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.championship_id = ? AND m.round = ? AND (m.status = 'pending' OR m.status = 'live')
    ORDER BY m.id
  `).all(req.params.id, championship.current_round);

  if (matches.length === 0) {
    return res.status(400).json({ error: 'Nenhuma partida pendente ou ao vivo nesta rodada' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ type: 'round_init', round: championship.current_round, totalRounds: championship.total_rounds, matchCount: matches.length })}\n\n`);

  const { simulateMatchLiveNoPause } = require('../services/matchEngine');
  const activeTimers = [];
  let finishedCount = 0;

  for (const match of matches) {
    res.write(`data: ${JSON.stringify({ type: 'match_init', matchId: match.id, homeTeam: match.home_team_name, awayTeam: match.away_team_name })}\n\n`);
    const timer = simulateMatchLiveNoPause(match.id, (event) => {
      const tagged = { ...event, matchId: match.id, homeTeam: match.home_team_name, awayTeam: match.away_team_name };
      res.write(`data: ${JSON.stringify(tagged)}\n\n`);
      if (event.finished) {
        finishedCount++;
        if (finishedCount >= matches.length) {
          res.end();
        }
      }
    });
    if (timer) activeTimers.push(timer);
  }

  req.on('close', () => {
    for (const t of activeTimers) if (t) clearInterval(t);
  });
});

router.get('/:id/top-scorers', (req, res) => {
  const stats = prepare(`
    SELECT mps.player_id, p.name as player_name, p.team_id, t.name as team_name,
      SUM(mps.goals) as total_goals, SUM(mps.assists) as total_assists,
      SUM(mps.yellow_cards) as total_yellow, SUM(mps.red_cards) as total_red,
      ROUND(AVG(mps.rating), 1) as avg_rating
    FROM match_player_stats mps
    JOIN players p ON mps.player_id = p.id
    JOIN teams t ON p.team_id = t.id
    WHERE mps.championship_id = ?
    GROUP BY mps.player_id
    ORDER BY total_goals DESC, avg_rating DESC
    LIMIT 20
  `).all(req.params.id);
  res.json(stats);
});

router.get('/:id/top-ratings', (req, res) => {
  const stats = prepare(`
    SELECT mps.player_id, p.name as player_name, p.team_id, t.name as team_name,
      SUM(mps.goals) as total_goals, SUM(mps.assists) as total_assists,
      ROUND(AVG(mps.rating), 1) as avg_rating,
      COUNT(mps.id) as matches_played
    FROM match_player_stats mps
    JOIN players p ON mps.player_id = p.id
    JOIN teams t ON p.team_id = t.id
    WHERE mps.championship_id = ?
    GROUP BY mps.player_id
    HAVING matches_played > 0
    ORDER BY avg_rating DESC, total_goals DESC
    LIMIT 20
  `).all(req.params.id);
  res.json(stats);
});

function generateLeagueRounds(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null);

  const n = teams.length;
  const rounds = [];
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;

  for (let round = 0; round < totalRounds; round++) {
    const matches = [];
    for (let match = 0; match < matchesPerRound; match++) {
      const home = teams[match];
      const away = teams[n - 1 - match];
      if (home && away) {
        matches.push({ home, away });
      }
    }
    rounds.push(matches);
    teams.splice(1, 0, teams.pop());
  }

  return rounds;
}

function generateKnockoutRounds(teamIds, numTeams, roundNames) {
  // Sort teams by overall strength for seeding
  const teamData = teamIds.map(id => {
    const team = prepare('SELECT * FROM teams WHERE id = ?').get(id);
    return { id, strength: team?.overall_strength || 50 };
  });
  teamData.sort((a, b) => b.strength - a.strength);

  // Build bracket seeding positions
  const seeds = buildSeeding(teamData.slice(0, numTeams));
  const firstRoundMatches = [];

  for (let i = 0; i < seeds.length; i += 2) {
    if (i + 1 < seeds.length) {
      firstRoundMatches.push({
        home: seeds[i].id,
        away: seeds[i + 1].id,
        roundName: roundNames[0] || '',
      });
    }
  }

  return [firstRoundMatches];
}

function buildSeeding(teams) {
  // Standard tournament seeding: place best teams at bracket edges
  const n = teams.length;
  const seeds = new Array(n);
  let left = 0;
  let right = n - 1;
  let i = 0;
  while (left <= right) {
    if (i < teams.length) seeds[left++] = teams[i++];
    if (i < teams.length) seeds[right--] = teams[i++];
  }
  return seeds;
}

module.exports = router;
