const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importTeamsFromJSON } = require('../services/teamImporter');
const { parseBanFile, parseAllBanFiles } = require('../services/banParser');
const path = require('path');
const fs = require('fs');
const os = require('os');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/import', upload.single('file'), (req, res) => {
  try {
    const filename = req.file.originalname.toLowerCase();
    let imported;

    if (filename.endsWith('.ban')) {
      const tmpPath = path.join(os.tmpdir(), 'upload-' + Date.now() + '.ban');
      fs.writeFileSync(tmpPath, req.file.buffer);
      const team = parseBanFile(tmpPath);
      fs.unlinkSync(tmpPath);
      if (!team) throw new Error('Não foi possível ler o arquivo .ban');
      imported = importTeamsFromJSON([team]);
    } else {
      const jsonData = JSON.parse(req.file.buffer.toString('utf8'));
      imported = importTeamsFromJSON(jsonData);
    }

    res.json({ success: true, imported, count: imported.length });
  } catch (error) {
    res.status(400).json({ error: 'Erro ao importar arquivo: ' + error.message });
  }
});

router.post('/import-json', (req, res) => {
  try {
    const jsonData = req.body;
    const imported = importTeamsFromJSON(jsonData);
    res.json({ success: true, imported, count: imported.length });
  } catch (error) {
    res.status(400).json({ error: 'Erro ao importar JSON: ' + error.message });
  }
});

router.post('/import-ban-folder', (req, res) => {
  try {
    const { folder } = req.body;
    const folderPath = folder || '/home/caio/Documentos/ebl-brasfoot/teams';
    const teams = parseAllBanFiles(folderPath);
    if (teams.length === 0) {
      return res.status(400).json({ error: 'Nenhum time encontrado na pasta' });
    }
    const imported = importTeamsFromJSON(teams);
    res.json({ success: true, imported, count: imported.length });
  } catch (error) {
    res.status(400).json({ error: 'Erro ao importar pasta .ban: ' + error.message });
  }
});

module.exports = router;
