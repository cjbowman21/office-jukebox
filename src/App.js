import React, { useEffect, useState } from 'react';
import { CalendarDays, Music2 } from 'lucide-react';
import MainView from './components/MainView';
import OrdinalCalendar from './components/OrdinalCalendar';
import { getMe } from './utils/spotifyAPI';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('spotify');

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        const profile = await getMe();
        if (active) {
          setUser(profile);
          setError('');
        }
      } catch (err) {
        if (active) {
          if (err.status === 401 || err.status === 403) {
            setError('Windows authentication did not complete. Use Edge or Chrome from a domain-joined Windows session, and open the LAN hostname if localhost is not trusted for integrated authentication.');
          } else if (err.code === 'NETWORK_ERROR') {
            setError('Unable to reach the Office Jukebox API. In development, confirm the API is running on port 5000 and VITE_API_URL points to it.');
          } else {
            setError(err.message);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    checkAuth();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Office Spotify</p>
          <h1>Office Jukebox</h1>
        </div>
        {user && (
          <div className="user-pill" title={`${user.domain || ''}\\${user.username || ''}`}>
            {user.username}
          </div>
        )}
      </header>

      <main>
        {loading ? (
          <section className="state-panel">
            <div className="spinner" />
            <p>Checking Windows session...</p>
          </section>
        ) : user ? (
          <>
            <nav className="app-tabs" aria-label="Office Jukebox views">
              <button
                type="button"
                className={`tab-button ${activeView === 'spotify' ? 'active' : ''}`}
                onClick={() => setActiveView('spotify')}
                aria-pressed={activeView === 'spotify'}
              >
                <Music2 size={17} aria-hidden="true" />
                Spotify
              </button>
              <button
                type="button"
                className={`tab-button ${activeView === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveView('calendar')}
                aria-pressed={activeView === 'calendar'}
              >
                <CalendarDays size={17} aria-hidden="true" />
                Calendar
              </button>
            </nav>
            {activeView === 'spotify' ? <MainView user={user} /> : <OrdinalCalendar />}
          </>
        ) : (
          <section className="state-panel error-panel">
            <h2>Authentication needed</h2>
            <p>{error || 'Please authenticate with Windows to continue.'}</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
