const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const teamsRouter = require('./routes/teams');
const championshipsRouter = require('./routes/championships');
const matchesRouter = require('./routes/matches');
const importRouter = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3001;

async function start() {
  await initDatabase();
  console.log('Database initialized');

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'dist')));

  app.use('/api/teams', teamsRouter);
  app.use('/api/championships', championshipsRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/import', importRouter);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`EBL BrasFoot Backend rodando na porta ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
