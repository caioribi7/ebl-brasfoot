const fs = require('fs');
const path = require('path');

// Characteristic IDs from .ban files
const CHARACTERISTICS = {
  0: 'colocacao',
  1: 'defesa_penalti',
  2: 'reflexo',
  3: 'saida_gol',
  4: 'armacao',
  5: 'cabeceio',
  6: 'cruzamento',
  7: 'desarme',
  8: 'drible',
  9: 'finalizacao',
  10: 'marcacao',
  11: 'passe',
  12: 'resistencia',
  13: 'velocidade',
};

// Position mapping
const POSITION_MAP = {
  0: 'GK',
  1: 'DEF',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

const POSITION_NAMES = {
  0: 'Goleiro',
  1: 'Lateral',
  2: 'Zagueiro',
  3: 'Meio Campo',
  4: 'Atacante',
};

// Base stats by position (GK, DEF-LAT, DEF-ZAG, MID, FWD)
const BASE_STATS = {
  GK:  { colocacao: 65, defesa_penalti: 55, reflexo: 60, saida_gol: 55, cabeceio: 30, desarme: 40, drible: 25, finalizacao: 20, marcacao: 35, passe: 40, resistencia: 50, velocidade: 35, armacao: 20, cruzamento: 15 },
  DEF: { colocacao: 55, defesa_penalti: 30, reflexo: 45, saida_gol: 20, cabeceio: 55, desarme: 65, drible: 40, finalizacao: 30, marcacao: 65, passe: 45, resistencia: 60, velocidade: 50, armacao: 30, cruzamento: 40 },
  MID: { colocacao: 55, defesa_penalti: 25, reflexo: 40, saida_gol: 15, cabeceio: 45, desarme: 50, drible: 60, finalizacao: 50, marcacao: 45, passe: 65, resistencia: 60, velocidade: 55, armacao: 65, cruzamento: 55 },
  FWD: { colocacao: 55, defesa_penalti: 20, reflexo: 45, saida_gol: 15, cabeceio: 55, desarme: 30, drible: 60, finalizacao: 65, marcacao: 25, passe: 45, resistencia: 55, velocidade: 65, armacao: 35, cruzamento: 40 },
};

// How much each characteristic boosts the stat
const CHAR_BOOST = 12;

function findBytes(data, bytes, startOffset = 0) {
  for (let i = startOffset; i <= data.length - bytes.length; i++) {
    let found = true;
    for (let j = 0; j < bytes.length; j++) {
      if (data[i + j] !== bytes[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

function extractFieldsFromClassDescriptor(data, classDescStart, xpEnd) {
  const fields = [];
  const typeCodes = new Set([0x49, 0x5a, 0x4c, 0x4a, 0x53, 0x42, 0x46, 0x44]);
  let pos = classDescStart;
  while (pos < xpEnd) {
    if (typeCodes.has(data[pos])) {
      const type = String.fromCharCode(data[pos]); pos++;
      const nameLen = data.readUInt16BE(pos);
      const name = data.toString('utf8', pos + 2, pos + 2 + nameLen);
      pos += 2 + nameLen;
      if (type === 'L') { while (pos < xpEnd && data[pos] !== 0x3b) pos++; pos++; }
      fields.push({ type, name });
    } else { pos++; }
  }
  return fields;
}

function readFieldValue(data, pos, field) {
  switch (field.type) {
    case 'I': return { value: data.readUInt32BE(pos), pos: pos + 4 };
    case 'Z': return { value: data[pos] !== 0, pos: pos + 1 };
    case 'L': {
      if (data[pos] === 0x74) { const len = data.readUInt16BE(pos + 1); return { value: data.toString('utf8', pos + 3, pos + 3 + len), pos: pos + 3 + len }; }
      if (data[pos] === 0x70) return { value: null, pos: pos + 1 };
      if (data[pos] === 0x71) return { value: null, pos: pos + 3 };
      return { value: null, pos: pos + 1 };
    }
    default: return { value: null, pos: pos + 1 };
  }
}

function readExtraStrings(data, pos, maxCount = 5) {
  const strings = []; let count = 0;
  while (pos < data.length && count < maxCount) {
    if (data[pos] === 0x74) {
      const len = data.readUInt16BE(pos + 1);
      if (len === 0 || len > 200) break;
      strings.push(data.toString('utf8', pos + 3, pos + 3 + len));
      pos += 3 + len; count++;
    } else if (data[pos] === 0x70) { pos++; }
    else if (data[pos] === 0x71) { pos += 3; }
    else if (data[pos] === 0x73 && data[pos + 1] === 0x72) { break; }
    else { break; }
  }
  return { strings, pos };
}

function generatePlayerStats(age, positionCode, char1, char2, isStar, isTopWorld) {
  const position = POSITION_MAP[positionCode] || 'MID';
  const base = { ...BASE_STATS[position] };

  // Age modifier: peak 25-30, decline after 33
  let ageMod = 1.0;
  if (age < 20) ageMod = 0.85 + (age - 16) * 0.03;
  else if (age <= 30) ageMod = 1.0;
  else if (age <= 33) ageMod = 1.0 - (age - 30) * 0.02;
  else ageMod = 0.94 - (age - 33) * 0.03;
  ageMod = Math.max(0.6, Math.min(1.0, ageMod));

  // Apply characteristic boosts
  if (char1 >= 0 && char1 <= 13) {
    const charName = CHARACTERISTICS[char1];
    if (charName && base[charName] !== undefined) base[charName] += CHAR_BOOST;
  }
  if (char2 >= 0 && char2 <= 13) {
    const charName = CHARACTERISTICS[char2];
    if (charName && base[charName] !== undefined) base[charName] += CHAR_BOOST;
  }

  // Star and top world bonuses
  if (isStar) {
    Object.keys(base).forEach(k => base[k] = Math.min(99, base[k] + 5));
  }
  if (isTopWorld) {
    Object.keys(base).forEach(k => base[k] = Math.min(99, base[k] + 8));
  }

  // Apply age modifier
  Object.keys(base).forEach(k => base[k] = Math.round(base[k] * ageMod));

  // Map characteristics to FIFA-style stats
  const stats = {
    pace: Math.min(99, Math.max(30, Math.round((base.velocidade + base.resistencia) / 2))),
    shooting: Math.min(99, Math.max(20, Math.round((base.finalizacao + base.cabeceio) / 2))),
    passing: Math.min(99, Math.max(25, Math.round((base.passe + base.armacao + base.cruzamento) / 3))),
    dribbling: Math.min(99, Math.max(25, Math.round((base.drible + base.colocacao) / 2))),
    defending: Math.min(99, Math.max(20, Math.round((base.marcacao + base.desarme + base.colocacao) / 3))),
    physical: Math.min(99, Math.max(30, Math.round((base.resistencia + base.cabeceio) / 2))),
    stamina: Math.min(99, Math.max(35, base.resistencia)),
  };

  // GK-specific: use reflexo, defesa_penalti, saida_gol
  if (position === 'GK') {
    stats.defending = Math.min(99, Math.max(30, Math.round((base.reflexo + base.defesa_penalti + base.saida_gol + base.colocacao) / 4)));
    stats.physical = Math.min(99, Math.max(30, Math.round((base.colocacao + base.reflexo) / 2)));
  }

  // Overall based on position-relevant stats
  let overall;
  if (position === 'GK') {
    overall = Math.round((stats.defending * 0.4 + stats.physical * 0.3 + stats.stamina * 0.3));
  } else if (position === 'DEF') {
    overall = Math.round((stats.defending * 0.4 + stats.physical * 0.25 + stats.pace * 0.15 + stats.passing * 0.2));
  } else if (position === 'MID') {
    overall = Math.round((stats.passing * 0.3 + stats.dribbling * 0.25 + stats.stamina * 0.2 + stats.shooting * 0.15 + stats.defending * 0.1));
  } else {
    overall = Math.round((stats.shooting * 0.35 + stats.pace * 0.25 + stats.dribbling * 0.2 + stats.physical * 0.1 + stats.passing * 0.1));
  }

  overall = Math.min(99, Math.max(40, overall));

  return {
    position,
    position_name: POSITION_NAMES[positionCode] || position,
    overall,
    ...stats,
    characteristics: {
      primary: CHARACTERISTICS[char1] || 'nenhuma',
      secondary: CHARACTERISTICS[char2] || 'nenhuma',
    },
  };
}

function parseBanFile(filepath) {
  const data = fs.readFileSync(filepath);
  if (data[0] !== 0xac || data[1] !== 0xed) return null;

  const xps = [];
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0x78 && data[i + 1] === 0x70) xps.push(i);
  }
  if (xps.length < 2) return null;

  const srTeam = findBytes(data, [0x73, 0x72]);
  if (srTeam === -1) return null;

  let classDescStart = srTeam + 2;
  if (data[classDescStart] === 0x74) { classDescStart += 3 + data.readUInt16BE(classDescStart + 1); }
  classDescStart += 8;

  const teamFields = extractFieldsFromClassDescriptor(data, classDescStart, xps[0]);
  if (teamFields.length === 0) return null;

  let pos = xps[0] + 2;
  const teamData = {};
  for (const field of teamFields) {
    const result = readFieldValue(data, pos, field);
    teamData[field.name] = result.value;
    pos = result.pos;
  }

  const { strings: extraStrings, pos: afterStrings } = readExtraStrings(data, pos, 5);
  const name = teamData.m || teamData.name || extraStrings[0] || null;
  if (!name) return null;

  const arrPos = findBytes(data, [0x77, 0x04], afterStrings);
  if (arrPos === -1) return null;
  const playerCount = data.readUInt32BE(arrPos + 2);

  const srPlayer = findBytes(data, [0x73, 0x72, 0x00, 0x03, 0x65, 0x2e, 0x67], arrPos);
  if (srPlayer === -1) return null;
  const xpPlayer = findBytes(data, [0x78, 0x70], srPlayer);
  if (xpPlayer === -1) return null;

  let playerClassStart = srPlayer + 2;
  if (data[playerClassStart] === 0x74) { playerClassStart += 3 + data.readUInt16BE(playerClassStart + 1); }
  playerClassStart += 8;

  const playerFields = extractFieldsFromClassDescriptor(data, playerClassStart, xpPlayer);
  if (playerFields.length === 0) return null;

  let playerPos = xpPlayer + 2;
  const players = [];

  for (let i = 0; i < playerCount; i++) {
    if (playerPos < data.length && data[playerPos] === 0x73 && data[playerPos + 1] === 0x71) { playerPos += 6; }
    else if (playerPos < data.length && data[playerPos] === 0x73 && data[playerPos + 1] === 0x72) {
      const xpP = findBytes(data, [0x78, 0x70], playerPos);
      if (xpP === -1) break;
      playerPos = xpP + 2;
    }

    const playerData = {};
    for (const field of playerFields) {
      const result = readFieldValue(data, playerPos, field);
      playerData[field.name] = result.value;
      playerPos = result.pos;
    }

    if (!playerData.a) continue;

    // Correct field mapping:
    // a = nome, b = estrela, c = pais, d = idade, e = posicao
    // f = titular, g = caracteristica[0], h = caracteristica[1]
    // i = lado, j = top_mundial
    // NOTE: fields e=0(GK), f=0(not starter), g=0/h=0 are valid values
    // so we must NOT use || which treats 0 as falsy
    const age = playerData.d != null ? playerData.d : 25;
    const positionCode = playerData.e != null ? playerData.e : 3;
    const char1 = playerData.g != null ? playerData.g : 0;
    const char2 = playerData.h != null ? playerData.h : 0;
    const isStar = playerData.b === true;
    const isTopWorld = playerData.j === true;
    const isStarter = playerData.f === 1 || playerData.f === true;
    const isCaptain = playerData.b === true; // estrela = captain

    const stats = generatePlayerStats(age, positionCode, char1, char2, isStar, isTopWorld);

    players.push({
      name: playerData.a,
      ...stats,
      age,
      country: playerData.c || 0,
      side: playerData.i || 0,
      is_starter: isStarter ? 1 : 0,
      is_captain: isCaptain ? 1 : 0,
      is_star: isStar ? 1 : 0,
      is_top_world: isTopWorld ? 1 : 0,
    });
  }

  // Auto-assign starters for teams that don't have any marked
  const totalStarters = players.filter(p => p.is_starter).length;
  if (totalStarters === 0 && players.length > 0) {
    // Sort by overall descending and pick best 11
    const sorted = [...players].sort((a, b) => b.overall - a.overall);
    const starters = sorted.slice(0, Math.min(11, players.length));
    starters.forEach(p => p.is_starter = 1);
    if (starters.length > 0) starters[0].is_captain = 1;
  }

  // Calculate team strengths from player stats
  const defPlayers = players.filter(p => p.position === 'DEF');
  const midPlayers = players.filter(p => p.position === 'MID');
  const fwdPlayers = players.filter(p => p.position === 'FWD');

  const attackStrength = fwdPlayers.length ? Math.min(99, Math.max(30, Math.round(fwdPlayers.reduce((s, p) => s + p.shooting, 0) / fwdPlayers.length))) : 50;
  const midfieldStrength = midPlayers.length ? Math.min(99, Math.max(30, Math.round(midPlayers.reduce((s, p) => s + p.passing, 0) / midPlayers.length))) : 50;
  const defenseStrength = defPlayers.length ? Math.min(99, Math.max(30, Math.round(defPlayers.reduce((s, p) => s + p.defending, 0) / defPlayers.length))) : 50;
  const overallStrength = Math.round((attackStrength + midfieldStrength + defenseStrength) / 3);

  return {
    name,
    short_name: teamData.k || teamData.short_name || extraStrings[1] || name.substring(0, 3).toUpperCase(),
    stadium: teamData.stadium || extraStrings[2] || '',
    coach: teamData.coach || extraStrings[3] || '',
    colors: { primary: teamData.cor1 || '#000000', secondary: teamData.cor2 || '#ffffff' },
    attack_strength: attackStrength,
    midfield_strength: midfieldStrength,
    defense_strength: defenseStrength,
    overall_strength: overallStrength,
    players,
  };
}

function parseAllBanFiles(directory) {
  const teams = [];
  if (!fs.existsSync(directory)) return teams;
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.ban'));
  for (const filename of files) {
    try {
      const team = parseBanFile(path.join(directory, filename));
      if (team) teams.push(team);
    } catch (e) { /* skip */ }
  }
  return teams;
}

module.exports = { parseBanFile, parseAllBanFiles, CHARACTERISTICS, POSITION_MAP, POSITION_NAMES };
