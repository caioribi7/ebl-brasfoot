import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Championships() {
  const [championships, setChampionships] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newChamp, setNewChamp] = useState({ name: '', type: 'league', config: {}, teams: [] });
  const [teamSearch, setTeamSearch] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/championships').then(res => res.json()),
      fetch('/api/teams').then(res => res.json())
    ]).then(([champData, teamsData]) => {
      setChampionships(champData);
      setTeams(teamsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newChamp.name || newChamp.teams.length < 2) return;

    await fetch('/api/championships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newChamp)
    });

    const updated = await fetch('/api/championships').then(res => res.json());
    setChampionships(updated);
    setShowForm(false);
    setNewChamp({ name: '', type: 'league', config: {}, teams: [] });
    setTeamSearch('');
  };

  const toggleTeam = (teamId) => {
    setNewChamp(prev => ({
      ...prev,
      teams: prev.teams.includes(teamId) ? prev.teams.filter(id => id !== teamId) : [...prev.teams, teamId]
    }));
  };

  const isPowerOf2 = (n) => n > 0 && (n & (n - 1)) === 0;

  if (loading) return <p>Carregando...</p>;

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const cupOptions = [4, 8, 16, 32];
  const numTeams = newChamp.config?.numTeams || 8;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Campeonatos</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + Novo Campeonato
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Criar Campeonato</h2>
          <div className="form-group">
            <label>Nome</label>
            <input type="text" value={newChamp.name} onChange={e => setNewChamp({ ...newChamp, name: e.target.value })} placeholder="Ex: Brasileirão 2024" />
          </div>

          <div className="form-group">
            <label>Tipo</label>
            <select value={newChamp.type} onChange={e => setNewChamp({ ...newChamp, type: e.target.value, config: e.target.value === 'cup' ? { numTeams: 8 } : {} })}>
              <option value="league">Liga (Pontos Corridos)</option>
              <option value="cup">Copa (Mata-Mata)</option>
            </select>
          </div>

          {newChamp.type === 'cup' && (
            <>
              <div className="form-group">
                <label>Formato da Copa</label>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  {cupOptions.map(n => (
                    <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px 16px', background: numTeams === n ? 'rgba(76, 175, 80, 0.2)' : 'var(--bg-input)', borderRadius: '6px', border: `2px solid ${numTeams === n ? 'var(--success)' : 'var(--border)'}` }}>
                      <input type="radio" name="numTeams" checked={numTeams === n} onChange={() => setNewChamp({ ...newChamp, config: { ...newChamp.config, numTeams: n } })} />
                      <strong>{n} times</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {n === 4 ? '2 fases' : n === 8 ? '3 fases' : n === 16 ? '4 fases' : '5 fases'}
                      </span>
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  {newChamp.teams.length < numTeams
                    ? `Selecione pelo menos ${numTeams} times para participar`
                    : `${numTeams} melhores times classificados entram na copa`}
                </p>
              </div>

              <div className="form-group">
                <label>Pênaltis em caso de empate</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={true} disabled />
                    Pênaltis (sempre ativo)
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>
              Times selecionados: {newChamp.teams.length}
              {newChamp.type === 'cup' && numTeams ? ` (${Math.min(newChamp.teams.length, numTeams)} entram)` : ''}
            </label>
            <input type="text" placeholder="Buscar time..." value={teamSearch}
              onChange={e => setTeamSearch(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%', marginBottom: '10px' }}
            />
            <div className="grid grid-3">
              {filteredTeams.map(team => (
                <div key={team.id} onClick={() => toggleTeam(team.id)} style={{ padding: '10px', background: newChamp.teams.includes(team.id) ? 'rgba(76, 175, 80, 0.2)' : 'var(--bg-input)', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border)' }}>
                  {team.name}
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-success" onClick={handleCreate} disabled={!newChamp.name || newChamp.teams.length < 2}>
            Criar Campeonato
          </button>
        </div>
      )}

      <div className="grid grid-2">
        {championships.map(champ => (
          <Link to={`/championships/${champ.id}`} key={champ.id} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3>{champ.name}</h3>
            <span className={`badge ${champ.status === 'finished' ? 'badge-success' : champ.status === 'live' ? 'badge-warning' : 'badge-info'}`}>
              {champ.status === 'pending' ? 'Pendente' : champ.status === 'live' ? 'Em Andamento' : 'Finalizado'}
            </span>
            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
              Tipo: {champ.type === 'league' ? 'Liga' : 'Copa'} | Rodada {champ.current_round}/{champ.total_rounds}
            </p>
          </Link>
        ))}
      </div>

      {championships.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>Nenhum campeonato criado ainda.</p>
      )}
    </div>
  );
}

export default Championships;
