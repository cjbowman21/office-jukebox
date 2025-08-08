import React, { useState, useEffect } from 'react';
import MainView from './components/MainView';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          setIsAuthenticated(true);
        } else if (response.status === 401 || response.status === 403) {
          setError('Session expired. Please reauthenticate with Windows.');
        } else {
          setError('Unable to verify session.');
        }
      } catch (err) {
        setError('Unable to verify session.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="App">
        <header>
          <h1>Office Jukebox</h1>
        </header>
        <main>
          <p>Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header>
        <h1>Office Jukebox</h1>
      </header>

      <main>
        {isAuthenticated ? (
          <MainView />
        ) : (
          <p>{error || 'Please authenticate with Windows to continue.'}</p>
        )}
      </main>
    </div>
  );
}

export default App;