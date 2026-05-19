import { useState } from 'react';

function ImportTeams() {
  const [file, setFile] = useState(null);
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [useFile, setUseFile] = useState(true);

  const handleFileUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleJsonImport = async () => {
    if (!jsonText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const jsonData = JSON.parse(jsonText);
      const res = await fetch('/api/import/import-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleBanFolderImport = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/import/import-ban-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: '/home/caio/Documentos/ebl-brasfoot/teams' })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h1>Importar Times</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
        Importe times de arquivos .ban do BrasFoot, JSON ou diretamente da pasta de times.
      </p>

      <div className="card">
        <button className="btn btn-success" onClick={handleBanFolderImport} disabled={loading} style={{ marginBottom: '20px', width: '100%' }}>
          {loading ? 'Importando...' : '📂 Importar Todos os Times da Pasta (EBL)'}
        </button>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button className={`btn ${useFile ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUseFile(true)}>
            Upload de Arquivo
          </button>
          <button className={`btn ${!useFile ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUseFile(false)}>
            Colar JSON
          </button>
        </div>

        {useFile ? (
          <div className="form-group">
            <label>Arquivo (.ban ou .json)</label>
            <input type="file" accept=".ban,.json" onChange={e => setFile(e.target.files[0])} />
            <button className="btn btn-success" onClick={handleFileUpload} disabled={!file || loading} style={{ marginTop: '10px' }}>
              {loading ? 'Importando...' : 'Importar Arquivo'}
            </button>
          </div>
        ) : (
          <div className="form-group">
            <label>JSON dos Times</label>
            <textarea rows="10" value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder='[{"name": "Flamengo", "attack": 80, "midfield": 75, "defense": 70, "players": [...]}]' style={{ fontFamily: 'monospace' }} />
            <button className="btn btn-success" onClick={handleJsonImport} disabled={!jsonText.trim() || loading} style={{ marginTop: '10px' }}>
              {loading ? 'Importando...' : 'Importar JSON'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <h3 style={{ color: 'var(--danger)' }}>Erro</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="card" style={{ borderColor: 'var(--success)' }}>
          <h3 style={{ color: 'var(--success)' }}>Sucesso!</h3>
          <p>{result.count} times importados com sucesso.</p>
        </div>
      )}

      <div className="card">
        <h2>Formato JSON Esperado</h2>
        <pre style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '8px', overflow: 'auto', fontSize: '0.85rem' }}>
{`[
  {
    "name": "Flamengo",
    "short_name": "FLA",
    "attack": 85,
    "midfield": 80,
    "defense": 75,
    "players": [
      {
        "name": "Rossi",
        "position": "GK",
        "overall": 78,
        "pace": 40,
        "shooting": 30,
        "passing": 65,
        "dribbling": 45,
        "defending": 75,
        "physical": 80,
        "stamina": 70
      }
    ]
  }
]`}
        </pre>
      </div>
    </div>
  );
}

export default ImportTeams;
