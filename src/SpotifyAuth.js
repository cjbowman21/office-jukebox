const clientId = "adcc3780cf0849aca6626978a67c209d";
const redirectUri = "http://127.0.0.1:3000/callback";

export const getAccessToken = () => {
  return localStorage.getItem('spotify_access_token');
};

export const login = () => {
  const scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
  window.location = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token&show_dialog=true`;
};

export const handleCallback = () => {
  // This is now handled in App.js
  return null;
};