require('dotenv').config({ quiet: true });

const express = require('express');
const ntlm = require('express-ntlm');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs/promises');

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const DEFAULT_SETTINGS_PATH = path.join(__dirname, 'settings.local.json');

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sendApiError(res, status, code, error, details) {
  const body = { error, code };
  if (details) {
    body.details = details;
  }
  return res.status(status).json(body);
}

function routeError(res, err, fallbackCode, fallbackMessage) {
  if (err instanceof ApiError) {
    return sendApiError(res, err.status, err.code, err.message, err.details);
  }

  const spotifyStatus = err.response && err.response.status;
  const spotifyError = err.response && err.response.data && err.response.data.error;
  const spotifyMessage = typeof spotifyError === 'string'
    ? spotifyError
    : spotifyError && spotifyError.message;

  const status = spotifyStatus && spotifyStatus >= 400 && spotifyStatus < 500
    ? spotifyStatus
    : 502;

  return sendApiError(res, status, fallbackCode, fallbackMessage, spotifyMessage);
}

function ensureAuthenticated(req, res, next) {
  if (!req.ntlm || !req.ntlm.Authenticated) {
    return sendApiError(res, 401, 'UNAUTHORIZED', 'Windows authentication is required.');
  }
  return next();
}

function createNtlmMiddleware(env = process.env) {
  const config = {};

  if (env.NTLM_DOMAIN) {
    config.domain = env.NTLM_DOMAIN;
  }

  if (env.NTLM_DOMAIN_CONTROLLER) {
    config.domaincontroller = env.NTLM_DOMAIN_CONTROLLER;
  }

  if (env.NTLM_DEBUG === 'true') {
    config.debug = console.log;
  }

  return ntlm(config);
}

function createSettingsStore(filePath = DEFAULT_SETTINGS_PATH) {
  const defaultSettings = { selectedDeviceId: null };

  async function readSettings() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return { ...defaultSettings, ...JSON.parse(raw) };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { ...defaultSettings };
      }
      if (err instanceof SyntaxError) {
        throw new ApiError(500, 'SETTINGS_INVALID', 'Local settings file is not valid JSON.');
      }
      throw new ApiError(500, 'SETTINGS_READ_FAILED', 'Failed to read local settings.');
    }
  }

  async function writeSettings(settings) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify({ ...defaultSettings, ...settings }, null, 2)}\n`);
    } catch (err) {
      throw new ApiError(500, 'SETTINGS_WRITE_FAILED', 'Failed to write local settings.');
    }
  }

  return {
    filePath,
    async get() {
      return readSettings();
    },
    async getSelectedDeviceId() {
      const settings = await readSettings();
      return settings.selectedDeviceId;
    },
    async setSelectedDeviceId(selectedDeviceId) {
      const settings = await readSettings();
      const updated = { ...settings, selectedDeviceId };
      await writeSettings(updated);
      return updated;
    },
  };
}

function requireSpotifyConfig(env) {
  const missing = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_REFRESH_TOKEN',
  ].filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new ApiError(
      500,
      'SPOTIFY_CONFIG_MISSING',
      'Spotify credentials are not configured.',
      missing
    );
  }
}

async function requireSelectedDeviceId(settingsStore) {
  const selectedDeviceId = await settingsStore.getSelectedDeviceId();

  if (!selectedDeviceId) {
    throw new ApiError(409, 'MISSING_DEVICE', 'Select a Spotify device before controlling playback.');
  }

  return selectedDeviceId;
}

function createSpotifyClient({ axiosInstance = axios, env = process.env } = {}) {
  let accessToken = null;
  let tokenExpiresAt = 0;

  async function getAccessToken(forceRefresh = false) {
    if (!forceRefresh && accessToken && Date.now() < tokenExpiresAt) {
      return accessToken;
    }

    requireSpotifyConfig(env);

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', env.SPOTIFY_REFRESH_TOKEN);

    const authHeader = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

    try {
      const response = await axiosInstance.post(SPOTIFY_TOKEN_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${authHeader}`,
        },
      });

      accessToken = response.data.access_token;
      tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;
      return accessToken;
    } catch (err) {
      throw new ApiError(502, 'SPOTIFY_TOKEN_FAILED', 'Failed to refresh Spotify access token.');
    }
  }

  async function request(method, url, options = {}, retryOnUnauthorized = true) {
    const token = await getAccessToken();
    const headers = { ...options.headers, Authorization: `Bearer ${token}` };

    try {
      return await axiosInstance({ method, url, ...options, headers });
    } catch (err) {
      if (retryOnUnauthorized && err.response && err.response.status === 401) {
        accessToken = null;
        tokenExpiresAt = 0;
        return request(method, url, options, false);
      }
      throw err;
    }
  }

  return {
    getAccessToken,
    async searchTracks(query) {
      const response = await request('get', `${SPOTIFY_API_BASE}/search`, {
        params: { q: query, type: 'track', limit: 10 },
      });
      return response.data;
    },
    async getQueue() {
      const response = await request('get', `${SPOTIFY_API_BASE}/me/player/queue`);
      return response.data;
    },
    async getDevices() {
      const response = await request('get', `${SPOTIFY_API_BASE}/me/player/devices`);
      return response.data;
    },
    async getPlaybackState() {
      const response = await request('get', `${SPOTIFY_API_BASE}/me/player`);
      return response.data || null;
    },
    async addToQueue(uri, deviceId) {
      const response = await request('post', `${SPOTIFY_API_BASE}/me/player/queue`, {
        params: { uri, device_id: deviceId },
      });
      return response.data;
    },
    async play(deviceId) {
      const response = await request('put', `${SPOTIFY_API_BASE}/me/player/play`, {
        params: { device_id: deviceId },
      });
      return response.data;
    },
    async pause(deviceId) {
      const response = await request('put', `${SPOTIFY_API_BASE}/me/player/pause`, {
        params: { device_id: deviceId },
      });
      return response.data;
    },
    async seek(positionMs, deviceId) {
      const response = await request('put', `${SPOTIFY_API_BASE}/me/player/seek`, {
        params: { position_ms: positionMs, device_id: deviceId },
      });
      return response.data;
    },
    async skipNext(deviceId) {
      const response = await request('post', `${SPOTIFY_API_BASE}/me/player/next`, {
        params: { device_id: deviceId },
      });
      return response.data;
    },
    async setVolume(volumePercent, deviceId) {
      const response = await request('put', `${SPOTIFY_API_BASE}/me/player/volume`, {
        params: { volume_percent: volumePercent, device_id: deviceId },
      });
      return response.data;
    },
  };
}

function createApp({
  authMiddleware,
  env = process.env,
  serveStatic = env.NODE_ENV === 'production',
  settingsStore = createSettingsStore(env.SETTINGS_FILE || DEFAULT_SETTINGS_PATH),
  spotifyClient = createSpotifyClient({ env }),
} = {}) {
  const app = express();
  const clientOrigin = env.CLIENT_ORIGIN || 'http://localhost:5173';

  app.use(express.json());
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use('/api', authMiddleware || createNtlmMiddleware(env));

  app.get('/api/me', ensureAuthenticated, (req, res) => {
    const { UserName, DomainName, Workstation } = req.ntlm;
    res.json({ username: UserName, domain: DomainName, workstation: Workstation });
  });

  app.get('/api/search', ensureAuthenticated, async (req, res) => {
    const query = req.query.q;

    if (!query || !query.trim()) {
      return sendApiError(res, 400, 'MISSING_QUERY', 'Missing q parameter.');
    }

    try {
      const data = await spotifyClient.searchTracks(query.trim());
      return res.json(data);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_SEARCH_FAILED', 'Spotify search failed.');
    }
  });

  app.get('/api/queue', ensureAuthenticated, async (req, res) => {
    try {
      const data = await spotifyClient.getQueue();
      return res.json(data);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_QUEUE_FAILED', 'Spotify queue fetch failed.');
    }
  });

  app.get('/api/player', ensureAuthenticated, async (req, res) => {
    try {
      const data = await spotifyClient.getPlaybackState();
      return res.json(data);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_PLAYER_FAILED', 'Spotify playback state fetch failed.');
    }
  });

  app.get('/api/devices', ensureAuthenticated, async (req, res) => {
    try {
      const data = await spotifyClient.getDevices();
      return res.json(data);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_DEVICES_FAILED', 'Spotify devices fetch failed.');
    }
  });

  app.get('/api/settings/device', ensureAuthenticated, async (req, res) => {
    try {
      const selectedDeviceId = await settingsStore.getSelectedDeviceId();
      return res.json({ selectedDeviceId });
    } catch (err) {
      return routeError(res, err, 'SETTINGS_READ_FAILED', 'Failed to read selected Spotify device.');
    }
  });

  app.put('/api/settings/device', ensureAuthenticated, async (req, res) => {
    const { deviceId } = req.body;

    if (!deviceId || typeof deviceId !== 'string') {
      return sendApiError(res, 400, 'MISSING_DEVICE_ID', 'Missing deviceId in body.');
    }

    try {
      const deviceData = await spotifyClient.getDevices();
      const devices = deviceData.devices || [];
      const selectedDevice = devices.find((device) => device.id === deviceId);

      if (!selectedDevice) {
        return sendApiError(res, 404, 'DEVICE_UNAVAILABLE', 'Selected Spotify device is not available.');
      }

      const settings = await settingsStore.setSelectedDeviceId(deviceId);
      return res.json({ selectedDeviceId: settings.selectedDeviceId, device: selectedDevice });
    } catch (err) {
      return routeError(res, err, 'DEVICE_SAVE_FAILED', 'Failed to save selected Spotify device.');
    }
  });

  app.post('/api/add-to-queue', ensureAuthenticated, async (req, res) => {
    const { uri } = req.body;

    if (!uri || typeof uri !== 'string') {
      return sendApiError(res, 400, 'MISSING_URI', 'Missing uri in body.');
    }

    try {
      const selectedDeviceId = await requireSelectedDeviceId(settingsStore);

      await spotifyClient.addToQueue(uri, selectedDeviceId);
      return res.sendStatus(204);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return sendApiError(res, 404, 'DEVICE_UNAVAILABLE', 'Selected Spotify device is not available.');
      }
      return routeError(res, err, 'SPOTIFY_ADD_FAILED', 'Spotify add to queue failed.');
    }
  });

  app.post('/api/player/play', ensureAuthenticated, async (req, res) => {
    try {
      const selectedDeviceId = await requireSelectedDeviceId(settingsStore);
      await spotifyClient.play(selectedDeviceId);
      return res.sendStatus(204);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_PLAY_FAILED', 'Spotify play command failed.');
    }
  });

  app.post('/api/player/pause', ensureAuthenticated, async (req, res) => {
    try {
      const selectedDeviceId = await requireSelectedDeviceId(settingsStore);
      await spotifyClient.pause(selectedDeviceId);
      return res.sendStatus(204);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_PAUSE_FAILED', 'Spotify pause command failed.');
    }
  });

  app.post('/api/player/restart', ensureAuthenticated, async (req, res) => {
    try {
      const selectedDeviceId = await requireSelectedDeviceId(settingsStore);
      await spotifyClient.seek(0, selectedDeviceId);
      return res.sendStatus(204);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_RESTART_FAILED', 'Spotify restart command failed.');
    }
  });

  app.post('/api/player/skip', ensureAuthenticated, async (req, res) => {
    try {
      const selectedDeviceId = await requireSelectedDeviceId(settingsStore);
      await spotifyClient.skipNext(selectedDeviceId);
      return res.sendStatus(204);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_SKIP_FAILED', 'Spotify skip command failed.');
    }
  });

  app.put('/api/player/volume', ensureAuthenticated, async (req, res) => {
    const volumePercent = Number(req.body.volumePercent);

    if (!Number.isInteger(volumePercent) || volumePercent < 0 || volumePercent > 100) {
      return sendApiError(res, 400, 'INVALID_VOLUME', 'volumePercent must be an integer from 0 to 100.');
    }

    try {
      const selectedDeviceId = await requireSelectedDeviceId(settingsStore);
      await spotifyClient.setVolume(volumePercent, selectedDeviceId);
      return res.sendStatus(204);
    } catch (err) {
      return routeError(res, err, 'SPOTIFY_VOLUME_FAILED', 'Spotify volume command failed.');
    }
  });

  if (serveStatic) {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const app = createApp({
    serveStatic: process.argv.includes('--serve-static') || process.env.NODE_ENV === 'production',
  });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = {
  ApiError,
  createApp,
  createNtlmMiddleware,
  createSettingsStore,
  createSpotifyClient,
  ensureAuthenticated,
  requireSelectedDeviceId,
  sendApiError,
};
