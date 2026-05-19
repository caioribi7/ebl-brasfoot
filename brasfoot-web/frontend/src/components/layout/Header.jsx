import { Link, useLocation } from 'react-router-dom';

function Header() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <header>
      <div className="header-content">
        <Link to="/" className="logo">
          ⚽ EBL <span>BrasFoot</span>
        </Link>
        <nav>
          <Link to="/" className={isActive('/')}>Início</Link>
          <Link to="/teams" className={isActive('/teams')}>Times</Link>
          <Link to="/championships" className={isActive('/championships')}>Campeonatos</Link>
          <Link to="/matches" className={isActive('/matches')}>Partidas</Link>
          <Link to="/import" className={isActive('/import')}>Importar</Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
