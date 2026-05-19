const { prepare, transaction } = require('../db-wrapper');
const { v4: uuidv4 } = require('uuid');

function importTeamsFromJSON(jsonData) {
  const teams = Array.isArray(jsonData) ? jsonData : [jsonData];
  const imported = [];

  const insertTeam = prepare(`
    INSERT OR REPLACE INTO teams (id, name, short_name, logo, overall_strength, attack_strength, midfield_strength, defense_strength)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPlayer = prepare(`
    INSERT OR REPLACE INTO players (id, team_id, name, position, position_name, overall, pace, shooting, passing, dribbling, defending, physical, stamina, age, country, side, is_starter, is_captain, is_star, is_top_world, char_primary, char_secondary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTactic = prepare(`
    INSERT OR IGNORE INTO tactics (id, team_id, formation, mentality, pressing, width, depth)
    VALUES (?, ?, '4-4-2', 'balanced', 50, 50, 50)
  `);

  transaction(() => {
    for (const teamData of teams) {
      const teamId = teamData.id || uuidv4();

      const attack = teamData.attack || teamData.attack_strength || 50;
      const midfield = teamData.midfield || teamData.midfield_strength || 50;
      const defense = teamData.defense || teamData.defense_strength || 50;
      const overall = teamData.overall || teamData.strength || Math.round((attack + midfield + defense) / 3);

      insertTeam.run(
        teamId,
        teamData.name,
        teamData.short_name || teamData.name.substring(0, 3).toUpperCase(),
        teamData.logo || null,
        overall,
        attack,
        midfield,
        defense
      );

      if (teamData.players && Array.isArray(teamData.players)) {
        for (const player of teamData.players) {
          const playerId = player.id || uuidv4();
          const chars = player.characteristics || {};
          insertPlayer.run(
            playerId,
            teamId,
            player.name,
            player.position || 'MID',
            player.position_name || player.position || 'MID',
            player.overall || 50,
            player.pace || 50,
            player.shooting || 50,
            player.passing || 50,
            player.dribbling || 50,
            player.defending || 50,
            player.physical || 50,
            player.stamina || 50,
            player.age || 25,
            player.country || 0,
            player.side || 0,
            player.is_starter || 0,
            player.is_captain || 0,
            player.is_star || 0,
            player.is_top_world || 0,
            chars.primary || '',
            chars.secondary || '',
          );
        }
      }

      insertTactic.run(uuidv4(), teamId);
      imported.push(teamId);
    }
  });

  return imported;
}

function importTeamFile(filePath) {
  const fs = require('fs');
  const data = fs.readFileSync(filePath, 'utf8');
  const jsonData = JSON.parse(data);
  return importTeamsFromJSON(jsonData);
}

module.exports = { importTeamsFromJSON, importTeamFile };
