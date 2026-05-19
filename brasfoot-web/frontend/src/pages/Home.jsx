import { Link } from 'react-router-dom';

function Home() {
  return (
    <div>
      <h1>EBL BrasFoot</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
        Gerencie sua liga de futebol online! Monte times, crie campeonatos e simule partidas com narração.
      </p>

      <div className="grid grid-3">
        <Link to="/teams" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>👥 Times</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Gerencie seus times, jogadores e forças
          </p>
        </Link>

        <Link to="/championships" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>🏆 Campeonatos</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Crie ligas e torneios com seus times
          </p>
        </Link>

        <Link to="/matches" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>⚽ Partidas</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Simule jogos com narração em tempo real
          </p>
        </Link>

        <Link to="/import" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>📥 Importar Times</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Importe times de arquivos JSON
          </p>
        </Link>
      </div>
    </div>
  );
}

export default Home;
