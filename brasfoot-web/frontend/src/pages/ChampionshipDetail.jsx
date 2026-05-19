import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

function BracketView({ rounds, finished, winnerName }) {
  if (!rounds || rounds.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto', padding: '20px 0' }}>
      {finished && winnerName && (
        <div className="card" style={{ borderColor: 'var(--success)', marginBottom: '20px', textAlign: 'center', padding: '15px', maxWidth: '400px', margin: '0 auto 20px' }}>
          <h2 style={{ color: 'var(--success)', margin: 0 }}>\uD83C\uDFC6 {winnerName}</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)' }}>Campe\u00e3o!</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', minWidth: rounds.length * 240 }}>
        {rounds.map((round, ri) => (
          <div key={ri} style={{ flex: '0 0 auto', width: '220px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '0.9rem', marginBottom: '12px', color: 'var(--secondary)' }}>{round.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${Math.max(8, 40 / (ri + 1))}px` }}>
              {round.matches.map((match, mi) => {
                const isHomeWinner = match.status === 'finished' && match.winner_team_id === match.home_team_id;
                const isAwayWinner = match.status === 'finished' && match.winner_team_id === match.away_team_id;
                const played = match.status === 'finished';
                return (
                  <div key={match.id} className="card" style={{ padding: '10px', borderLeft: `4px solid ${played ? 'var(--success)' : 'var(--border)'}`, background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontWeight: isHomeWinner ? 'bold' : 'normal', color: isHomeWinner ? 'var(--success)' : 'var(--text)' }}>
                      <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {played && isHomeWinner ? '\u2713 ' : ''}{match.home_team_name || '---'}
                      </span>
                      {played && <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>{match.home_score}</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontWeight: isAwayWinner ? 'bold' : 'normal', color: isAwayWinner ? 'var(--success)' : 'var(--text)' }}>
                      <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {played && isAwayWinner ? '\u2713 ' : ''}{match.away_team_name || '---'}
                      </span>
                      {played && <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>{match.away_score}</span>}
                    </div>
                    {!played && (
                      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '3px 0' }}>vs</div>
                    )}
                    {played && (
                      <Link to={`/matches/${match.id}/live`} style={{ display: 'block', textAlign: 'center', fontSize: '0.7rem', color: 'var(--secondary)', marginTop: '4px', textDecoration: 'none' }}>
                        Ver detalhes \u2192
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChampionshipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [championship, setChampionship] = useState(null);
  const [standings, setStandings] = useState([]);
  const [matches, setMatches] = useState([]);
  const [bracket, setBracket] = useState({ rounds: [] });
  const [topScorers, setTopScorers] = useState([]);
  const [topRatings, setTopRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState('bracket');
  const [searchTeam, setSearchTeam] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const champ = await fetch(`/api/championships/${id}`).then(r => r.json());
      setChampionship(champ);

      if (champ.type === 'cup') {
        const bracketData = await fetch(`/api/championships/${id}/bracket`).then(r => r.json());
        setBracket(bracketData);
      }

      const [standingsData, matchesData] = await Promise.all([
        fetch(`/api/championships/${id}/standings`).then(r => r.json()),
        fetch(`/api/championships/${id}/matches`).then(r => r.json())
      ]);
      setStandings(standingsData);
      setMatches(matchesData);
    } catch (e) {
      console.error('Erro ao carregar campeonato:', e);
    }
    setLoading(false);

    Promise.all([
      fetch(`/api/championships/${id}/top-scorers`).then(r => r.json()),
      fetch(`/api/championships/${id}/top-ratings`).then(r => r.json())
    ]).then(([scorers, ratings]) => {
      setTopScorers(scorers);
      setTopRatings(ratings);
    }).catch(() => {});
  };

  const handleSimulateRound = async () => {
    setSimulating(true);
    try {
      await fetch(`/api/championships/${id}/simulate-round`, { method: 'POST' });
    } catch (e) { /* ignore */ }
    await loadData();
    setSimulating(false);
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>;
  if (!championship) return <p>Campeonato n\u00e3o encontrado</p>;

  const isCup = championship.type === 'cup';
  const currentRoundMatches = matches.filter(m => m.round === championship.current_round);
  const pendingInRound = currentRoundMatches.filter(m => m.status === 'pending');
  const canSimulate = championship.status !== 'finished' && pendingInRound.length > 0;

  const filteredStandings = standings.filter(t =>
    t.team_name && t.team_name.toLowerCase().includes(searchTeam.toLowerCase())
  );

  const config = championship.config ? (typeof championship.config === 'string' ? JSON.parse(championship.config) : championship.config) : {};

  return (
    <div>
      <h1>{championship.name}</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span className={`badge ${championship.status === 'finished' ? 'badge-success' : 'badge-info'}`}>
          {championship.status === 'pending' ? 'Pendente' : championship.status === 'live' ? 'Em Andamento' : 'Finalizado'}
        </span>
        <span className="badge badge-info">
          {isCup ? `${bracket.rounds?.[championship.current_round - 1]?.name || ''}` : `Rodada ${championship.current_round}/${championship.total_rounds}`}
        </span>
        {isCup && config.numTeams && (
          <span className="badge badge-info">{config.numTeams} times</span>
        )}
      </div>

      {canSimulate && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={handleSimulateRound} disabled={simulating}>
            {simulating ? 'Simulando...' : `\u26A1 Simular ${isCup ? (bracket.rounds?.[championship.current_round - 1]?.name || `Rodada ${championship.current_round}`) : `Rodada ${championship.current_round}`}`}
          </button>
          <button className="btn btn-warning" onClick={() => navigate(`/championships/${id}/live-round`)}>
            ▶ Rodada Ao Vivo
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className={`btn ${activeTab === 'bracket' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('bracket')}>
          {isCup ? 'Chave' : 'Classifica\u00e7\u00e3o'}
        </button>
        {!isCup && (
          <button className={`btn ${activeTab === 'standings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('standings')}>
            Classifica\u00e7\u00e3o
          </button>
        )}
        <button className={`btn ${activeTab === 'matches' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('matches')}>
          {isCup ? 'Partidas' : `Rodada ${championship.current_round}`}
        </button>
        <button className={`btn ${activeTab === 'scorers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('scorers')}>
          Artilheiros
        </button>
        <button className={`btn ${activeTab === 'ratings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('ratings')}>
          Melhores Notas
        </button>
      </div>

      {activeTab === 'bracket' && isCup && (
        <div className="card">
          <h2>Chaveamento</h2>
          <BracketView
            rounds={bracket.rounds || []}
            finished={championship.status === 'finished'}
            winnerName={standings.length > 0 && championship.status === 'finished' ? standings[0].team_name : null}
          />
        </div>
      )}

      {activeTab === 'standings' && !isCup && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2>Classifica\u00e7\u00e3o</h2>
            <input
              type="text" placeholder="Buscar time..."
              value={searchTeam} onChange={e => setSearchTeam(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', maxWidth: '250px' }}
            />
          </div>
          {filteredStandings.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum time cadastrado.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th>
                </tr>
              </thead>
              <tbody>
                {filteredStandings.map((team, index) => (
                  <tr key={team.team_id} style={{
                    background: index < 4 ? 'rgba(76, 175, 80, 0.1)' : index >= standings.length - 2 ? 'rgba(244, 67, 54, 0.1)' : 'transparent',
                    fontWeight: standings[0]?.team_id === team.team_id && championship.status === 'finished' ? 'bold' : 'normal'
                  }}>
                    <td style={{ fontWeight: 'bold', color: index < 4 ? 'var(--success)' : index >= standings.length - 2 ? 'var(--danger)' : 'inherit' }}>
                      {index + 1}{index === 0 && championship.status === 'finished' ? ' \uD83C\uDFC6' : ''}
                    </td>
                    <td><Link to={`/teams/${team.team_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{team.team_name}</Link></td>
                    <td style={{ fontWeight: 'bold', color: 'var(--secondary)' }}>{team.points}</td>
                    <td>{team.wins + team.draws + team.losses}</td>
                    <td>{team.wins}</td><td>{team.draws}</td><td>{team.losses}</td>
                    <td>{team.goals_for}</td><td>{team.goals_against}</td>
                    <td>{team.goals_for - team.goals_against}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="card">
          <h2>{isCup ? 'Partidas' : `Rodada ${championship.current_round}`}</h2>
          {matches.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma partida.</p>
          ) : (
            [...new Set(matches.map(m => m.round))].map(r => (
              <div key={r} style={{ marginBottom: '20px' }}>
                <h3 style={{ color: 'var(--secondary)', fontSize: '0.9rem', marginBottom: '10px' }}>
                  {isCup ? (bracket.rounds?.[r - 1]?.name || `Rodada ${r}`) : `Rodada ${r}`}
                </h3>
                {matches.filter(m => m.round === r).map(match => (
                  <div key={match.id} className="match-card">
                    <div className="match-score">
                      <div className="match-team">
                        <div className="match-team-name">{match.home_team_name}</div>
                      </div>
                      <div className="match-score-value">
                        {match.status !== 'pending' ? `${match.home_score} - ${match.away_score}` : 'vs'}
                      </div>
                      <div className="match-team">
                        <div className="match-team-name">{match.away_team_name}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                      <span className={`badge ${match.status === 'finished' ? 'badge-success' : match.status === 'live' ? 'badge-warning' : 'badge-info'}`}>
                        {match.status === 'pending' ? 'Pendente' : match.status === 'live' ? 'Ao Vivo' : 'Finalizado'}
                      </span>
                      {match.status === 'finished' && (
                        <Link to={`/matches/${match.id}/live`} className="btn btn-secondary" style={{ marginLeft: '10px', padding: '4px 12px', fontSize: '0.8rem' }}>
                          Ver
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'scorers' && (
        <div className="card">
          <h2>Artilheiros</h2>
          {topScorers.length > 0 ? (
            <table>
              <thead>
                <tr><th>#</th><th>Jogador</th><th>Time</th><th>Gols</th><th>Assist.</th><th>M\u00e9dia</th></tr>
              </thead>
              <tbody>
                {topScorers.map((p, i) => (
                  <tr key={p.player_id}>
                    <td style={{ fontWeight: 'bold' }}>{i + 1}</td>
                    <td>{p.player_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.team_name}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{p.total_goals}</td>
                    <td>{p.total_assists}</td>
                    <td>{p.avg_rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum gol marcado ainda.</p>
          )}
        </div>
      )}

      {activeTab === 'ratings' && (
        <div className="card">
          <h2>Melhores Notas</h2>
          {topRatings.length > 0 ? (
            <table>
              <thead>
                <tr><th>#</th><th>Jogador</th><th>Time</th><th>M\u00e9dia</th><th>Gols</th><th>Assist.</th><th>Jogos</th></tr>
              </thead>
              <tbody>
                {topRatings.map((p, i) => (
                  <tr key={p.player_id}>
                    <td style={{ fontWeight: 'bold' }}>{i + 1}</td>
                    <td>{p.player_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.team_name}</td>
                    <td style={{ fontWeight: 'bold', color: p.avg_rating >= 8 ? 'var(--success)' : p.avg_rating >= 7 ? 'var(--warning)' : 'var(--text)' }}>{p.avg_rating}</td>
                    <td>{p.total_goals}</td>
                    <td>{p.total_assists}</td>
                    <td>{p.matches_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma partida realizada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ChampionshipDetail;