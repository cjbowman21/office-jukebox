require('dotenv').config({ quiet: true });

const http = require('http');
const axios = require('axios');

const scopes = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
];

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback';

if (!clientId || !clientSecret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET before running this helper.');
  process.exit(1);
}

const redirectUrl = new URL(redirectUri);
const authUrl = new URL('https://accounts.spotify.com/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('scope', scopes.join(' '));
authUrl.searchParams.set('redirect_uri', redirectUri);

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, redirectUri);

  if (requestUrl.pathname !== redirectUrl.pathname) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const error = requestUrl.searchParams.get('error');
  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end(`Spotify authorization failed: ${error}`);
    server.close();
    return;
  }

  const code = requestUrl.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing authorization code.');
    return;
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post('https://accounts.spotify.com/api/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
    });

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Spotify authorization complete. You can close this tab.');

    console.log('\nAdd this value to your .env file:');
    console.log(`SPOTIFY_REFRESH_TOKEN=${response.data.refresh_token}`);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Failed to exchange authorization code.');
    console.error('Failed to exchange authorization code for tokens.');
    if (err.response && err.response.data) {
      console.error(err.response.data);
    }
  } finally {
    server.close();
  }
});

server.listen(Number(redirectUrl.port || 80), redirectUrl.hostname, () => {
  console.log('Open this URL in a browser while signed into the shared office Spotify account:');
  console.log(authUrl.toString());
});
