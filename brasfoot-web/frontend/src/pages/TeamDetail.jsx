import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function TeamDetail() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/teams/${id}`).then(res => res.json()),
      fetch(`/api/teams/${id}/players`).then(res => res.json())
    ]).then(([teamData, playersData]) => {
      setTeam(teamData);
      setPlayers(playersData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const startEdit = (player) => {
    setEditingPlayer(player.id);
    setEditForm({
      overall: player.overall,
      pace: player.pace,
      shooting: player.shooting,
      passing: player.passing,
      dribbling: player.dribbling,
      defending: player.defending,
      physical: player.physical,
      stamina: player.stamina,
      is_starter: player.is_starter ? 1 : 0,
      is_captain: player.is_captain ? 1 : 0,
      is_star: player.is_star ? 1 : 0,
      is_top_world: player.is_top_world ? 1 : 0,
    });
  };

  const saveEdit = async (playerId) => {
    setSaving(true);
    await fetch(`/api/teams/${id}/players/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    });
    const playersData = await fetch(`/api/teams/${id}/players`).then(res => res.json());
    setPlayers(playersData);
    setEditingPlayer(null);
    setSaving(false);
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditForm({});
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>;
  if (!team) return <p>Time não encontrado</p>;

  const starters = players.filter(p => p.is_starter);
  const reserves = players.filter(p => !p.is_starter);

  const charLabels = {
    colocacao: 'Colocação', defesa_penalti: 'Def. Pênalti', reflexo: 'Reflexo',
    saida_gol: 'Saída Gol', armacao: 'Armação', cabeceio: 'Cabeceio',
    cruzamento: 'Cruzamento', desarme: 'Desarme', drible: 'Drible',
    finalizacao: 'Finalização', marcacao: 'Marcação', passe: 'Passe',
    resistencia: 'Resistência', velocidade: 'Velocidade',
  };

  const renderPlayerRow = (player) => {
    if (editingPlayer === player.id) {
      return (
        <tr key={player.id}>
          <td>{player.is_captain ? '👑' : ''}</td>
          <td>{player.name}</td>
          <td><span className="badge badge-info">{player.position_name || player.position}</span></td>
          <td>{player.age || '-'}</td>
          <td><input type="number" min="1" max="99" value={editForm.overall} onChange={e => setEditForm({ ...editForm, overall: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td><input type="number" min="1" max="99" value={editForm.pace} onChange={e => setEditForm({ ...editForm, pace: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td><input type="number" min="1" max="99" value={editForm.shooting} onChange={e => setEditForm({ ...editForm, shooting: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td><input type="number" min="1" max="99" value={editForm.passing} onChange={e => setEditForm({ ...editForm, passing: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td><input type="number" min="1" max="99" value={editForm.dribbling} onChange={e => setEditForm({ ...editForm, dribbling: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td><input type="number" min="1" max="99" value={editForm.defending} onChange={e => setEditForm({ ...editForm, defending: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td><input type="number" min="1" max="99" value={editForm.physical} onChange={e => setEditForm({ ...editForm, physical: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td><input type="number" min="1" max="99" value={editForm.stamina} onChange={e => setEditForm({ ...editForm, stamina: parseInt(e.target.value) })} style={{ width: '50px' }} /></td>
          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {player.characteristics ? `${charLabels[player.characteristics.primary] || player.characteristics.primary}, ${charLabels[player.characteristics.secondary] || player.characteristics.secondary}` : '-'}
          </td>
          <td>
            <button className="btn btn-success" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => saveEdit(player.id)} disabled={saving}>Salvar</button>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem', marginLeft: '5px' }} onClick={cancelEdit}>Cancelar</button>
          </td>
        </tr>
      );
    }

    return (
      <tr key={player.id} style={!player.is_starter ? { opacity: 0.6 } : {}}>
        <td>{player.is_captain ? '👑' : ''}</td>
        <td>{player.name}{player.is_star ? ' ⭐' : ''}{player.is_top_world ? ' 🌍' : ''}</td>
        <td><span className="badge badge-info">{player.position_name || player.position}</span></td>
        <td>{player.age || '-'}</td>
        <td style={{ fontWeight: 'bold', color: player.overall >= 70 ? 'var(--success)' : player.overall >= 55 ? 'var(--warning)' : 'var(--danger)' }}>{player.overall}</td>
        <td>{player.pace}</td>
        <td>{player.shooting}</td>
        <td>{player.passing}</td>
        <td>{player.dribbling}</td>
        <td>{player.defending}</td>
        <td>{player.physical}</td>
        <td>{player.stamina}</td>
        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {player.characteristics ? `${charLabels[player.characteristics.primary] || player.characteristics.primary}, ${charLabels[player.characteristics.secondary] || player.characteristics.secondary}` : '-'}
        </td>
        <td><button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => startEdit(player)}>Editar</button></td>
      </tr>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1>{team.name}</h1>
          {team.stadium && <p style={{ color: 'var(--text-secondary)' }}>🏟️ {team.stadium}</p>}
          {team.coach && <p style={{ color: 'var(--text-secondary)' }}>👨‍💼 {team.coach}</p>}
        </div>
        <Link to={`/teams/${id}/tactics`} className="btn btn-primary">Editar Táticas</Link>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Forças</h2>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Ataque</span><span style={{ color: 'var(--danger)' }}>{team.attack_strength}</span>
            </div>
            <div className="strength-bar"><div className="strength-bar-fill strength-attack" style={{ width: `${team.attack_strength}%` }} /></div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Meio-Campo</span><span style={{ color: 'var(--info)' }}>{team.midfield_strength}</span>
            </div>
            <div className="strength-bar"><div className="strength-bar-fill strength-midfield" style={{ width: `${team.midfield_strength}%` }} /></div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Defesa</span><span style={{ color: 'var(--success)' }}>{team.defense_strength}</span>
            </div>
            <div className="strength-bar"><div className="strength-bar-fill strength-defense" style={{ width: `${team.defense_strength}%` }} /></div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Overall</span><span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{team.overall_strength}</span>
            </div>
            <div className="strength-bar"><div className="strength-bar-fill" style={{ width: `${team.overall_strength}%`, background: 'var(--secondary)' }} /></div>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '15px', fontSize: '0.85rem' }}>
            {players.length} jogadores | {starters.length} titulares
          </p>
        </div>

        <div className="card">
          <h2>Legenda de Características</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '0.85rem' }}>
            {Object.entries(charLabels).map(([key, label]) => (
              <div key={key} style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--secondary)' }}>{key.charAt(0).toUpperCase()}</span> {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Titulares ({starters.length})</h2>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Nome</th>
              <th>Pos</th>
              <th>Idade</th>
              <th>OVE</th>
              <th>RIT</th>
              <th>FIN</th>
              <th>PAS</th>
              <th>DRI</th>
              <th>DEF</th>
              <th>FIS</th>
              <th>STA</th>
              <th>Características</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {starters.map(renderPlayerRow)}
          </tbody>
        </table>
      </div>

      {reserves.length > 0 && (
        <div className="card">
          <h2>Reservas ({reserves.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Pos</th>
                <th>Idade</th>
                <th>OVE</th>
                <th>RIT</th>
                <th>FIN</th>
                <th>PAS</th>
                <th>DRI</th>
                <th>DEF</th>
                <th>FIS</th>
                <th>STA</th>
                <th>Características</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reserves.map(renderPlayerRow)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TeamDetail;