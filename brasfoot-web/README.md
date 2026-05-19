# EBL BrasFoot

Jogo de futebol web inspirado no BrasFoot, com simulação de partidas em tempo real, narração, campeonatos e sistema de táticas.

## Funcionalidades

- **Importação de Times .ban**: Leia diretamente os arquivos `.ban` do BrasFoot (formato Java serialization)
- **Importação em Massa**: Importe todos os times de uma pasta de uma vez
- **Táticas e Escalações**: 5 formações (4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 5-3-2), mentalidade, pressão, amplitude e profundidade
- **Campeonatos**: Ligas com pontos corridos e geração automática de rodadas
- **Simulação ao Vivo**: Partidas de 3 minutos com narração via Server-Sent Events
- **Simulação Rápida**: Resultado instantâneo para simular rodadas inteiras
- **Narração Completa**: Gols, cartões, pênaltis, escanteios, impedimentos, contra-ataques
- **Força dos Times**: Resultados baseados nas características dos jogadores escalados

## Instalação

```bash
# Backend
cd brasfoot-web/backend
npm install
npm run seed       # Importa todos os .ban da pasta teams/
npm run dev        # Porta 3001

# Frontend (outro terminal)
cd brasfoot-web/frontend
npm install
npm run dev        # Porta 3000
```

Acesse `http://localhost:3000`

## Parser de Arquivos .ban

O sistema lê o formato de serialização Java dos arquivos `.ban` do BrasFoot, extraindo:
- Nome do time, estádio, técnico, cores
- Lista completa de jogadores com posição e atributos
- Força do time calculada a partir dos jogadores

## Estrutura

```
brasfoot-web/
├── backend/src/
│   ├── services/
│   │   ├── banParser.js      # Parser de arquivos .ban
│   │   ├── matchEngine.js    # Motor de simulação
│   │   └── teamImporter.js   # Importação para SQLite
│   ├── routes/               # API REST
│   └── database.js           # SQLite (sql.js)
└── frontend/src/
    ├── pages/                # Páginas React
    └── styles/               # CSS tema escuro
```

## API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/teams` | GET | Lista times |
| `/api/teams/:id/tactics` | PUT | Atualiza táticas |
| `/api/teams/:id/lineup` | PUT | Atualiza escalação |
| `/api/championships` | POST | Cria campeonato |
| `/api/championships/:id/simulate-round` | POST | Simula rodada |
| `/api/matches/:id/simulate` | POST | Simulação rápida |
| `/api/matches/:id/live` | GET | Simulação ao vivo (SSE) |
| `/api/import/import-ban-folder` | POST | Importa pasta .ban |
