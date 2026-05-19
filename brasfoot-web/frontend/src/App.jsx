import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Home from './pages/Home';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Tactics from './pages/Tactics';
import Championships from './pages/Championships';
import ChampionshipDetail from './pages/ChampionshipDetail';
import Matches from './pages/Matches';
import LiveMatch from './pages/LiveMatch';
import LiveRound from './pages/LiveRound';
import ImportTeams from './pages/ImportTeams';

function App() {
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/teams/:id/tactics" element={<Tactics />} />
          <Route path="/championships" element={<Championships />} />
          <Route path="/championships/:id" element={<ChampionshipDetail />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/:id/live" element={<LiveMatch />} />
          <Route path="/championships/:id/live-round" element={<LiveRound />} />
          <Route path="/import" element={<ImportTeams />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
