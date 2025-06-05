import React, { useState, useEffect } from 'react';
import { handleCallback, getAccessToken, login } from './SpotifyAuth.js';
import MainView from './components/MainView';
import './App.css';

function App() {
  const [token, setToken] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    console.log("Current token:", token);
    console.log("URL hash:", window.location.hash);
    // Check for token in URL hash on initial load
    const hash = window.location.hash;
    if (hash) {
      const token = hash.substring(1).split("&").find(elem => elem.startsWith("access_token")).split("=")[1];
      if (token) {
        localStorage.setItem('spotify_access_token', token);
        setToken(token);
        // Clear hash from URL
        window.location.hash = "";
      }
    }

    // Check localStorage for existing token
    const storedToken = localStorage.getItem('spotify_access_token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleLogin = () => {
    login();
  };

  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    setToken(null);
  };

  return (
    <div className="App">
      <header>
        <h1>Office Jukebox</h1>
        {token ? (
          <button onClick={handleLogout}>Logout</button>
        ) : (
          <button onClick={handleLogin}>Connect Spotify</button>
        )}
      </header>

      <main>
        {token ? (
          <MainView token={token} />
        ) : (
          <p>Connect your Spotify account to view the queue</p>
        )}
      </main>
    </div>
  );
}

export default App;