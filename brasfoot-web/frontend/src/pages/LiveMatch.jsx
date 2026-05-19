import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const charLabels = {
  colocacao: 'Colocação', defesa_penalti: 'Def. Pênalti', reflexo: 'Reflexo',
  saida_gol: 'Saída Gol', armacao: 'Armação', cabeceio: 'Cabeceio',
  cruzamento: 'Cruzamento', desarme: 'Desarme', drible: 'Drible',
  finalizacao: 'Finalização', marcacao: 'Marcação', passe: 'Passe',
  resistencia: 'Resistência', velocidade: 'Velocidade',
};

const durationOptions = [
  { value: 60, label: '1 min (Rápida)' },
  { value: 120, label: '2 min (Normal)' },
  { value: 180, label: '3 min (Detalhada)' },
  { value: 300, label: '5 min (Super Detalhada)' },
];

function LiveMatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentScore, setCurrentScore] = useState({ home: 0, away: 0 });
  const [showHalftimePanel, setShowHalftimePanel] = useState(false);
  const [homeTactics, setHomeTactics] = useState(null);
  const [awayTactics, setAwayTactics] = useState(null);
  const [isHalftime, setIsHalftime] = useState(false);
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [duration, setDuration] = useState(180);
  const [showPenaltyPicker, setShowPenaltyPicker] = useState(false);
  const [penaltyTeamId, setPenaltyTeamId] = useState(null);
  const [penaltyTeamName, setPenaltyTeamName] = useState('');
  const [penaltyPlayers, setPenaltyPlayers] = useState([]);
  const [stats, setStats] = useState(null);
  const [injuredPlayers, setInjuredPlayers] = useState([]);
  const [bench, setBench] = useState({ home: [], away: [] });
  const [activeTab, setActiveTab] = useState('narration');
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [subTeam, setSubTeam] = useState(null);
  const [goalNotification, setGoalNotification] = useState(null);
  const narrationRef = useRef(null);
  const eventSourceRef = useRef(null);
  const homePlayersRef = useRef([]);
  const awayPlayersRef = useRef([]);
  const [showBackgroundBadge, setShowBackgroundBadge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/matches/${id}`).then(res => res.json()).then(data => {
      if (cancelled) return;
      setMatch(data);
      setCurrentScore({ home: data.home_score || 0, away: data.away_score || 0 });

      Promise.all([
        fetch(`/api/teams/${data.home_team_id}/players`).then(r => r.json()),
        fetch(`/api/teams/${data.away_team_id}/players`).then(r => r.json()),
        fetch(`/api/teams/${data.home_team_id}/tactics`).then(r => r.ok ? r.json() : null),
        fetch(`/api/teams/${data.away_team_id}/tactics`).then(r => r.ok ? r.json() : null),
      ]).then(([home, away, ht, at]) => {
        if (cancelled) return;
        setHomePlayers(home);
        setAwayPlayers(away);
        homePlayersRef.current = home;
        awayPlayersRef.current = away;
        setHomeTactics(ht || { mentality: 'balanced', pressing: 50 });
        setAwayTactics(at || { mentality: 'balanced', pressing: 50 });
        setBench({
          home: home.filter(p => !p.is_starter),
          away: away.filter(p => !p.is_starter),
        });

        // Connect SSE only after player data is loaded (avoids race condition on penalty picker)
        if (data.status === 'live') {
          setHasStarted(true);
          setIsLive(true);
          const savedEvents = JSON.parse(data.events || '[]');
          setEvents(savedEvents);
          connectToMatch();
          fetchStats();
        }
      });

      if (data.status === 'finished') {
        setHasStarted(true);
        const savedEvents = JSON.parse(data.events || '[]');
        setEvents(savedEvents);
        fetch(`/api/matches/${id}/stats`).then(r => r.json()).then(s => setStats(s)).catch(() => {});
      }
    });
    return () => {
      cancelled = true;
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [id]);

  const fetchStats = () => {
    fetch(`/api/matches/${id}/stats`).then(r => r.json()).then(s => {
      if (Object.keys(s).length > 0) setStats(s);
    }).catch(() => {});
  };

  const connectToMatch = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`/api/matches/${id}/live?duration=${duration}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'init') return;

      if (data.type === 'reconnect') {
        setEvents(data.events || []);
        setCurrentScore({ home: data.homeScore || 0, away: data.awayScore || 0 });
        if (data.matchState === 'halftime') { setIsHalftime(true); setShowHalftimePanel(true); }
        if (data.matchState === 'penalty') {
          setPenaltyTeamId(data.chooseTeam || 'away');
          setPenaltyTeamName((data.chooseTeam === 'home' ? match?.home_team_name : match?.away_team_name) || '');
          const players = (data.chooseTeam === 'home' ? homePlayersRef.current : awayPlayersRef.current);
          setPenaltyPlayers(players.filter(p => p.is_starter));
          setShowPenaltyPicker(true);
          es.close();
        }
        if (data.finished) { setIsLive(false); finishMatch(); }
        return;
      }

      if (data.type === 'halftime_paused') {
        setIsHalftime(true);
        setShowHalftimePanel(true);
        setInjuredPlayers(data.injuredPlayers || []);
        fetchStats();
        return;
      }

      if (data.type === 'penalty_choose') {
        es.close();
        setPenaltyTeamId(data.chooseTeam);
        setPenaltyTeamName(data.chooseTeam === 'home' ? match?.home_team_name : match?.away_team_name);
        setPenaltyPlayers((data.chooseTeam === 'home' ? homePlayersRef.current : awayPlayersRef.current).filter(p => p.is_starter));
        setShowPenaltyPicker(true);
        return;
      }

      setEvents(prev => {
        const updated = [...prev, data];
        return updated;
      });
      if (data.homeScore !== undefined) setCurrentScore({ home: data.homeScore, away: data.awayScore });
      if (data.type === 'goal' || data.type === 'penalty_goal') {
        setGoalNotification(data);
        setTimeout(() => setGoalNotification(null), 3000);
        fetchStats();
      }

      if (data.finished) {
        es.close(); setIsLive(false); setIsHalftime(false);
        finishMatch();
      }
    };
    es.onerror = () => {
      es.close();
      setIsLive(false);
      setShowBackgroundBadge(true);
      // Try to reconnect after 3 seconds
      setTimeout(() => {
        fetch(`/api/matches/${id}`).then(r => r.json()).then(data => {
          if (data.status === 'live' && homePlayersRef.current.length > 0) {
            setIsLive(true);
            setShowBackgroundBadge(false);
            connectToMatch();
          }
        }).catch(() => {});
      }, 3000);
    };
  };

  const finishMatch = () => {
    fetch(`/api/matches/${id}`).then(res => res.json()).then(d => {
      setMatch(d); setEvents(JSON.parse(d.events || '[]'));
    });
    fetchStats();
  };

  const startLiveMatch = () => {
    setIsLive(true); setHasStarted(true); setEvents([]);
    setCurrentScore({ home: 0, away: 0 });
    connectToMatch();
  };

  const loadPastEvents = async () => {
    const res = await fetch(`/api/matches/${id}/events`);
    setEvents(await res.json());
    setHasStarted(true);
    fetchStats();
  };

  const resumeFromHalftime = async () => {
    await fetch(`/api/matches/${id}/halftime-tactics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home_tactics: homeTactics, away_tactics: awayTactics })
    });
    setShowHalftimePanel(false); setIsHalftime(false);
    await fetch(`/api/matches/${id}/resume`, { method: 'POST' });
    connectToMatch();
  };

  const sendPenaltyKicker = async (playerId) => {
    setShowPenaltyPicker(false);
    await fetch(`/api/matches/${id}/penalty-kicker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
    connectToMatch();
  };

  useEffect(() => {
    if (narrationRef.current) narrationRef.current.scrollTop = narrationRef.current.scrollHeight;
  }, [events]);

  if (!match) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>;

  const getEventIcon = (type) => {
    const icons = { goal: '⚽', penalty_goal: '⚽', yellow_card: '🟨', red_card: '🟥', penalty: '🎯', penalty_miss: '❌', half_time: '⏱️', full_time: '🏁', kickoff: '🏟️', corner: '🚩', save: '🧤', shot_on_target: '🥅', shot_off_target: '↗️', foul: '⚠️', offside: '🚫', counter_attack: '⚡', attack: '▶️', injury: '🤕', substitution: '🔄' };
    return icons[type] || '📢';
  };

  const getEventStyle = (type) => {
    if (type === 'goal' || type === 'penalty_goal') return { color: 'var(--success)', fontWeight: 'bold', background: 'rgba(76,175,80,0.08)', borderRadius: '4px', padding: '2px 4px' };
    if (type === 'red_card') return { color: 'var(--danger)' };
    if (type === 'yellow_card') return { color: 'var(--warning)' };
    if (type === 'penalty' || type === 'penalty_miss') return { color: 'var(--info)' };
    if (type === 'half_time' || type === 'full_time') return { color: 'var(--secondary)', fontWeight: 'bold', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px' };
    if (type === 'injury') return { color: 'var(--danger)' };
    if (type === 'substitution') return { color: 'var(--info)' };
    return {};
  };

  const lastGoalEvent = events.filter(e => e.type === 'goal' || e.type === 'penalty_goal').slice(-1)[0];

  return (
    <div>
      {goalNotification && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'linear-gradient(135deg, var(--success), #2e7d32)', color: '#fff', padding: '20px 40px',
          borderRadius: '12px', fontSize: '1.4rem', fontWeight: 'bold', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'slideDown 0.3s ease-out',
        }}>
          ⚽ GOOOL! {goalNotification.homeScore} - {goalNotification.awayScore}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Partida</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Voltar</button>
      </div>

      <div className="card" style={{ textAlign: 'center', marginBottom: '20px', padding: '30px', position: 'relative', overflow: 'hidden' }}>
        {isLive && <div style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '0.8rem', color: 'var(--warning)' }}>🔴 AO VIVO</div>}
        {showBackgroundBadge && !isLive && hasStarted && match?.status === 'live' && (
          <div style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '0.8rem', color: 'var(--info)', animation: 'pulse 2s infinite' }}>
            ⏳ Partida rodando em background
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, textAlign: 'right', minWidth: '120px' }}>
            <h2 style={{ color: 'var(--secondary)' }}>{match.home_team_name}</h2>
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: '900', color: 'var(--secondary)', minWidth: '120px', textAlign: 'center' }}>
            {hasStarted ? `${currentScore.home} - ${currentScore.away}` : 'vs'}
          </div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: '120px' }}>
            <h2 style={{ color: 'var(--secondary)' }}>{match.away_team_name}</h2>
          </div>
        </div>
        <div style={{ marginTop: '15px' }}>
          {match.status === 'pending' && !hasStarted && (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: 'var(--text-secondary)', marginRight: '10px' }}>Duração:</label>
                <select value={duration} onChange={e => setDuration(parseInt(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
                  {durationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <button className="btn btn-success" onClick={startLiveMatch} style={{ fontSize: '1.2rem', padding: '15px 40px' }}>▶ Iniciar Partida Ao Vivo</button>
            </div>
          )}
          {match.status === 'finished' && !hasStarted && <button className="btn btn-primary" onClick={loadPastEvents}>Ver Narração</button>}
          {match.status === 'finished' && hasStarted && <span className="badge badge-success" style={{ fontSize: '1rem', padding: '10px 20px' }}>🏁 Encerrada</span>}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center', fontSize: '0.85rem' }}>
            <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{match.home_team_name}</div>
            <div style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.75rem' }}>ESTATÍSTICAS</div>
            <div style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>{match.away_team_name}</div>

            <div>{stats.possessionHome?.toFixed(0) || 50}%</div>
            <div style={{ width: '100px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${stats.possessionHome || 50}%`, height: '100%', background: 'var(--secondary)', borderRadius: '3px' }} />
            </div>
            <div>{stats.possessionAway?.toFixed(0) || 50}%</div>

            <div>{stats.shotsTotalHome || 0}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Finalizações</div>
            <div>{stats.shotsTotalAway || 0}</div>

            <div>{stats.shotsOnTargetHome || 0}</div>
            <div style={{ color: 'var(--success)', fontSize: '0.75rem' }}>No Gol</div>
            <div>{stats.shotsOnTargetAway || 0}</div>

            <div>{stats.cornersHome || 0}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Escanteios</div>
            <div>{stats.cornersAway || 0}</div>

            <div>{stats.foulsHome || 0}</div>
            <div style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>Faltas</div>
            <div>{stats.foulsAway || 0}</div>

            <div>{stats.yellowCardsHome || 0}</div>
            <div style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>Amarelos</div>
            <div>{stats.yellowCardsAway || 0}</div>
          </div>
        </div>
      )}

      {/* Penalty Picker */}
      {showPenaltyPicker && (
        <div className="card" style={{ borderColor: 'var(--info)', marginBottom: '20px', borderWidth: '2px' }}>
          <h2 style={{ color: 'var(--info)' }}>🎯 Pênalti - Escolha o Batedor</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>{penaltyTeamName} precisa de um batedor:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {penaltyPlayers.map(p => (
              <button key={p.id} className="btn btn-outline" onClick={() => sendPenaltyKicker(p.id)} style={{ textAlign: 'left', padding: '10px 15px' }}>
                <strong>{p.name}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '8px' }}>{p.position_name || p.position}</span>
                <span style={{ color: 'var(--warning)', marginLeft: '8px' }}>FOR {p.physical}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Halftime Panel */}
      {showHalftimePanel && isHalftime && (
        <div className="card" style={{ borderColor: 'var(--warning)', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--warning)' }}>⏱️ Intervalo</h2>
          {injuredPlayers.length > 0 && (
            <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(244,67,54,0.1)', borderRadius: '8px' }}>
              <h3 style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>🤕 Jogadores Machucados</h3>
              {injuredPlayers.map(inj => (
                <div key={inj.playerId} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {inj.playerName} - {Math.round(inj.severity * 100)}% de redução
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-2">
            <div>
              <h3>{match.home_team_name}</h3>
              <div className="form-group">
                <label>Mentalidade</label>
                <select value={homeTactics?.mentality || 'balanced'} onChange={e => setHomeTactics(prev => ({ ...(prev || {}), mentality: e.target.value }))}>
                  <option value="defensive">Defensiva</option>
                  <option value="balanced">Equilibrada</option>
                  <option value="attacking">Ofensiva</option>
                </select>
              </div>
              <div className="form-group">
                <label>Pressão: {homeTactics?.pressing || 50}%</label>
                <input type="range" min="0" max="100" value={homeTactics?.pressing || 50} onChange={e => setHomeTactics(prev => ({ ...(prev || {}), pressing: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div>
              <h3>{match.away_team_name}</h3>
              <div className="form-group">
                <label>Mentalidade</label>
                <select value={awayTactics?.mentality || 'balanced'} onChange={e => setAwayTactics(prev => ({ ...(prev || {}), mentality: e.target.value }))}>
                  <option value="defensive">Defensiva</option>
                  <option value="balanced">Equilibrada</option>
                  <option value="attacking">Ofensiva</option>
                </select>
              </div>
              <div className="form-group">
                <label>Pressão: {awayTactics?.pressing || 50}%</label>
                <input type="range" min="0" max="100" value={awayTactics?.pressing || 50} onChange={e => setAwayTactics(prev => ({ ...(prev || {}), pressing: parseInt(e.target.value) }))} />
              </div>
            </div>
          </div>
          <button className="btn btn-success" onClick={resumeFromHalftime}>▶ Iniciar 2º Tempo</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button className={`btn ${activeTab === 'narration' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('narration')}>Narração</button>
        <button className={`btn ${activeTab === 'lineups' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('lineups')}>Titulares</button>
        {match.status === 'finished' && <button className={`btn ${activeTab === 'player-stats' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('player-stats')}>Jogadores</button>}
      </div>
      {hasStarted && events.length > 0 && activeTab === 'narration' && (
        <div className="card">
          <h2>Narração ({events.length} eventos)</h2>
          <div className="narration-box" ref={narrationRef}>
            {events.map((event, index) => (
              <div key={index} className="narration-event" style={getEventStyle(event.type)}>
                <span className="narration-minute">{event.minute}'</span>
                <span>{getEventIcon(event.type)}</span>
                <span className="narration-text">{event.narration}</span>
                {event.playerName && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{event.playerName}</span>
                )}
                {event.homeScore !== undefined && event.awayScore !== undefined && (
                  <span style={{ fontWeight: 'bold', color: 'var(--secondary)', minWidth: '50px', textAlign: 'right', marginLeft: 'auto' }}>
                    {event.homeScore} - {event.awayScore}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'lineups' && homePlayers.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: '20px' }}>
          <div className="card">
            <h3>{match.home_team_name} - Titulares</h3>
            <table style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Jogador</th><th>POS</th><th>FOR</th><th>STA</th><th>Características</th></tr></thead>
              <tbody>
                {homePlayers.filter(p => p.is_starter).map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.position_name || p.position}</td>
                    <td>{p.physical}</td>
                    <td>{p.stamina}</td>
                    <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {p.characteristics ? `${charLabels[p.characteristics.primary] || p.characteristics.primary}, ${charLabels[p.characteristics.secondary] || p.characteristics.secondary}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>{match.away_team_name} - Titulares</h3>
            <table style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Jogador</th><th>POS</th><th>FOR</th><th>STA</th><th>Características</th></tr></thead>
              <tbody>
                {awayPlayers.filter(p => p.is_starter).map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.position_name || p.position}</td>
                    <td>{p.physical}</td>
                    <td>{p.stamina}</td>
                    <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {p.characteristics ? `${charLabels[p.characteristics.primary] || p.characteristics.primary}, ${charLabels[p.characteristics.secondary] || p.characteristics.secondary}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'player-stats' && <PlayerStatsPanel matchId={id} />}

      {hasStarted && events.length === 0 && match.status === 'finished' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Narração indisponível para esta partida.</p>
          <button className="btn btn-primary" onClick={loadPastEvents}>Tentar Carregar</button>
        </div>
      )}
    </div>
  );
}

function PlayerStatsPanel({ matchId }) {
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    fetch(`/api/matches/${matchId}/player-stats`).then(r => r.json()).then(setPlayers).catch(() => {});
  }, [matchId]);
  if (players.length === 0) return <p style={{ color: 'var(--text-secondary)' }}>Nenhum dado de jogador.</p>;
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h2>Desempenho dos Jogadores</h2>
      <table style={{ fontSize: '0.8rem', width: '100%' }}>
        <thead>
          <tr><th>Jogador</th><th>Pos</th><th>Gols</th><th>Assist.</th><th>Amarelo</th><th>Vermelho</th><th>Nota</th></tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}>
              <td>{p.player_name}</td>
              <td>{p.player_position}</td>
              <td style={{ color: 'var(--success)' }}>{p.goals || 0}</td>
              <td>{p.assists || 0}</td>
              <td style={{ color: 'var(--warning)' }}>{p.yellow_cards || 0}</td>
              <td style={{ color: 'var(--danger)' }}>{p.red_cards || 0}</td>
              <td style={{ fontWeight: 'bold', color: p.rating >= 7.5 ? 'var(--success)' : p.rating >= 6.0 ? 'var(--secondary)' : 'var(--danger)' }}>{p.rating?.toFixed(1) || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LiveMatch;
