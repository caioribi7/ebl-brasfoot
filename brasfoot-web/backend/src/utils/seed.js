const { initDatabase } = require('../database');
const { importTeamsFromJSON } = require('../services/teamImporter');
const { parseAllBanFiles } = require('../services/banParser');
const path = require('path');

async function seed() {
  console.log('Inicializando banco de dados...');
  await initDatabase();

  const banFolder = path.join(__dirname, '..', '..', '..', '..', 'teams');
  console.log(`Escaneando pasta: ${banFolder}\n`);

  const fs = require('fs');
  const files = fs.readdirSync(banFolder).filter(f => f.endsWith('.ban'));
  const total = files.length;
  console.log(`Encontrados ${total} arquivos .ban\n`);

  // Parse with progress bar
  const teams = [];
  const barWidth = 40;

  for (let i = 0; i < files.length; i++) {
    try {
      const team = require('../services/banParser').parseBanFile(path.join(banFolder, files[i]));
      if (team) teams.push(team);
    } catch (e) { /* skip */ }

    const progress = (i + 1) / total;
    const filled = Math.round(barWidth * progress);
    const empty = barWidth - filled;
    const pct = Math.round(progress * 100);
    process.stdout.write(`\rImportando [${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}% (${i + 1}/${total})`);
  }

  console.log(`\n\n${teams.length} times encontrados`);
  const totalPlayers = teams.reduce((s, t) => s + t.players.length, 0);
  console.log(`${totalPlayers} jogadores no total\n`);

  if (teams.length > 0) {
    process.stdout.write('Salvando no banco... ');
    const imported = importTeamsFromJSON(teams);
    console.log(`${imported.length} times salvos!\n`);

    // Show top 10
    console.log('Top 10 times por força:');
    teams.sort((a, b) => b.overall_strength - a.overall_strength).slice(0, 10).forEach((t, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${t.name.padEnd(25)} OVE:${t.overall_strength} ATA:${t.attack_strength} MEI:${t.midfield_strength} DEF:${t.defense_strength} Jog:${t.players.length}`);
    });
  }
}

seed();
