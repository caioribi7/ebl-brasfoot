const { prepare, transaction } = require('../db-wrapper');
const { v4: uuidv4 } = require('uuid');

const matchSimulations = new Map();

const EVENT_TYPES = {
  KICKOFF: 'kickoff', GOAL: 'goal', SHOT_ON_TARGET: 'shot_on_target',
  SHOT_OFF_TARGET: 'shot_off_target', SAVE: 'save', FOUL: 'foul',
  YELLOW_CARD: 'yellow_card', RED_CARD: 'red_card', CORNER: 'corner',
  FREE_KICK: 'free_kick', PENALTY: 'penalty', PENALTY_GOAL: 'penalty_goal',
  PENALTY_MISS: 'penalty_miss', SUBSTITUTION: 'substitution',
  HALF_TIME: 'half_time', FULL_TIME: 'full_time',
  ATTACK: 'attack', COUNTER_ATTACK: 'counter_attack', OFFSIDE: 'offside',
  INJURY: 'injury',
};

function buildNarrations(homeName, awayName) {
  return {
    kickoff: [`${homeName} e ${awayName} em campo! Come\u00e7a o jogo!`, `Apita o \u00e1rbitro, bola rolando! ${homeName} vs ${awayName}!`],
    goal: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`GOOOOOOOOOOOOOOOL do ${name}! ${pn} marca!`, `\u00c9 GOOOOOL! ${pn} (${name}) abre o placar!`, `GOOOL! ${pn} marca para o ${name}!`, `Gol do ${pn}! ${name} explode no est\u00e1dio!`];
    },
    shot_on_target: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Chute forte de ${pn} (${name}), o goleiro espalma!`, `${pn} finaliza com perigo, defesa dif\u00edcil!`, `Finaliza\u00e7\u00e3o de ${pn}, o goleiro vai ao ch\u00e3o!`];
    },
    shot_off_target: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Chute de ${pn} pra fora! Passou raspando a trave.`, `${pn} finaliza sem perigo, vai pro tiro de meta.`, `Chute fraco de ${pn}, f\u00e1cil pro goleiro.`];
    },
    save: (team) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Que defesa\u00e7a! O goleiro do ${name} voou!`, `Goleiro do ${name} aparece bem e evita o gol!`, `Defesa dif\u00edcil do goleiro do ${name}, bola afastada!`];
    },
    foul: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Falta de ${pn} (${name})! Jogo duro.`, `O \u00e1rbitro apita falta contra ${pn} do ${name}.`, `Falta dura de ${pn} (${name}), jogador no ch\u00e3o.`];
    },
    yellow_card: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`CART\u00c3O AMARELO pra ${pn} (${name})! O \u00e1rbitro n\u00e3o perdoa!`, `Amarelo para ${pn} (${name})! Aten\u00e7\u00e3o!`, `Cart\u00e3o amarelo! Falta dura de ${pn} (${name})!`];
    },
    red_card: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`CART\u00c3O VERMELHO pra ${pn} (${name})! Expulso!`, `Vermelho direto pra ${pn} (${name})! Que entrada violenta!`, `Segundo amarelo, vermelho! ${pn} (${name}) expulso!`];
    },
    corner: (team) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Escanteio para o ${name}! Bola vai pra \u00e1rea.`, `Canto a favor do ${name}! Perigo na \u00e1rea.`];
    },
    penalty: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`PENALTI contra o ${name}! Derrubada de ${pn}!`, `P\u00eanalito claro! M\u00e3o na bola de ${pn} (${name})!`, `\u00c9 p\u00eanalito! ${pn} (${name}) derruba na \u00e1rea!`];
    },
    penalty_goal: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`GOOOL DE P\u00caNALTI! ${pn} (${name}) cobra com perfei\u00e7\u00e3o!`, `${pn} bate no canto! Gol de p\u00eanalito do ${name}!`];
    },
    penalty_miss: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`${pn} (${name}) perdeu o p\u00eanalito! Bola pra fora!`, `Goleiro defendeu o p\u00eanalito de ${pn}! Que defesa\u00e7a!`, `P\u00eanalito desperdi\u00e7ado por ${pn} (${name})!`];
    },
    half_time: [`Fim do primeiro tempo! {homeName} {homeScore} x {awayScore} {awayName}.`, `Intervalo! Jogadores v\u00e3o pro vesti\u00e1rio. {homeName} {homeScore} x {awayScore} {awayName}.`],
    full_time: [`FIM DE JOGO! {homeName} {homeScore} x {awayScore} {awayName}.`, `Apita o \u00e1rbitro! {homeName} {homeScore} x {awayScore} {awayName}. Fim de jogo!`],
    attack: (team) => {
      const name = team === 'home' ? homeName : awayName;
      return [`${name} avan\u00e7a pelo meio campo.`, `Bola circulando no ataque do ${name}.`, `Jogada do ${name} pelo lado do campo.`];
    },
    counter_attack: (team) => {
      const name = team === 'home' ? homeName : awayName;
      return [`CONTRA-ATAQUE PERIGOSO do ${name}!`, `Bola lan\u00e7ada, contra-ataque fulminante do ${name}!`];
    },
    offside: (team) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Impedimento do ${name}!`, `Bandeirinha aciona, impedimento do ${name}.`];
    },
    injury: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Que pena! ${pn} (${name}) se machuca e precisa de atendimento!`, `Les\u00e3o! ${pn} (${name}) ca\u00ed no gramado, parece grave.`, `${pn} (${name}) sente uma dor e pede substitui\u00e7\u00e3o.`];
    },
    substitution: (team, pn) => {
      const name = team === 'home' ? homeName : awayName;
      return [`Substitui\u00e7\u00e3o no ${name}: sai ${pn}.`, `Aten\u00e7\u00e3o! ${name} faz uma altera\u00e7\u00e3o: ${pn} deixa o campo.`];
    },
  };
}

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getNarration(narrations, type, team, extra = {}) {
  const narr = narrations[type];
  if (typeof narr === 'function') {
    const playerName = extra.playerName || '';
    return getRandom(narr(team, playerName));
  }
  if (Array.isArray(narr)) {
    let text = getRandom(narr);
    text = text.replace('{homeScore}', String(extra.homeScore ?? ''));
    text = text.replace('{awayScore}', String(extra.awayScore ?? ''));
    text = text.replace('{homeName}', extra.homeName || '');
    text = text.replace('{awayName}', extra.awayName || '');
    return text;
  }
  return type;
}

function getStarters(teamId) {
  return prepare('SELECT * FROM players WHERE team_id = ? AND is_starter = 1').all(teamId);
}

function getAllPlayers(teamId) {
  return prepare('SELECT * FROM players WHERE team_id = ?').all(teamId);
}

function pickPlayer(players, position, teamSide, excludeIds = new Set()) {
  if (!players || players.length === 0) return { id: 'unknown', name: 'Desconhecido' };
  const pool = players.filter(p => {
    if (excludeIds.has(p.id)) return false;
    if (!position) return true;
    const pos = (p.position || '').toUpperCase();
    if (position === 'FWD') return pos.includes('FWD') || pos.includes('ATA') || pos.includes('PON');
    if (position === 'MID') return pos.includes('MID') || pos.includes('MEI') || pos.includes('VOL');
    if (position === 'DEF') return pos.includes('DEF') || pos.includes('ZAG') || pos.includes('LAT');
    if (position === 'GK') return pos.includes('GK') || pos.includes('GOL');
    if (position === 'FIELD') return !pos.includes('GK');
    return true;
  });
  if (pool.length === 0) return players.find(p => !excludeIds.has(p)) || players[0] || { id: 'unknown', name: 'Desconhecido' };
  return getRandom(pool);
}

function savePlayerStats(matchId, championshipId, homeTeamId, awayTeamId, playerStats) {
  const insert = prepare(`
    INSERT OR REPLACE INTO match_player_stats (id, match_id, player_id, team_id, championship_id, goals, assists, yellow_cards, red_cards, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  transaction(() => {
    for (const [playerId, stat] of Object.entries(playerStats)) {
      const rating = Math.max(3.0, Math.min(10.0, 6.0 + stat.goals * 1.5 + stat.assists * 1.0 - stat.yellow_cards * 0.5 - stat.red_cards * 1.0));
      insert.run(uuidv4(), matchId, playerId, stat.teamId, championshipId || null, stat.goals || 0, stat.assists || 0, stat.yellow_cards || 0, stat.red_cards || 0, Math.round(rating * 10) / 10);
    }
  });
}

function calculateTeamStats(teamId, tactics = null) {
  const starters = getStarters(teamId);
  if (starters.length === 0) return { attack: 50, midfield: 50, defense: 50, gk: 50, pace: 50, physical: 50, stamina: 50, dribbling: 50, aggression: 1, counterAttack: 50 };

  const positions = { GK: [], DEF: [], MID: [], FWD: [] };
  starters.forEach(p => {
    const pos = p.position.toUpperCase();
    if (pos.includes('GK') || pos.includes('GOL')) positions.GK.push(p);
    else if (pos.includes('DEF') || pos.includes('ZAG') || pos.includes('LAT')) positions.DEF.push(p);
    else if (pos.includes('MID') || pos.includes('MEI') || pos.includes('VOL') || pos.includes('CAM')) positions.MID.push(p);
    else if (pos.includes('FWD') || pos.includes('ATA') || pos.includes('PON') || pos.includes('CEN')) positions.FWD.push(p);
  });

  const avg = (arr, attr) => arr.length ? arr.reduce((s, p) => s + (p[attr] || 50), 0) / arr.length : 50;
  const mentalityMult = tactics ? { defensive: 0.85, balanced: 1.0, attacking: 1.2 }[tactics.mentality] || 1.0 : 1.0;
  const pressingFactor = tactics ? 0.8 + (tactics.pressing / 100) * 0.4 : 1.0;
  const depthFactor = tactics ? 0.9 + (tactics.depth / 100) * 0.2 : 1.0;

  return {
    attack: Math.round(avg(positions.FWD, 'shooting') * mentalityMult),
    midfield: Math.round(avg(positions.MID, 'passing') * depthFactor),
    defense: Math.round(avg(positions.DEF, 'defending') * (2 - depthFactor)),
    gk: avg(positions.GK, 'defending'),
    pace: (avg(positions.FWD, 'pace') + avg(positions.MID, 'pace')) / 2,
    physical: (avg(positions.DEF, 'physical') + avg(positions.FWD, 'physical')) / 2,
    stamina: avg(starters, 'stamina'),
    dribbling: avg(positions.MID, 'dribbling'),
    aggression: pressingFactor,
    counterAttack: avg(positions.FWD, 'pace') * 0.6 + avg(positions.MID, 'pace') * 0.4,
  };
}

function createMatchStats() {
  return {
    possessionHome: 50, possessionAway: 50,
    shotsTotalHome: 0, shotsTotalAway: 0,
    shotsOnTargetHome: 0, shotsOnTargetAway: 0,
    shotsOffTargetHome: 0, shotsOffTargetAway: 0,
    cornersHome: 0, cornersAway: 0,
    foulsHome: 0, foulsAway: 0,
    savesHome: 0, savesAway: 0,
    yellowCardsHome: 0, yellowCardsAway: 0,
    redCardsHome: 0, redCardsAway: 0,
    injuriesHome: 0, injuriesAway: 0,
    possessionCount: 0,
  };
}

function updateMatchStats(stats, event, isHomeAttacking) {
  const side = isHomeAttacking ? 'Home' : 'Away';
  const opp = isHomeAttacking ? 'Away' : 'Home';
  switch (event.type) {
    case EVENT_TYPES.GOAL:
    case EVENT_TYPES.PENALTY_GOAL:
    case EVENT_TYPES.SHOT_ON_TARGET:
      stats[`shotsTotal${side}`]++;
      stats[`shotsOnTarget${side}`]++;
      break;
    case EVENT_TYPES.SHOT_OFF_TARGET:
      stats[`shotsTotal${side}`]++;
      stats[`shotsOffTarget${side}`]++;
      break;
    case EVENT_TYPES.SAVE:
      stats[`saves${opp}`]++;
      break;
    case EVENT_TYPES.FOUL:
      stats[`fouls${side}`]++;
      break;
    case EVENT_TYPES.YELLOW_CARD:
      stats[`yellowCards${side}`]++;
      break;
    case EVENT_TYPES.RED_CARD:
      stats[`redCards${side}`]++;
      break;
    case EVENT_TYPES.CORNER:
      stats[`corners${side}`]++;
      break;
    case EVENT_TYPES.INJURY:
      stats[`injuries${side}`]++;
      break;
  }
}

function pickSubstitute(teamId, currentStarters) {
  const allPlayers = getAllPlayers(teamId);
  const bench = allPlayers.filter(p => !currentStarters.some(s => s.id === p.id));
  if (bench.length === 0) return null;
  bench.sort((a, b) => (b.physical || 50) - (a.physical || 50));
  return bench[0];
}

function getPlayerInjuryProb(minute) {
  const baseProb = 0.002;
  const fatigueMult = Math.min(2, minute / 45);
  return baseProb * fatigueMult;
}

// Add injury info to a player
function injurePlayer(player, playerStatsMap, teamId) {
  if (!player || player.id === 'unknown') return null;
  const severity = 0.3 + Math.random() * 0.4; // 30-70% stat reduction
  if (!playerStatsMap[player.id]) playerStatsMap[player.id] = { teamId, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
  return { playerId: player.id, playerName: player.name, severity, injured: true };
}

/**
 * Simulate one minute of play. Returns { events: [], statsUpdated: boolean }.
 * Stats object is updated in-place.
 */
function simulateMinute(homeStats, awayStats, minute, homeCards, awayCards, tactics, narrations, homePlayers, awayPlayers, playerStats, homeTeamId, awayTeamId, matchStats, injuredPlayers = {}) {
  const events = [];
  const homeAdvantage = 1.10;

  // Check for injuries (small chance per minute)
  if (Math.random() < getPlayerInjuryProb(minute)) {
    const victimTeam = Math.random() < 0.5 ? 'home' : 'away';
    const victimPlayers = victimTeam === 'home' ? homePlayers : awayPlayers;
    const victim = pickPlayer(victimPlayers, 'FIELD', victimTeam);
    if (victim && victim.id !== 'unknown') {
      const inj = injurePlayer(victim, playerStats, victimTeam === 'home' ? homeTeamId : awayTeamId);
      if (inj) {
        injuredPlayers[victim.id] = inj;
        events.push({ type: EVENT_TYPES.INJURY, minute, team: victimTeam, playerName: victim.name, playerId: victim.id, narration: getNarration(narrations, 'injury', victimTeam, { playerName: victim.name }) });
        updateMatchStats(matchStats, { type: EVENT_TYPES.INJURY }, victimTeam === 'home');
      }
    }
  }

  const staminaFactor = minute <= 45
    ? Math.max(0.92, 1 - (minute / 90) * 0.08)
    : Math.max(0.75, 1 - (minute / 90) * 0.25);

  // Apply injury penalties to stats
  const injuredHome = homePlayers.filter(p => injuredPlayers[p.id]);
  const injuredAway = awayPlayers.filter(p => injuredPlayers[p.id]);
  const homeInjuryPenalty = injuredHome.length > 0 ? 1 - injuredHome.reduce((s, p) => s + (injuredPlayers[p.id]?.severity || 0), 0) / injuredHome.length * 0.5 : 1;
  const awayInjuryPenalty = injuredAway.length > 0 ? 1 - injuredAway.reduce((s, p) => s + (injuredPlayers[p.id]?.severity || 0), 0) / injuredAway.length * 0.5 : 1;

  const homeAttackPower = homeStats.attack * homeAdvantage * staminaFactor * homeInjuryPenalty * (0.9 + Math.random() * 0.2);
  const awayAttackPower = awayStats.attack * staminaFactor * awayInjuryPenalty * (0.9 + Math.random() * 0.2);
  const homeDefensePower = homeStats.defense * staminaFactor * homeInjuryPenalty * (0.9 + Math.random() * 0.2);
  const awayDefensePower = awayStats.defense * staminaFactor * awayInjuryPenalty * (0.9 + Math.random() * 0.2);
  const homeMidPower = homeStats.midfield * staminaFactor * homeInjuryPenalty * (0.9 + Math.random() * 0.2);
  const awayMidPower = awayStats.midfield * staminaFactor * awayInjuryPenalty * (0.9 + Math.random() * 0.2);

  const totalMid = homeMidPower + awayMidPower;
  const homePossession = totalMid > 0 ? homeMidPower / totalMid : 0.5;

  // Accumulate possession for stats
  matchStats.possessionCount++;
  matchStats.possessionHome = (matchStats.possessionHome * (matchStats.possessionCount - 1) + homePossession * 100) / matchStats.possessionCount;
  matchStats.possessionAway = 100 - matchStats.possessionHome;

  const isHomeAttacking = Math.random() < homePossession;
  const attackPower = isHomeAttacking ? homeAttackPower : awayAttackPower;
  const defensePower = isHomeAttacking ? awayDefensePower : homeDefensePower;

  const attackingTeam = isHomeAttacking ? 'home' : 'away';
  const defendingTeam = isHomeAttacking ? 'away' : 'home';
  const attackingPlayers = isHomeAttacking ? homePlayers : awayPlayers;
  const defendingPlayers = isHomeAttacking ? awayPlayers : homePlayers;

  const canCounterAttack = Math.random() < 0.12 * (isHomeAttacking
    ? Math.max(0, (awayStats.counterAttack - homeStats.defense) / 100)
    : Math.max(0, (homeStats.counterAttack - awayStats.defense) / 100)
  );

  const attackDiff = attackPower - defensePower;
  const attackSuccess = Math.random() < (0.15 + attackDiff / 200) * (tactics ? tactics.pressing / 50 : 1);

  if (canCounterAttack) {
    const counterTeam = isHomeAttacking ? 'away' : 'home';
    const counterPlayers = isHomeAttacking ? awayPlayers : homePlayers;
    const counterPlayer = pickPlayer(counterPlayers, 'FWD', counterTeam);
    events.push({ type: EVENT_TYPES.COUNTER_ATTACK, minute, team: counterTeam, playerName: counterPlayer.name, playerId: counterPlayer.id, narration: getNarration(narrations, 'counter_attack', counterTeam) });
    const counterGoalChance = 0.35 * (isHomeAttacking ? awayStats.pace : homeStats.pace) / 100;
    if (Math.random() < counterGoalChance) {
      const scorer = pickPlayer(counterPlayers, 'FWD', counterTeam);
      if (!playerStats[scorer.id]) playerStats[scorer.id] = { teamId: isHomeAttacking ? awayTeamId : homeTeamId, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
      playerStats[scorer.id].goals++;
      events.push({ type: EVENT_TYPES.GOAL, minute, team: counterTeam, playerName: scorer.name, playerId: scorer.id, narration: getNarration(narrations, 'goal', counterTeam, { playerName: scorer.name }) });
      updateMatchStats(matchStats, { type: EVENT_TYPES.GOAL }, counterTeam === 'home');
    } else {
      const shooter = pickPlayer(counterPlayers, 'FWD', counterTeam);
      const shotType = Math.random() < 0.5 ? EVENT_TYPES.SHOT_ON_TARGET : EVENT_TYPES.SHOT_OFF_TARGET;
      events.push({ type: shotType, minute, team: counterTeam, playerName: shooter.name, playerId: shooter.id, narration: getNarration(narrations, shotType === EVENT_TYPES.SHOT_ON_TARGET ? 'shot_on_target' : 'shot_off_target', counterTeam, { playerName: shooter.name }) });
      updateMatchStats(matchStats, { type: shotType }, counterTeam === 'home');
    }
  } else if (attackSuccess) {
    const gkFactor = isHomeAttacking ? awayStats.gk : homeStats.gk;
    const goalChance = (attackPower / (attackPower + defensePower + gkFactor * 0.5)) * 0.45;
    const isGoal = Math.random() < goalChance;

    if (isGoal) {
      const scorer = pickPlayer(attackingPlayers, 'FWD', attackingTeam);
      if (!playerStats[scorer.id]) playerStats[scorer.id] = { teamId: isHomeAttacking ? homeTeamId : awayTeamId, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
      playerStats[scorer.id].goals++;
      events.push({ type: EVENT_TYPES.GOAL, minute, team: attackingTeam, playerName: scorer.name, playerId: scorer.id, narration: getNarration(narrations, 'goal', attackingTeam, { playerName: scorer.name }) });
      updateMatchStats(matchStats, { type: EVENT_TYPES.GOAL }, isHomeAttacking);
    } else {
      const saveChance = gkFactor / 150;
      if (Math.random() < saveChance) {
        const gkPlayer = pickPlayer(defendingPlayers, 'GK', defendingTeam);
        events.push({ type: EVENT_TYPES.SAVE, minute, team: defendingTeam, playerName: gkPlayer.name, playerId: gkPlayer.id, narration: getNarration(narrations, 'save', defendingTeam) });
        updateMatchStats(matchStats, { type: EVENT_TYPES.SAVE }, isHomeAttacking);
      } else {
        const shooter = pickPlayer(attackingPlayers, 'FWD', attackingTeam);
        const shotType = Math.random() < 0.5 ? EVENT_TYPES.SHOT_ON_TARGET : EVENT_TYPES.SHOT_OFF_TARGET;
        events.push({ type: shotType, minute, team: attackingTeam, playerName: shooter.name, playerId: shooter.id, narration: getNarration(narrations, shotType === EVENT_TYPES.SHOT_ON_TARGET ? 'shot_on_target' : 'shot_off_target', attackingTeam, { playerName: shooter.name }) });
        updateMatchStats(matchStats, { type: shotType }, isHomeAttacking);
      }
    }
  } else if (Math.random() < 0.10 * (tactics ? tactics.pressing / 50 : 1)) {
    // FIXED: defending team commits the foul, not the attacking team
    const foulTeam = defendingTeam;
    const foulPlayers = defendingPlayers;
    const cards = foulTeam === 'home' ? homeCards : awayCards;
    const fouler = pickPlayer(foulPlayers, 'FIELD', foulTeam);
    events.push({ type: EVENT_TYPES.FOUL, minute, team: foulTeam, playerName: fouler.name, playerId: fouler.id, narration: getNarration(narrations, 'foul', foulTeam, { playerName: fouler.name }) });
    updateMatchStats(matchStats, { type: EVENT_TYPES.FOUL }, foulTeam === 'home');

    if (Math.random() < 0.08 * (tactics ? tactics.pressing / 50 : 1) && cards.yellow < 3) {
      if (!playerStats[fouler.id]) playerStats[fouler.id] = { teamId: foulTeam === 'home' ? homeTeamId : awayTeamId, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
      playerStats[fouler.id].yellow_cards++;
      events.push({ type: EVENT_TYPES.YELLOW_CARD, minute, team: foulTeam, playerName: fouler.name, playerId: fouler.id, narration: getNarration(narrations, 'yellow_card', foulTeam, { playerName: fouler.name }) });
      cards.yellow++;
      updateMatchStats(matchStats, { type: EVENT_TYPES.YELLOW_CARD }, foulTeam === 'home');
      if (cards.yellow >= 3 && Math.random() < 0.25) {
        playerStats[fouler.id].red_cards++;
        events.push({ type: EVENT_TYPES.RED_CARD, minute, team: foulTeam, playerName: fouler.name, playerId: fouler.id, narration: getNarration(narrations, 'red_card', foulTeam, { playerName: fouler.name }) });
        cards.red = (cards.red || 0) + 1;
        updateMatchStats(matchStats, { type: EVENT_TYPES.RED_CARD }, foulTeam === 'home');
      }
    }

    if (Math.random() < 0.012) {
      // foulTeam committed the foul, attackingTeam gets the penalty
      const penaltyFouler = pickPlayer(foulPlayers, 'DEF', foulTeam);
      events.push({ type: EVENT_TYPES.PENALTY, minute, team: foulTeam, playerName: penaltyFouler.name, playerId: penaltyFouler.id, narration: getNarration(narrations, 'penalty', foulTeam, { playerName: penaltyFouler.name }) });
      const penaltyTeam = attackingTeam;
      const penaltyPlayers = attackingPlayers;
      const penaltyGoal = Math.random() < 0.78;
      if (penaltyGoal) {
        const scorer = pickPlayer(penaltyPlayers, 'FWD', penaltyTeam);
        if (!playerStats[scorer.id]) playerStats[scorer.id] = { teamId: penaltyTeam === 'home' ? homeTeamId : awayTeamId, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
        playerStats[scorer.id].goals++;
        events.push({ type: EVENT_TYPES.PENALTY_GOAL, minute, team: penaltyTeam, playerName: scorer.name, playerId: scorer.id, narration: getNarration(narrations, 'penalty_goal', penaltyTeam, { playerName: scorer.name }) });
        updateMatchStats(matchStats, { type: EVENT_TYPES.PENALTY_GOAL }, penaltyTeam === 'home');
      } else {
        const misser = pickPlayer(penaltyPlayers, 'FWD', penaltyTeam);
        events.push({ type: EVENT_TYPES.PENALTY_MISS, minute, team: penaltyTeam, playerName: misser.name, playerId: misser.id, narration: getNarration(narrations, 'penalty_miss', penaltyTeam, { playerName: misser.name }) });
        updateMatchStats(matchStats, { type: EVENT_TYPES.PENALTY_MISS }, penaltyTeam === 'home');
      }
    }
  } else if (Math.random() < 0.07) {
    events.push({ type: EVENT_TYPES.CORNER, minute, team: attackingTeam, narration: getNarration(narrations, 'corner', attackingTeam) });
    updateMatchStats(matchStats, { type: EVENT_TYPES.CORNER }, isHomeAttacking);
  } else if (Math.random() < 0.05) {
    events.push({ type: EVENT_TYPES.OFFSIDE, minute, team: attackingTeam, narration: getNarration(narrations, 'offside', attackingTeam) });
  } else if (Math.random() < 0.2) {
    const attacker = pickPlayer(attackingPlayers, 'FWD', attackingTeam);
    events.push({ type: EVENT_TYPES.ATTACK, minute, team: attackingTeam, playerName: attacker.name, playerId: attacker.id, narration: getNarration(narrations, 'attack', attackingTeam) });
  }

  return events;
}

function createEvent(type, minute, narration, homeScore, awayScore, team = null, finished = false) {
  const event = { type, minute, narration, homeScore, awayScore };
  if (team) event.team = team;
  if (finished) event.finished = true;
  return event;
}

function updateMatchDB(matchId, homeScore, awayScore, events, stats, status, matchState) {
  const updates = { home_score: homeScore, away_score: awayScore, events: JSON.stringify(events), stats: JSON.stringify(stats) };
  if (status) updates.status = status;
  if (matchState) updates.match_state = matchState;
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  values.push(matchId);
  prepare(`UPDATE matches SET ${setClauses} WHERE id = ?`).run(...values);
}

function endMatch(matchId, homeScore, awayScore, homeTeamId, awayTeamId, playerStats, events, stats, championshipId) {
  updateMatchDB(matchId, homeScore, awayScore, events, stats, 'finished', 'finished');
  if (championshipId) {
    updateChampionshipStandings(championshipId, homeTeamId, awayTeamId, homeScore, awayScore);
    savePlayerStats(matchId, championshipId, homeTeamId, awayTeamId, playerStats);
  }
}

function updateChampionshipStandings(championshipId, homeTeamId, awayTeamId, homeScore, awayScore) {
  const getTeam = prepare('SELECT * FROM championship_teams WHERE championship_id = ? AND team_id = ?');
  const updateTeam = prepare('UPDATE championship_teams SET points = ?, wins = ?, draws = ?, losses = ?, goals_for = ?, goals_against = ? WHERE championship_id = ? AND team_id = ?');
  const home = getTeam.get(championshipId, homeTeamId);
  if (home) updateTeam.run(home.points + (homeScore > awayScore ? 3 : homeScore === awayScore ? 1 : 0), home.wins + (homeScore > awayScore ? 1 : 0), home.draws + (homeScore === awayScore ? 1 : 0), home.losses + (homeScore < awayScore ? 1 : 0), home.goals_for + homeScore, home.goals_against + awayScore, championshipId, homeTeamId);
  const away = getTeam.get(championshipId, awayTeamId);
  if (away) updateTeam.run(away.points + (awayScore > homeScore ? 3 : awayScore === homeScore ? 1 : 0), away.wins + (awayScore > homeScore ? 1 : 0), away.draws + (awayScore === homeScore ? 1 : 0), away.losses + (awayScore < homeScore ? 1 : 0), away.goals_for + awayScore, away.goals_against + homeScore, championshipId, awayTeamId);
}

// ============ FAST SIMULATE (non-live) ============
function simulateMatch(matchId) {
  const match = prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match || match.status !== 'pending') return null;

  const homeTeam = prepare('SELECT * FROM teams WHERE id = ?').get(match.home_team_id);
  const awayTeam = prepare('SELECT * FROM teams WHERE id = ?').get(match.away_team_id);
  const homeName = homeTeam ? homeTeam.name : 'Casa';
  const awayName = awayTeam ? awayTeam.name : 'Visitante';
  const homeTeamId = match.home_team_id;
  const awayTeamId = match.away_team_id;
  const narrations = buildNarrations(homeName, awayName);
  const homeTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.home_team_id);
  const awayTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.away_team_id);
  let homePlayers = getStarters(match.home_team_id);
  let awayPlayers = getStarters(match.away_team_id);
  let homeStats = calculateTeamStats(match.home_team_id, homeTactics);
  let awayStats = calculateTeamStats(match.away_team_id, awayTactics);

  const homeCards = { yellow: 0, red: 0 };
  const awayCards = { yellow: 0, red: 0 };
  const playerStats = {};
  const injuredPlayers = {};
  const matchStats = createMatchStats();
  let homeScore = 0, awayScore = 0;
  const allEvents = [];

  prepare('UPDATE matches SET status = ?, started_at = ? WHERE id = ?').run('live', new Date().toISOString(), matchId);
  allEvents.push(createEvent(EVENT_TYPES.KICKOFF, 0, getNarration(narrations, 'kickoff', null), 0, 0));

  for (let minute = 1; minute <= 90; minute++) {
    const result = simulateMinute(homeStats, awayStats, minute, homeCards, awayCards, homeTactics, narrations, homePlayers, awayPlayers, playerStats, homeTeamId, awayTeamId, matchStats, injuredPlayers);
    for (const event of result) {
      if (event.type === EVENT_TYPES.GOAL || event.type === EVENT_TYPES.PENALTY_GOAL) {
        if (event.team === 'home') homeScore++; else awayScore++;
      }
      event.homeScore = homeScore;
      event.awayScore = awayScore;
    }
    allEvents.push(...result);

    if (minute === 45) {
      // Auto-sub injured players at halftime
      const autoSub = (players, teamId) => {
        const injured = players.filter(p => injuredPlayers[p.id]);
        for (const p of injured) {
          const sub = pickSubstitute(teamId, players);
          if (sub) {
            const idx = players.findIndex(sp => sp.id === p.id);
            if (idx !== -1) players[idx] = sub;
            allEvents.push({ type: EVENT_TYPES.SUBSTITUTION, minute: 45, team: teamId === homeTeamId ? 'home' : 'away', playerName: p.name, narration: `Substitui\u00e7\u00e3o por les\u00e3o: sai ${p.name}, entra ${sub.name}.` });
          }
        }
      };
      const prevHomePlayers = [...homePlayers];
      const prevAwayPlayers = [...awayPlayers];
      autoSub(homePlayers, homeTeamId);
      autoSub(awayPlayers, awayTeamId);
      // Recalc stats if players changed
      if (homePlayers.some((p, i) => p.id !== prevHomePlayers[i]?.id)) homeStats = calculateTeamStats(homeTeamId, homeTactics);
      if (awayPlayers.some((p, i) => p.id !== prevAwayPlayers[i]?.id)) awayStats = calculateTeamStats(awayTeamId, awayTactics);
      allEvents.push(createEvent(EVENT_TYPES.HALF_TIME, 45, getNarration(narrations, 'half_time', null, { homeScore, awayScore, homeName, awayName }), homeScore, awayScore));
    }
    if (homeCards.red >= 2 || awayCards.red >= 2) break;
  }

  allEvents.push(createEvent(EVENT_TYPES.FULL_TIME, 90, getNarration(narrations, 'full_time', null, { homeScore, awayScore, homeName, awayName }), homeScore, awayScore));
  endMatch(matchId, homeScore, awayScore, homeTeamId, awayTeamId, playerStats, allEvents, matchStats, match.championship_id);
  return { homeScore, awayScore, events: allEvents, stats: matchStats };
}

// ============ LIVE SIMULATE (with pauses) ============
function simulateMatchLive(matchId, callback, options = {}) {
  const match = prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match || (match.status !== 'pending' && match.status !== 'live')) return;

  const homeTeam = prepare('SELECT * FROM teams WHERE id = ?').get(match.home_team_id);
  const awayTeam = prepare('SELECT * FROM teams WHERE id = ?').get(match.away_team_id);
  const homeName = homeTeam ? homeTeam.name : 'Casa';
  const awayName = awayTeam ? awayTeam.name : 'Visitante';
  const homeTeamId = match.home_team_id;
  const awayTeamId = match.away_team_id;
  const narrations = buildNarrations(homeName, awayName);

  let homeTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.home_team_id);
  let awayTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.away_team_id);
  let homePlayers = getStarters(match.home_team_id);
  let awayPlayers = getStarters(match.away_team_id);
  let homeStats = calculateTeamStats(match.home_team_id, homeTactics);
  let awayStats = calculateTeamStats(match.away_team_id, awayTactics);

  const homeCards = { yellow: 0, red: 0 };
  const awayCards = { yellow: 0, red: 0 };
  const playerStats = {};
  const injuredPlayers = {};
  const matchStats = match.stats && match.stats !== '{}' ? { ...createMatchStats(), ...JSON.parse(match.stats) } : createMatchStats();
  let homeScore = 0, awayScore = 0;
  let currentMinute = match.current_minute || 0;
  let phase = match.match_state === 'second_half' ? 'second_half' : 'first_half';
  let isPaused = false;
  let penaltyChooseTeam = 'away';
  let substitutionsThisHalf = { home: 0, away: 0 };

  const totalDuration = (options.duration || 180) * 1000;
  const interval = totalDuration / 90;

  // Load existing state if reconnecting
  if (match.status === 'pending') {
    prepare('UPDATE matches SET status = ?, match_state = ?, current_minute = ?, started_at = ? WHERE id = ?').run('live', 'first_half', 0, new Date().toISOString(), matchId);
    callback(createEvent(EVENT_TYPES.KICKOFF, 0, getNarration(narrations, 'kickoff', null), 0, 0));
    currentMinute = 1;
  } else if (match.status === 'live' && match.match_state === 'halftime') {
    homeTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.home_team_id) || homeTactics;
    awayTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.away_team_id) || awayTactics;
    homePlayers = getStarters(match.home_team_id);
    awayPlayers = getStarters(match.away_team_id);
    homeStats = calculateTeamStats(match.home_team_id, homeTactics);
    awayStats = calculateTeamStats(match.away_team_id, awayTactics);
    homeScore = match.home_score || 0;
    awayScore = match.away_score || 0;
    currentMinute = 46;
    phase = 'second_half';
    prepare('UPDATE matches SET match_state = ? WHERE id = ?').run('second_half', matchId);
  }

  function simulatePenalty(kickerPlayerId) {
    const team = penaltyChooseTeam;
    const pPlayers = team === 'home' ? homePlayers : awayPlayers;
    const kicker = pPlayers.find(p => p.id === kickerPlayerId) || pickPlayer(pPlayers, 'FWD', team);
    if (!playerStats[kicker.id]) playerStats[kicker.id] = { teamId: team === 'home' ? homeTeamId : awayTeamId, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };

    const pGoal = Math.random() < 0.78;
    let pe;
    if (pGoal) {
      playerStats[kicker.id].goals++;
      if (team === 'home') homeScore++; else awayScore++;
      pe = createEvent(EVENT_TYPES.PENALTY_GOAL, currentMinute, getNarration(narrations, 'penalty_goal', team, { playerName: kicker.name }), homeScore, awayScore, team);
    } else {
      pe = createEvent(EVENT_TYPES.PENALTY_MISS, currentMinute, getNarration(narrations, 'penalty_miss', team, { playerName: kicker.name }), homeScore, awayScore, team);
    }
    pe.playerName = kicker.name;
    pe.playerId = kicker.id;
    callback(pe);
    const ce = prepare('SELECT events FROM matches WHERE id = ?').get(matchId);
    const evts = ce ? JSON.parse(ce.events) : [];
    evts.push(pe);
    prepare('UPDATE matches SET events = ?, home_score = ?, away_score = ?, current_minute = ? WHERE id = ?').run(JSON.stringify(evts), homeScore, awayScore, currentMinute, matchId);
  }

  function doSubstitution(team, outPlayerId, inPlayer) {
    const players = team === 'home' ? homePlayers : awayPlayers;
    const idx = players.findIndex(p => p.id === outPlayerId);
    if (idx === -1) return false;
    if (substitutionsThisHalf[team] >= 3) return false;
    players[idx] = inPlayer;
    substitutionsThisHalf[team]++;
    const evt = { type: EVENT_TYPES.SUBSTITUTION, minute: currentMinute, team, playerName: players[idx].name, narration: `Substitui\u00e7\u00e3o: sai ${players[idx].name}, entra ${inPlayer.name}.` };
    callback(evt);
    return true;
  }

  const state = {
    matchId, callback, options, homeStats, awayStats, homeCards, awayCards,
    homeTactics, narrations, homePlayers, awayPlayers, playerStats, injuredPlayers, matchStats,
    homeTeamId, awayTeamId, homeScore, awayScore, currentMinute, phase,
    homeName, awayName, interval, isPaused, timer: null,
    simulatePenalty, penaltyChooseTeam, doSubstitution, substitutionsThisHalf,
  };

  matchSimulations.set(matchId, state);

  function syncState() {
    state.homeScore = homeScore; state.awayScore = awayScore;
    state.currentMinute = currentMinute; state.phase = phase;
    state.isPaused = isPaused; state.penaltyChooseTeam = penaltyChooseTeam;
    state.homeTactics = homeTactics; state.awayTactics = awayTactics;
    state.homePlayers = homePlayers; state.awayPlayers = awayPlayers;
    state.homeStats = homeStats; state.awayStats = awayStats;
    state.homeCards = homeCards; state.awayCards = awayCards;
    state.playerStats = playerStats; state.matchStats = matchStats;
    state.substitutionsThisHalf = substitutionsThisHalf;
  }

  function tick() {
    if (isPaused) return;

    if (currentMinute === 46 && phase === 'second_half') {
      homeTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.home_team_id) || homeTactics;
      awayTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.away_team_id) || awayTactics;
      homePlayers = getStarters(match.home_team_id);
      awayPlayers = getStarters(match.away_team_id);
      homeStats = calculateTeamStats(match.home_team_id, homeTactics);
      awayStats = calculateTeamStats(match.away_team_id, awayTactics);
      substitutionsThisHalf = { home: 0, away: 0 };
      syncState();
    }

    if (currentMinute > 90 || homeCards.red >= 2 || awayCards.red >= 2) {
      if (state.timer) clearInterval(state.timer);
      matchSimulations.delete(matchId);
      // Read accumulated events from DB
      const ce = prepare('SELECT events FROM matches WHERE id = ?').get(matchId);
      const finalEvents = ce ? JSON.parse(ce.events) : [];
      finalEvents.push(...minuteEvents);
      endMatch(matchId, homeScore, awayScore, homeTeamId, awayTeamId, playerStats, finalEvents, matchStats, match.championship_id);
      callback(createEvent(EVENT_TYPES.FULL_TIME, 90, getNarration(narrations, 'full_time', null, { homeScore, awayScore, homeName, awayName }), homeScore, awayScore, null, true));
      syncState();
      return;
    }

    const minuteEvents = simulateMinute(homeStats, awayStats, currentMinute, homeCards, awayCards, homeTactics, narrations, homePlayers, awayPlayers, playerStats, homeTeamId, awayTeamId, matchStats, injuredPlayers);

    // Check for penalty that needs user input
    const penaltyEvent = minuteEvents.find(e => e.type === EVENT_TYPES.PENALTY);
    if (penaltyEvent) {
      isPaused = true;
      if (state.timer) clearInterval(state.timer);
      penaltyChooseTeam = penaltyEvent.team === 'home' ? 'away' : 'home';
      syncState();
      prepare('UPDATE matches SET match_state = ? WHERE id = ?').run('penalty', matchId);
      callback({ ...penaltyEvent, type: 'penalty_choose', chooseTeam: penaltyChooseTeam, homeScore, awayScore, paused: true });
      return;
    }

    for (const event of minuteEvents) {
      if (event.type === EVENT_TYPES.GOAL || event.type === EVENT_TYPES.PENALTY_GOAL) {
        if (event.team === 'home') homeScore++; else awayScore++;
      }
      event.homeScore = homeScore;
      event.awayScore = awayScore;
      callback({ ...event, homeScore, awayScore });
    }

    // Half time
    if (currentMinute === 45 && phase === 'first_half') {
      callback(createEvent(EVENT_TYPES.HALF_TIME, 45, getNarration(narrations, 'half_time', null, { homeScore, awayScore, homeName, awayName }), homeScore, awayScore));
      isPaused = true;
      if (state.timer) clearInterval(state.timer);
      // Save current events before halftime pause
      const ce = prepare('SELECT events FROM matches WHERE id = ?').get(matchId);
      const evts = ce ? JSON.parse(ce.events) : [];
      evts.push(...minuteEvents);
      prepare('UPDATE matches SET match_state = ?, current_minute = ?, home_score = ?, away_score = ?, events = ?, stats = ? WHERE id = ?').run('halftime', currentMinute, homeScore, awayScore, JSON.stringify(evts), JSON.stringify(matchStats), matchId);
      callback({ type: 'halftime_paused', paused: true, homeScore, awayScore, injuredPlayers: Object.values(injuredPlayers).map(i => ({ playerId: i.playerId, playerName: i.playerName, severity: i.severity })) });
      syncState();
      return;
    }

    // Save to DB after each minute
    const ce = prepare('SELECT events FROM matches WHERE id = ?').get(matchId);
    const evts = ce ? JSON.parse(ce.events) : [];
    evts.push(...minuteEvents);
    updateMatchDB(matchId, homeScore, awayScore, evts, matchStats, null, null);
    currentMinute++;
    syncState();
  }

  syncState();
  state.timer = setInterval(tick, interval);

  state.updateCallback = function (newCallback) {
    callback = newCallback;
    state.callback = newCallback;
  };

  state.resumeFromHalftime = function () {
    const m = prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
    if (!m || m.match_state !== 'halftime') return;
    homeTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.home_team_id) || homeTactics;
    awayTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.away_team_id) || awayTactics;
    homePlayers = getStarters(match.home_team_id);
    awayPlayers = getStarters(match.away_team_id);
    homeStats = calculateTeamStats(match.home_team_id, homeTactics);
    awayStats = calculateTeamStats(match.away_team_id, awayTactics);
    // Check for injured players that need auto-sub
    for (const [pid, inj] of Object.entries(injuredPlayers)) {
      const hIdx = homePlayers.findIndex(p => p.id === pid);
      if (hIdx !== -1) {
        const sub = pickSubstitute(homeTeamId, homePlayers);
        if (sub && substitutionsThisHalf.home < 3) {
          const outName = homePlayers[hIdx].name;
          homePlayers[hIdx] = sub;
          substitutionsThisHalf.home++;
          callback({ type: EVENT_TYPES.SUBSTITUTION, minute: 45, team: 'home', playerName: outName, narration: `Les\u00e3o: sai ${outName}, entra ${sub.name}.` });
        }
      }
      const aIdx = awayPlayers.findIndex(p => p.id === pid);
      if (aIdx !== -1) {
        const sub = pickSubstitute(awayTeamId, awayPlayers);
        if (sub && substitutionsThisHalf.away < 3) {
          const outName = awayPlayers[aIdx].name;
          awayPlayers[aIdx] = sub;
          substitutionsThisHalf.away++;
          callback({ type: EVENT_TYPES.SUBSTITUTION, minute: 45, team: 'away', playerName: outName, narration: `Les\u00e3o: sai ${outName}, entra ${sub.name}.` });
        }
      }
    }
    isPaused = false;
    phase = 'second_half';
    currentMinute = 46;
    syncState();
    prepare('UPDATE matches SET match_state = ? WHERE id = ?').run('second_half', matchId);
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(tick, interval);
  };

  state.setPenaltyKicker = function (playerId) {
    simulatePenalty(playerId);
    isPaused = false;
    syncState();
    prepare('UPDATE matches SET match_state = ? WHERE id = ?').run(phase, matchId);
    currentMinute++;
    syncState();
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(tick, interval);
  };

  state.getInjuredPlayers = function () {
    return Object.values(injuredPlayers);
  };

  return state;
}

// ============ LIVE SIMULATE (no pause - for live-round) ============
function simulateMatchLiveNoPause(matchId, callback) {
  const match = prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match || match.status !== 'pending') return;

  const homeTeam = prepare('SELECT * FROM teams WHERE id = ?').get(match.home_team_id);
  const awayTeam = prepare('SELECT * FROM teams WHERE id = ?').get(match.away_team_id);
  const homeName = homeTeam ? homeTeam.name : 'Casa';
  const awayName = awayTeam ? awayTeam.name : 'Visitante';
  const homeTeamId = match.home_team_id;
  const awayTeamId = match.away_team_id;
  const narrations = buildNarrations(homeName, awayName);
  const homeTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.home_team_id);
  const awayTactics = prepare('SELECT * FROM tactics WHERE team_id = ?').get(match.away_team_id);
  let homePlayers = getStarters(match.home_team_id);
  let awayPlayers = getStarters(match.away_team_id);
  let homeStats = calculateTeamStats(match.home_team_id, homeTactics);
  let awayStats = calculateTeamStats(match.away_team_id, awayTactics);

  const homeCards = { yellow: 0, red: 0 };
  const awayCards = { yellow: 0, red: 0 };
  const playerStats = {};
  const injuredPlayers = {};
  const matchStats = createMatchStats();
  let homeScore = 0, awayScore = 0;
  let currentMinute = 1;

  const totalDuration = 120000; // fixed 2min for multi-match
  const interval = totalDuration / 90;

  prepare('UPDATE matches SET status = ?, match_state = ?, current_minute = ?, started_at = ? WHERE id = ?').run('live', 'first_half', 0, new Date().toISOString(), matchId);
  callback(createEvent(EVENT_TYPES.KICKOFF, 0, getNarration(narrations, 'kickoff', null), 0, 0));

  const simTimer = setInterval(() => {
    if (currentMinute > 90 || homeCards.red >= 2 || awayCards.red >= 2) {
      clearInterval(simTimer);
      const ce = prepare('SELECT events FROM matches WHERE id = ?').get(matchId);
      const finalE = ce ? JSON.parse(ce.events) : [];
      finalE.push(...minuteEvents);
      endMatch(matchId, homeScore, awayScore, homeTeamId, awayTeamId, playerStats, finalE, matchStats, match.championship_id);
      callback(createEvent(EVENT_TYPES.FULL_TIME, 90, getNarration(narrations, 'full_time', null, { homeScore, awayScore, homeName, awayName }), homeScore, awayScore, null, true));
      return;
    }

    const minuteEvents = simulateMinute(homeStats, awayStats, currentMinute, homeCards, awayCards, homeTactics, narrations, homePlayers, awayPlayers, playerStats, homeTeamId, awayTeamId, matchStats, injuredPlayers);

    for (const event of minuteEvents) {
      if (event.type === EVENT_TYPES.GOAL || event.type === EVENT_TYPES.PENALTY_GOAL) {
        if (event.team === 'home') homeScore++; else awayScore++;
      }
      event.homeScore = homeScore;
      event.awayScore = awayScore;
      callback({ ...event, homeScore, awayScore });
    }

    if (currentMinute === 45) {
      // Auto-sub injured at halftime
      const autoSub = (players, teamId) => {
        const injured = players.filter(p => injuredPlayers[p.id]);
        for (const p of injured) {
          const sub = pickSubstitute(teamId, players);
          if (sub) {
            const idx = players.findIndex(sp => sp.id === p.id);
            if (idx !== -1) players[idx] = sub;
          }
        }
      };
      autoSub(homePlayers, homeTeamId);
      autoSub(awayPlayers, awayTeamId);
      homeStats = calculateTeamStats(homeTeamId, homeTactics);
      awayStats = calculateTeamStats(awayTeamId, awayTactics);
      callback(createEvent(EVENT_TYPES.HALF_TIME, 45, getNarration(narrations, 'half_time', null, { homeScore, awayScore, homeName, awayName }), homeScore, awayScore));
    }

    const ce = prepare('SELECT events FROM matches WHERE id = ?').get(matchId);
    const evts = ce ? JSON.parse(ce.events) : [];
    evts.push(...minuteEvents);
    updateMatchDB(matchId, homeScore, awayScore, evts, matchStats, null, null);
    currentMinute++;
  }, interval);

  return simTimer;
}

function resumeMatchFromHalftime(matchId) {
  const state = matchSimulations.get(matchId);
  if (!state || !state.resumeFromHalftime) return null;
  state.resumeFromHalftime();
  return state;
}

function setPenaltyKicker(matchId, playerId) {
  const state = matchSimulations.get(matchId);
  if (!state || !state.setPenaltyKicker) return false;
  state.setPenaltyKicker(playerId);
  return true;
}

function getMatchSimulation(matchId) {
  return matchSimulations.get(matchId) || null;
}

module.exports = {
  simulateMatch, simulateMatchLive, simulateMatchLiveNoPause,
  resumeMatchFromHalftime, setPenaltyKicker, getMatchSimulation,
  calculateTeamStats, EVENT_TYPES,
};
