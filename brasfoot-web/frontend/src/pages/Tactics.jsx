import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const FORMATIONS = {
  '4-4-2': {
    name: '4-4-2',
    positions: [
      { x: 50, y: 90, pos: 'GK' },
      { x: 15, y: 70, pos: 'DEF' },
      { x: 38, y: 70, pos: 'DEF' },
      { x: 62, y: 70, pos: 'DEF' },
      { x: 85, y: 70, pos: 'DEF' },
      { x: 15, y: 45, pos: 'MID' },
      { x: 38, y: 45, pos: 'MID' },
      { x: 62, y: 45, pos: 'MID' },
      { x: 85, y: 45, pos: 'MID' },
      { x: 35, y: 20, pos: 'FWD' },
      { x: 65, y: 20, pos: 'FWD' },
    ]
  },
  '4-3-3': {
    name: '4-3-3',
    positions: [
      { x: 50, y: 90, pos: 'GK' },
      { x: 15, y: 70, pos: 'DEF' },
      { x: 38, y: 70, pos: 'DEF' },
      { x: 62, y: 70, pos: 'DEF' },
      { x: 85, y: 70, pos: 'DEF' },
      { x: 25, y: 45, pos: 'MID' },
      { x: 50, y: 45, pos: 'MID' },
      { x: 75, y: 45, pos: 'MID' },
      { x: 15, y: 20, pos: 'FWD' },
      { x: 50, y: 20, pos: 'FWD' },
      { x: 85, y: 20, pos: 'FWD' },
    ]
  },
  '3-5-2': {
    name: '3-5-2',
    positions: [
      { x: 50, y: 90, pos: 'GK' },
      { x: 25, y: 70, pos: 'DEF' },
      { x: 50, y: 70, pos: 'DEF' },
      { x: 75, y: 70, pos: 'DEF' },
      { x: 10, y: 45, pos: 'MID' },
      { x: 30, y: 50, pos: 'MID' },
      { x: 50, y: 45, pos: 'MID' },
      { x: 70, y: 50, pos: 'MID' },
      { x: 90, y: 45, pos: 'MID' },
      { x: 35, y: 20, pos: 'FWD' },
      { x: 65, y: 20, pos: 'FWD' },
    ]
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    positions: [
      { x: 50, y: 90, pos: 'GK' },
      { x: 15, y: 70, pos: 'DEF' },
      { x: 38, y: 70, pos: 'DEF' },
      { x: 62, y: 70, pos: 'DEF' },
      { x: 85, y: 70, pos: 'DEF' },
      { x: 35, y: 55, pos: 'MID' },
      { x: 65, y: 55, pos: 'MID' },
      { x: 15, y: 35, pos: 'MID' },
      { x: 50, y: 35, pos: 'MID' },
      { x: 85, y: 35, pos: 'MID' },
      { x: 50, y: 15, pos: 'FWD' },
    ]
  },
  '5-3-2': {
    name: '5-3-2',
    positions: [
      { x: 50, y: 90, pos: 'GK' },
      { x: 10, y: 70, pos: 'DEF' },
      { x: 30, y: 70, pos: 'DEF' },
      { x: 50, y: 70, pos: 'DEF' },
      { x: 70, y: 70, pos: 'DEF' },
      { x: 90, y: 70, pos: 'DEF' },
      { x: 25, y: 45, pos: 'MID' },
      { x: 50, y: 45, pos: 'MID' },
      { x: 75, y: 45, pos: 'MID' },
      { x: 35, y: 20, pos: 'FWD' },
      { x: 65, y: 20, pos: 'FWD' },
    ]
  },
};

function Tactics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [tactics, setTactics] = useState({ formation: '4-4-2', mentality: 'balanced', pressing: 50, width: 50, depth: 50 });
  const [starters, setStarters] = useState([]);
  const [captain, setCaptain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/teams/${id}`).then(res => res.json()),
      fetch(`/api/teams/${id}/players`).then(res => res.json()),
      fetch(`/api/teams/${id}/tactics`).then(res => res.json())
    ]).then(([teamData, playersData, tacticsData]) => {
      setTeam(teamData);
      setPlayers(playersData);
      if (tacticsData) setTactics(tacticsData);
      
      const startersList = playersData.filter(p => p.is_starter).map(p => p.id);
      setStarters(startersList);
      
      const captainPlayer = playersData.find(p => p.is_captain);
      if (captainPlayer) setCaptain(captainPlayer.id);
      
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/teams/${id}/tactics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tactics)
      });
      await fetch(`/api/teams/${id}/lineup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starters, captain })
      });
      navigate(`/teams/${id}`);
    } catch (err) {
      console.error('Erro ao salvar:', err);
    }
    setSaving(false);
  };

  const toggleStarter = (playerId) => {
    setStarters(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 11) return prev;
      return [...prev, playerId];
    });
  };

  if (loading) return <p>Carregando...</p>;

  const formation = FORMATIONS[tactics.formation] || FORMATIONS['4-4-2'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Táticas - {team?.name}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/teams/${id}`)}>Cancelar</button>
          <button className="btn btn-success" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Formação</h2>
          <div className="form-group">
            <label>Esquema Tático</label>
            <select value={tactics.formation} onChange={e => setTactics({ ...tactics, formation: e.target.value })}>
              {Object.keys(FORMATIONS).map(f => (
                <option key={f} value={f}>{FORMATIONS[f].name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Mentalidade</label>
            <select value={tactics.mentality} onChange={e => setTactics({ ...tactics, mentality: e.target.value })}>
              <option value="defensive">Defensiva</option>
              <option value="balanced">Equilibrada</option>
              <option value="attacking">Ofensiva</option>
            </select>
          </div>

          <div className="form-group">
            <label>Pressão: {tactics.pressing}%</label>
            <input type="range" min="0" max="100" value={tactics.pressing} onChange={e => setTactics({ ...tactics, pressing: parseInt(e.target.value) })} />
          </div>

          <div className="form-group">
            <label>Amplitude: {tactics.width}%</label>
            <input type="range" min="0" max="100" value={tactics.width} onChange={e => setTactics({ ...tactics, width: parseInt(e.target.value) })} />
          </div>

          <div className="form-group">
            <label>Profundidade: {tactics.depth}%</label>
            <input type="range" min="0" max="100" value={tactics.depth} onChange={e => setTactics({ ...tactics, depth: parseInt(e.target.value) })} />
          </div>
        </div>

        <div className="card">
          <h2>Campo</h2>
          <div className="pitch">
            <div className="pitch-center-circle" />
            {formation.positions.map((pos, i) => (
              <div key={i} className={`player-position ${pos.pos.toLowerCase()}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                {pos.pos}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Elenco - Clique para escalar (11 titulares)</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
          Titulares: {starters.length}/11
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Nome</th>
              <th>Pos</th>
              <th>OVE</th>
              <th>RIT</th>
              <th>FIN</th>
              <th>PAS</th>
              <th>DRI</th>
              <th>DEF</th>
              <th>FIS</th>
            </tr>
          </thead>
          <tbody>
            {players.map(player => (
              <tr key={player.id} onClick={() => toggleStarter(player.id)} style={{ cursor: 'pointer', background: starters.includes(player.id) ? 'rgba(76, 175, 80, 0.2)' : 'transparent' }}>
                <td>{starters.includes(player.id) ? '⚡' : ''}{captain === player.id ? '👑' : ''}</td>
                <td>{player.name}</td>
                <td><span className="badge badge-info">{player.position}</span></td>
                <td style={{ fontWeight: 'bold' }}>{player.overall}</td>
                <td>{player.pace}</td>
                <td>{player.shooting}</td>
                <td>{player.passing}</td>
                <td>{player.dribbling}</td>
                <td>{player.defending}</td>
                <td>{player.physical}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Tactics;
