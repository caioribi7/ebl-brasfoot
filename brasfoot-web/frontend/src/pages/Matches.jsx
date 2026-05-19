import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Matches() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newMatch, setNewMatch] = useState({ home_team_id: '', away_team_id: '' });
  const [simulating, setSimulating] = useState(null);
  const [homeSearch, setHomeSearch] = useState('');
  const [awaySearch, setAwaySearch] = useState('');
  const [showHomeList, setShowHomeList] = useState(false);
  const [showAwayList, setShowAwayList] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    const [matchesData, teamsData] = await Promise.all([
      fetch('/api/matches').then(res => res.json()),
      fetch('/api/teams').then(res => res.json())
    ]);
    setMatches(matchesData);
    setTeams(teamsData);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newMatch.home_team_id || !newMatch.away_team_id) return;

    await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMatch)
    });

    await loadMatches();
    setShowForm(false);
    setNewMatch({ home_team_id: '', away_team_id: '' });
  };

  const handleSimulate = async (matchId) => {
    setSimulating(matchId);
    await fetch(`/api/matches/${matchId}/simulate`, { method: 'POST' });
    await loadMatches();
    setSimulating(null);
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>;

  const pendingMatches = matches.filter(m => m.status === 'pending');
  const finishedMatches = matches.filter(m => m.status === 'finished');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Partidas</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + Nova Partida
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Criar Partida Amistosa</h2>
          <div className="grid grid-2">
            <div className="form-group">
              <label>Time da Casa</label>
              <input type="text" placeholder="Buscar time..." value={homeSearch}
                onChange={e => { setHomeSearch(e.target.value); setShowHomeList(true); }}
                onFocus={() => setShowHomeList(true)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}
              />
              {showHomeList && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '5px', background: 'var(--bg-card)' }}>
                  {teams.filter(t => t.name.toLowerCase().includes(homeSearch.toLowerCase())).slice(0, 20).map(t => (
                    <div key={t.id}
                      onClick={() => { setNewMatch({ ...newMatch, home_team_id: t.id }); setHomeSearch(t.name); setShowHomeList(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', background: newMatch.home_team_id === t.id ? 'rgba(76, 175, 80, 0.2)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                      {t.name} <span style={{ color: 'var(--text-muted)' }}>(FOR: {t.overall_strength})</span>
                    </div>
                  ))}
                  {teams.filter(t => t.name.toLowerCase().includes(homeSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Nenhum time encontrado</div>
                  )}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Time Visitante</label>
              <input type="text" placeholder="Buscar time..." value={awaySearch}
                onChange={e => { setAwaySearch(e.target.value); setShowAwayList(true); }}
                onFocus={() => setShowAwayList(true)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}
              />
              {showAwayList && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '5px', background: 'var(--bg-card)' }}>
                  {teams.filter(t => t.name.toLowerCase().includes(awaySearch.toLowerCase())).slice(0, 20).map(t => (
                    <div key={t.id}
                      onClick={() => { setNewMatch({ ...newMatch, away_team_id: t.id }); setAwaySearch(t.name); setShowAwayList(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', background: newMatch.away_team_id === t.id ? 'rgba(76, 175, 80, 0.2)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                      {t.name} <span style={{ color: 'var(--text-muted)' }}>(FOR: {t.overall_strength})</span>
                    </div>
                  ))}
                  {teams.filter(t => t.name.toLowerCase().includes(awaySearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Nenhum time encontrado</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-success" onClick={handleCreate} disabled={!newMatch.home_team_id || !newMatch.away_team_id}>
            Criar Partida
          </button>
        </div>
      )}

      {pendingMatches.length > 0 && (
        <div>
          <h2>Pendentes</h2>
          {pendingMatches.map(match => (
            <div key={match.id} className="match-card">
              <div className="match-score">
                <div className="match-team">
                  <div className="match-team-name">{match.home_team_name}</div>
                  <small style={{ color: 'var(--text-muted)' }}>FOR: {match.home_team_id ? teams.find(t => t.id === match.home_team_id)?.overall_strength || '?' : '?'}</small>
                </div>
                <div className="match-score-value" style={{ color: 'var(--text-muted)' }}>vs</div>
                <div className="match-team">
                  <div className="match-team-name">{match.away_team_name}</div>
                  <small style={{ color: 'var(--text-muted)' }}>FOR: {match.away_team_id ? teams.find(t => t.id === match.away_team_id)?.overall_strength || '?' : '?'}</small>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button className="btn btn-primary" onClick={() => handleSimulate(match.id)} disabled={simulating === match.id}>
                  {simulating === match.id ? 'Simulando...' : '⚡ Simular Rápido'}
                </button>
                <Link to={`/matches/${match.id}/live`} className="btn btn-success">
                  ▶ Ao Vivo (3 min)
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {finishedMatches.length > 0 && (
        <div>
          <h2>Encerradas</h2>
          {finishedMatches.map(match => (
            <div key={match.id} className="match-card">
              <div className="match-score">
                <div className="match-team">
                  <div className="match-team-name">{match.home_team_name}</div>
                </div>
                <div className="match-score-value">
                  {match.home_score} - {match.away_score}
                </div>
                <div className="match-team">
                  <div className="match-team-name">{match.away_team_name}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '15px' }}>
                <Link to={`/matches/${match.id}/live`} className="btn btn-secondary">
                  📋 Ver Narração
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {matches.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>Nenhuma partida criada ainda.</p>
      )}
    </div>
  );
}

export default Matches;
