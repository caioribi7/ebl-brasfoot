import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalTeams, setTotalTeams] = useState(0);

  useEffect(() => {
    fetch('/api/teams/count').then(res => res.json()).then(data => setTotalTeams(data.count));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = search ? `/api/teams?search=${encodeURIComponent(search)}` : '/api/teams';
    fetch(url)
      .then(res => res.json())
      .then(data => { setTeams(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <h1>Times ({totalTeams})</h1>
      <div className="form-group" style={{ maxWidth: '400px', marginBottom: '20px' }}>
        <input type="text" placeholder="🔍 Buscar time..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p>Carregando...</p> : (
        <div className="grid grid-3">
          {teams.map(team => (
            <Link to={`/teams/${team.id}`} key={team.id} className="team-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3>{team.name}</h3>
              <div style={{ marginBottom: '10px' }}>
                <small style={{ color: 'var(--text-secondary)' }}>Força: {team.overall_strength}</small>
                <div className="strength-bar">
                  <div className="strength-bar-fill" style={{ width: `${team.overall_strength}%`, background: team.overall_strength >= 70 ? 'var(--success)' : team.overall_strength >= 55 ? 'var(--warning)' : 'var(--danger)' }} />
                </div>
              </div>
              <div>
                <small>ATA: {team.attack_strength}</small>
                <div className="strength-bar"><div className="strength-bar-fill strength-attack" style={{ width: `${team.attack_strength}%` }} /></div>
                <small>MEI: {team.midfield_strength}</small>
                <div className="strength-bar"><div className="strength-bar-fill strength-midfield" style={{ width: `${team.midfield_strength}%` }} /></div>
                <small>DEF: {team.defense_strength}</small>
                <div className="strength-bar"><div className="strength-bar-fill strength-defense" style={{ width: `${team.defense_strength}%` }} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {teams.length === 0 && !loading && <p style={{ color: 'var(--text-secondary)' }}>Nenhum time encontrado.</p>}
    </div>
  );
}

export default Teams;
