import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || window.location.origin;

const api = axios.create({
  baseURL,
  withCredentials: true,
});

export class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const toApiError = (error, fallbackMessage) => {
  if (error.response) {
    const { status, data } = error.response;
    const isAuthError = status === 401 || status === 403;
    return new ApiError(
      data?.error || (isAuthError ? 'Windows authentication did not complete.' : fallbackMessage),
      data?.code || (isAuthError ? 'UNAUTHORIZED' : 'API_ERROR'),
      status,
      data?.details
    );
  }

  return new ApiError(
    'Network error. Check that the Office Jukebox server is running.',
    'NETWORK_ERROR',
    null
  );
};

const request = async (operation, fallbackMessage) => {
  try {
    return await operation();
  } catch (error) {
    throw toApiError(error, fallbackMessage);
  }
};

export const getMe = async () => {
  const response = await request(() => api.get('/api/me'), 'Unable to verify Windows session.');
  return response.data;
};

export const getQueue = async () => {
  const response = await request(() => api.get('/api/queue'), 'Failed to load Spotify queue.');
  return response.data;
};

export const getPlayerState = async () => {
  const response = await request(() => api.get('/api/player'), 'Failed to load Spotify playback state.');
  return response.data;
};

export const getSongInfo = async (track) => {
  const response = await request(
    () => api.post('/api/song-info', { track }),
    'Failed to load song details.'
  );
  return response.data;
};

export const searchTracks = async (query) => {
  const response = await request(
    () => api.get('/api/search', { params: { q: query } }),
    'Spotify search failed.'
  );
  return response.data.tracks?.items || response.data.tracks || [];
};

export const addToQueue = async (trackUri) => {
  await request(
    () => api.post('/api/add-to-queue', { uri: trackUri }),
    'Failed to add song to the queue.'
  );
};

export const play = async () => {
  await request(() => api.post('/api/player/play'), 'Failed to start playback.');
};

export const pause = async () => {
  await request(() => api.post('/api/player/pause'), 'Failed to pause playback.');
};

export const restart = async () => {
  await request(() => api.post('/api/player/restart'), 'Failed to restart the current track.');
};

export const skip = async () => {
  await request(() => api.post('/api/player/skip'), 'Failed to skip to the next track.');
};

export const setVolume = async (volumePercent) => {
  await request(
    () => api.put('/api/player/volume', { volumePercent }),
    'Failed to update playback volume.'
  );
};

export const getDevices = async () => {
  const response = await request(() => api.get('/api/devices'), 'Failed to load Spotify devices.');
  return response.data.devices || [];
};

export const getSelectedDevice = async () => {
  const response = await request(
    () => api.get('/api/settings/device'),
    'Failed to load selected Spotify device.'
  );
  return response.data.selectedDeviceId || '';
};

export const saveSelectedDevice = async (deviceId) => {
  const response = await request(
    () => api.put('/api/settings/device', { deviceId }),
    'Failed to save selected Spotify device.'
  );
  return response.data;
};
