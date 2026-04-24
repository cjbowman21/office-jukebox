// @vitest-environment node
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');
const {
  createApp,
  createSettingsStore,
  createSpotifyClient,
} = require('./index');

const authMiddleware = (req, res, next) => {
  req.ntlm = {
    Authenticated: true,
    UserName: 'cbowman',
    DomainName: 'OFFICE',
    Workstation: 'DESK',
  };
  next();
};

const unauthenticatedMiddleware = (req, res, next) => {
  req.ntlm = { Authenticated: false };
  next();
};

const createSpotifyStub = () => ({
  searchTracks: vi.fn().mockResolvedValue({ tracks: { items: [{ id: 'track-1' }] } }),
  getQueue: vi.fn().mockResolvedValue({ currently_playing: null, queue: [] }),
  getPlaybackState: vi.fn().mockResolvedValue({
    is_playing: true,
    progress_ms: 1000,
    device: { id: 'device-1', volume_percent: 40, supports_volume: true },
    item: null,
  }),
  getDevices: vi.fn().mockResolvedValue({
    devices: [{ id: 'device-1', name: 'Conference Room Speaker', type: 'Speaker', is_active: true }],
  }),
  addToQueue: vi.fn().mockResolvedValue(),
  play: vi.fn().mockResolvedValue(),
  pause: vi.fn().mockResolvedValue(),
  seek: vi.fn().mockResolvedValue(),
  skipNext: vi.fn().mockResolvedValue(),
  setVolume: vi.fn().mockResolvedValue(),
});

const createSongInfoStub = () => ({
  getSongInfo: vi.fn().mockResolvedValue({
    cards: [
      {
        id: 'artist',
        title: 'Artist Background',
        body: 'A short sourced artist note.',
        sourceName: 'Wikipedia',
        sourceUrl: 'https://example.com/artist',
      },
    ],
    facts: [{ label: 'Genre', value: 'Electronic', sourceName: 'TheAudioDB' }],
    links: [{ label: 'Wikipedia artist', url: 'https://example.com/artist' }],
  }),
});

const createTempStore = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'office-jukebox-'));
  return createSettingsStore(path.join(dir, 'settings.local.json'));
};

test('rejects unauthenticated API calls with a standardized JSON error', async () => {
  const app = createApp({
    authMiddleware: unauthenticatedMiddleware,
    spotifyClient: createSpotifyStub(),
    settingsStore: await createTempStore(),
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  const response = await request(app).get('/api/me').expect(401);

  expect(response.body).toEqual({
    error: 'Windows authentication is required.',
    code: 'UNAUTHORIZED',
  });
});

test('returns the authenticated Windows profile', async () => {
  const app = createApp({
    authMiddleware,
    spotifyClient: createSpotifyStub(),
    settingsStore: await createTempStore(),
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  const response = await request(app).get('/api/me').expect(200);

  expect(response.body).toEqual({
    username: 'cbowman',
    domain: 'OFFICE',
    workstation: 'DESK',
  });
});

test('searches Spotify tracks through the protected API', async () => {
  const spotifyClient = createSpotifyStub();
  const app = createApp({
    authMiddleware,
    spotifyClient,
    settingsStore: await createTempStore(),
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  await request(app).get('/api/search?q=prince').expect(200);

  expect(spotifyClient.searchTracks).toHaveBeenCalledWith('prince');
});

test('persists and returns the selected Spotify device', async () => {
  const settingsStore = await createTempStore();
  const app = createApp({
    authMiddleware,
    spotifyClient: createSpotifyStub(),
    settingsStore,
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  await request(app)
    .put('/api/settings/device')
    .send({ deviceId: 'device-1' })
    .expect(200);

  expect(await settingsStore.getSelectedDeviceId()).toBe('device-1');

  const response = await request(app).get('/api/settings/device').expect(200);
  expect(response.body).toEqual({ selectedDeviceId: 'device-1' });
});

test('requires a selected device before adding to the queue', async () => {
  const app = createApp({
    authMiddleware,
    spotifyClient: createSpotifyStub(),
    settingsStore: await createTempStore(),
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  const response = await request(app)
    .post('/api/add-to-queue')
    .send({ uri: 'spotify:track:track-1' })
    .expect(409);

  expect(response.body.code).toBe('MISSING_DEVICE');
});

test('adds tracks to the persisted selected Spotify device', async () => {
  const spotifyClient = createSpotifyStub();
  const settingsStore = await createTempStore();
  await settingsStore.setSelectedDeviceId('device-1');

  const app = createApp({
    authMiddleware,
    spotifyClient,
    settingsStore,
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  await request(app)
    .post('/api/add-to-queue')
    .send({ uri: 'spotify:track:track-1' })
    .expect(204);

  expect(spotifyClient.addToQueue).toHaveBeenCalledWith('spotify:track:track-1', 'device-1');
});

test('returns Spotify playback state', async () => {
  const spotifyClient = createSpotifyStub();
  const app = createApp({
    authMiddleware,
    spotifyClient,
    settingsStore: await createTempStore(),
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  const response = await request(app).get('/api/player').expect(200);

  expect(response.body.is_playing).toBe(true);
  expect(spotifyClient.getPlaybackState).toHaveBeenCalled();
});

test('returns live song enrichment for a track without storing data', async () => {
  const songInfoClient = createSongInfoStub();
  const app = createApp({
    authMiddleware,
    spotifyClient: createSpotifyStub(),
    songInfoClient,
    settingsStore: await createTempStore(),
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  const track = {
    name: 'Current Song',
    artists: [{ name: 'Current Artist' }],
    external_ids: { isrc: 'USRC17607839' },
  };

  const response = await request(app)
    .post('/api/song-info')
    .send({ track })
    .expect(200);

  expect(songInfoClient.getSongInfo).toHaveBeenCalledWith(track);
  expect(response.body.cards[0].title).toBe('Artist Background');
});

test('sends playback commands to the persisted selected device', async () => {
  const spotifyClient = createSpotifyStub();
  const settingsStore = await createTempStore();
  await settingsStore.setSelectedDeviceId('device-1');

  const app = createApp({
    authMiddleware,
    spotifyClient,
    settingsStore,
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  await request(app).post('/api/player/play').expect(204);
  await request(app).post('/api/player/pause').expect(204);
  await request(app).post('/api/player/restart').expect(204);
  await request(app).post('/api/player/skip').expect(204);
  await request(app).put('/api/player/volume').send({ volumePercent: 33 }).expect(204);

  expect(spotifyClient.play).toHaveBeenCalledWith('device-1');
  expect(spotifyClient.pause).toHaveBeenCalledWith('device-1');
  expect(spotifyClient.seek).toHaveBeenCalledWith(0, 'device-1');
  expect(spotifyClient.skipNext).toHaveBeenCalledWith('device-1');
  expect(spotifyClient.setVolume).toHaveBeenCalledWith(33, 'device-1');
});

test('validates playback volume before calling Spotify', async () => {
  const spotifyClient = createSpotifyStub();
  const settingsStore = await createTempStore();
  await settingsStore.setSelectedDeviceId('device-1');

  const app = createApp({
    authMiddleware,
    spotifyClient,
    settingsStore,
    env: { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' },
  });

  const response = await request(app)
    .put('/api/player/volume')
    .send({ volumePercent: 101 })
    .expect(400);

  expect(response.body.code).toBe('INVALID_VOLUME');
  expect(spotifyClient.setVolume).not.toHaveBeenCalled();
});

test('refreshes and reuses Spotify access tokens', async () => {
  const axiosInstance = vi.fn().mockResolvedValue({ data: { queue: [] } });
  axiosInstance.post = vi.fn().mockResolvedValue({
    data: { access_token: 'access-token', expires_in: 3600 },
  });

  const spotifyClient = createSpotifyClient({
    axiosInstance,
    env: {
      SPOTIFY_CLIENT_ID: 'client',
      SPOTIFY_CLIENT_SECRET: 'secret',
      SPOTIFY_REFRESH_TOKEN: 'refresh',
    },
  });

  await spotifyClient.getQueue();
  await spotifyClient.getDevices();

  expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  expect(axiosInstance).toHaveBeenCalledTimes(2);
  expect(axiosInstance).toHaveBeenCalledWith(expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
  }));
});
