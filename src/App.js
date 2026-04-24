import React, { useEffect, useState } from 'react';
import MainView from './components/MainView';
import { getMe } from './utils/spotifyAPI';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          <MainView user={user} />
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
