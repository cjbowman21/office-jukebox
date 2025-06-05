import axios from 'axios';

const CLIENT_ID = 'adcc3780cf0849aca6626978a67c209d';
const REDIRECT_URI = 'http://127.0.0.1:3000/callback';

// Generate random string for PKCE
export const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// Generate code challenge for PKCE
export const generateCodeChallenge = async (codeVerifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Redirect to Spotify authorization
export const redirectToSpotifyAuth = async () => {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  localStorage.setItem('code_verifier', codeVerifier);
  
  const scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  
  const params = {
    response_type: 'code',
    client_id: CLIENT_ID,
    scope,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
  };
  
  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
}

// Exchange authorization code for access token
export const getAccessToken = async (code) => {
  const codeVerifier = localStorage.getItem('code_verifier');
  
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', REDIRECT_URI);
  params.append('code_verifier', codeVerifier);
  
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    localStorage.setItem('spotify_access_token', response.data.access_token);
    localStorage.setItem('spotify_refresh_token', response.data.refresh_token);
    localStorage.removeItem('code_verifier');
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

// Get Spotify queue
export const getQueue = async (token) => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching queue:', error);
    return null;
  }
}

// Search Spotify for tracks
export const searchTracks = async (query, token) => {
  try {
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Set timeout to abort request if it takes too long
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await axios.get('https://api.spotify.com/v1/search', {
      signal,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        q: query,
        type: 'track',
        limit: 8
      }
    });
    
    clearTimeout(timeoutId);
    return response.data.tracks.items;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Search request timed out');
    } else {
      console.error('Error searching tracks:', error);
    }
    return [];
  }
};

// Add track to queue
export const addToQueue = async (trackUri, token) => {
  try {
    await axios.post('https://api.spotify.com/v1/me/player/queue', null, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        uri: trackUri
      }
    });
    return true;
  } catch (error) {
    console.error('Error adding to queue:', error);
    return false;
  }
};