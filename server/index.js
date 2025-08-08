const express = require('express');
const passport = require('passport');
const WindowsStrategy = require('passport-windowsauth');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

// Configure Windows authentication using passport-windowsauth
passport.use(new WindowsStrategy({
  integrated: true
}, function(profile, done) {
  return done(null, profile);
}));
app.use(passport.initialize());
const auth = passport.authenticate('WindowsAuthentication', { session: false });

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', process.env.SPOTIFY_REFRESH_TOKEN);
  const authHeader = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post('https://accounts.spotify.com/api/token', params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`
    }
  });
  accessToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;
  return accessToken;
}

async function spotifyRequest(method, url, options = {}) {
  const token = await getAccessToken();
  const headers = { ...options.headers, Authorization: `Bearer ${token}` };
  return axios({ method, url, ...options, headers });
}

app.get('/api/me', auth, (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

app.get('/api/search', auth, async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({ error: 'Missing q parameter' });
  }
  try {
    const response = await spotifyRequest('get', 'https://api.spotify.com/v1/search', {
      params: { q, type: 'track' }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Spotify search failed' });
  }
});

app.get('/api/queue', auth, async (req, res) => {
  try {
    const response = await spotifyRequest('get', 'https://api.spotify.com/v1/me/player/queue');
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Spotify queue fetch failed' });
  }
});

app.post('/api/add-to-queue', auth, async (req, res) => {
  const { uri } = req.body;
  if (!uri) {
    return res.status(400).json({ error: 'Missing uri in body' });
  }
  try {
    await spotifyRequest('post', 'https://api.spotify.com/v1/me/player/queue', {
      params: { uri }
    });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: 'Spotify add to queue failed' });
  }
});


if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../build');
  app.use(express.static(buildPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
