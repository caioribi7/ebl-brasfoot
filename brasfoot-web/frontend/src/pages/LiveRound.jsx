import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function LiveRound() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [championship, setChampionship] = useState(null);
  const [matches, setMatches] = useState({});
  const [isLive, setIsLive] = useState(false);
  const [round, setRound] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [pendingRoundExists, setPendingRoundExists] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/championships/${id}`).then(r => r.json()),
      fetch(`/api/championships/${id}/matches`).then(r => r.json()),
    ]).then(([data, allMatches]) => {
      setChampionship(data);
      const pending = allMatches.filter(m => m.status === 'pending' || m.status === 'live');
      setPendingRoundExists(pending.length > 0);
    });
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, [id]);

  const startLiveRound = () => {
    setIsLive(true);
    setMatches({});
    setFinishedCount(0);

    const es = new EventSource(`/api/championships/${id}/live-round`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'round_init') {
        setRound(data.round);
        setTotalMatches(data.matchCount || 0);
        return;
      }

      if (data.type === 'match_init') {
        setMatches(prev => ({
          ...prev,
          [data.matchId]: {
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            homeScore: 0,
            awayScore: 0,
            events: [],
            finished: false,
          }
        }));
        return;
      }

      setMatches(prev => {
        const match = prev[data.matchId];
        if (!match) return prev;
        return {
          ...prev,
          [data.matchId]: {
            ...match,
            homeScore: data.homeScore ?? match.homeScore,
            awayScore: data.awayScore ?? match.awayScore,
            events: [...match.events, data],
            finished: data.finished || false,
          }
        };
      });

      if (data.finished) {
        setFinishedCount(prev => prev + 1);
      }

      if (data.type === 'full_time' || (data.finished && data.type === 'full_time')) {
        // Check if all done
      }
    };

    es.onerror = () => {
      es.close();
      setIsLive(false);
    };
  };

  const getEventIcon = (type) => {
    const icons = { goal: '⚽', penalty_goal: '⚽', yellow_card: '🟨', red_card: '🟥', penalty: '🎯', half_time: '⏱️', full_time: '🏁', kickoff: '🏟️', corner: '🚩', save: '🧤', shot_on_target: '🥅', shot_off_target: '↗️', foul: '⚠️', offside: '🚫', counter_attack: '⚡', attack: '▶️', injury: '🤕', substitution: '🔄' };
    return icons[type] || '📢';
  };

  if (!championship) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>;

  const matchIds = Object.keys(matches);
  const allFinished = matchIds.length > 0 && finishedCount >= matchIds.length && totalMatches > 0 && finishedCount >= totalMatches;

  const gridCols = matchIds.length <= 2 ? 2 : matchIds.length <= 4 ? 2 : 3;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1>Rodada Ao Vivo - {championship.name}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isLive && !allFinished && pendingRoundExists && (
            <button className="btn btn-success" onClick={startLiveRound}>▶ Iniciar Rodada Ao Vivo</button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate(`/championships/${id}`)}>Voltar</button>
        </div>
      </div>

      {isLive && (
        <div className="card" style={{ marginBottom: '20px', textAlign: 'center', padding: '15px' }}>
          <span className="badge badge-warning" style={{ fontSize: '1rem', padding: '10px 20px', animation: 'pulse 1s infinite' }}>🔴 Rodada {round} AO VIVO</span>
          {totalMatches > 0 && (
            <span style={{ marginLeft: '15px', color: 'var(--text-secondary)' }}>
              {finishedCount}/{totalMatches} partidas encerradas
            </span>
          )}
        </div>
      )}

      {!isLive && !allFinished && !pendingRoundExists && (
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Nenhuma partida pendente nesta rodada.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>Todas as partidas já foram simuladas ou o campeonato foi finalizado.</p>
          <button className="btn btn-primary" style={{ marginTop: '15px' }} onClick={() => navigate(`/championships/${id}`)}>Ver Campeonato</button>
        </div>
      )}

      {!isLive && pendingRoundExists && !allFinished && (
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Rodada {championship.current_round} pronta para iniciar!</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>Clique em "Iniciar Rodada Ao Vivo" para começar todas as partidas simultaneamente.</p>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: '20px',
      }}>
        {matchIds.map(mid => {
          const match = matches[mid];
          const lastEvents = match.events.slice(-5).reverse();
          return (
            <div key={mid} className="card" style={{
              borderColor: match.finished ? 'var(--success)' : isLive ? 'var(--warning)' : 'var(--border)',
              borderWidth: match.finished || isLive ? '2px' : '1px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} onClick={() => navigate(`/matches/${mid}/live`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{match.homeTeam}</div>
                </div>
                <div style={{
                  fontSize: '2rem', fontWeight: '900', color: 'var(--secondary)',
                  padding: '0 15px', minWidth: '80px', textAlign: 'center',
                }}>
                  {match.homeScore} - {match.awayScore}
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{match.awayTeam}</div>
                </div>
              </div>
              {match.finished && (
                <div style={{ textAlign: 'center', color: 'var(--success)', fontSize: '0.85rem', marginBottom: '5px' }}>🏁 Encerrada</div>
              )}
              {lastEvents.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxHeight: '80px', overflow: 'hidden' }}>
                  {lastEvents.slice(0, 3).map((evt, i) => (
                    <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{evt.minute ? `${evt.minute}' ` : ''}</span>
                      {getEventIcon(evt.type)} {evt.narration?.substring(0, 40)}{evt.narration?.length > 40 ? '...' : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allFinished && (
        <div className="card" style={{ textAlign: 'center', marginTop: '20px', padding: '20px', borderColor: 'var(--success)' }}>
          <h2 style={{ color: 'var(--success)' }}>🏁 Todas as partidas encerradas!</h2>
          <button className="btn btn-primary" style={{ marginTop: '10px' }} onClick={() => navigate(`/championships/${id}`)}>Ver Campeonato</button>
        </div>
      )}
    </div>
  );
}

export default LiveRound;
