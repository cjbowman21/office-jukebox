// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {
  addToQueue,
  getDevices,
  getMe,
  getPlayerState,
  getQueue,
  getSelectedDevice,
  getSongInfo,
  pause,
  play,
  restart,
  saveSelectedDevice,
  searchTracks,
  setVolume,
  skip,
} from './utils/spotifyAPI';

vi.mock('./utils/spotifyAPI', () => ({
  addToQueue: vi.fn(),
  getDevices: vi.fn(),
  getMe: vi.fn(),
  getPlayerState: vi.fn(),
  getQueue: vi.fn(),
  getSelectedDevice: vi.fn(),
  getSongInfo: vi.fn(),
  pause: vi.fn(),
  play: vi.fn(),
  restart: vi.fn(),
  saveSelectedDevice: vi.fn(),
  searchTracks: vi.fn(),
  setVolume: vi.fn(),
  skip: vi.fn(),
}));

const device = {
  id: 'device-1',
  name: 'Conference Room Speaker',
  type: 'Speaker',
  is_active: true,
};

const queue = {
  currently_playing: {
    uri: 'spotify:track:current',
    name: 'Current Song',
    duration_ms: 210000,
    artists: [{ name: 'Current Artist' }],
    album: { name: 'Current Album', images: [] },
  },
  queue: [
    {
      uri: 'spotify:track:queued',
      name: 'Queued Song',
      duration_ms: 180000,
      artists: [{ name: 'Queued Artist' }],
      album: { name: 'Queued Album', images: [] },
    },
  ],
};

const player = {
  is_playing: true,
  progress_ms: 45000,
  device: {
    id: 'device-1',
    name: 'Conference Room Speaker',
    volume_percent: 40,
    supports_volume: true,
  },
  item: queue.currently_playing,
};

const track = {
  id: 'track-1',
  uri: 'spotify:track:track-1',
  name: 'One More Time',
  duration_ms: 320000,
  artists: [{ name: 'Daft Punk' }],
  album: { name: 'Discovery', images: [] },
};

const mockHappyPath = () => {
  getMe.mockResolvedValue({ username: 'cbowman', domain: 'OFFICE', workstation: 'DESK' });
  getDevices.mockResolvedValue([device]);
  getSelectedDevice.mockResolvedValue('');
  getQueue.mockResolvedValue(queue);
  getPlayerState.mockResolvedValue(player);
  getSongInfo.mockResolvedValue({
    cards: [
      {
        id: 'artist',
        title: 'Artist Background',
        body: 'Daft Punk were a French electronic music duo.',
        sourceName: 'Wikipedia',
        sourceUrl: 'https://example.com/daft-punk',
      },
    ],
    facts: [{ label: 'Genre', value: 'Electronic', sourceName: 'TheAudioDB' }],
    links: [{ label: 'Wikipedia artist', url: 'https://example.com/daft-punk' }],
  });
  saveSelectedDevice.mockResolvedValue({ selectedDeviceId: device.id, device });
  searchTracks.mockResolvedValue([track]);
  addToQueue.mockResolvedValue();
  pause.mockResolvedValue();
  play.mockResolvedValue();
  restart.mockResolvedValue();
  setVolume.mockResolvedValue();
  skip.mockResolvedValue();
};

const flushPromises = async (count = 4) => {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mockHappyPath();
});

afterEach(() => {
  vi.useRealTimers();
});

test('shows an authentication message when Windows auth fails', async () => {
  getMe.mockRejectedValue({ status: 401, message: 'Unauthorized' });

  render(<App />);

  expect(await screen.findByText(/authentication needed/i)).toBeInTheDocument();
  expect(screen.getByText(/windows authentication did not complete/i)).toBeInTheDocument();
});

test('loads the authenticated jukebox and saves a selected Spotify device', async () => {
  const user = userEvent.setup();

  render(<App />);

  expect(await screen.findByText(/current song/i)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText(/spotify connect device/i), device.id);

  await waitFor(() => expect(saveSelectedDevice).toHaveBeenCalledWith(device.id));
  expect(await screen.findByText(/spotify device set to conference room speaker/i)).toBeInTheDocument();
});

test('searches Spotify after debounce and adds a selected track to the queue', async () => {
  const user = userEvent.setup();

  render(<App />);

  await screen.findByText(/current song/i);
  await user.type(screen.getByLabelText(/add a song/i), 'daft');

  expect(await screen.findByText(/one more time/i)).toBeInTheDocument();
  await user.click(screen.getByText(/one more time/i));

  await waitFor(() => expect(addToQueue).toHaveBeenCalledWith(track.uri));
  expect(await screen.findByText(/song added to the office queue/i)).toBeInTheDocument();
});

test('auto-refreshes the queue while the app is open', async () => {
  vi.useFakeTimers();

  render(<App />);

  await flushPromises();
  expect(screen.getByText(/current song/i)).toBeInTheDocument();
  expect(getQueue).toHaveBeenCalledTimes(1);
  expect(getPlayerState).toHaveBeenCalledTimes(1);

  await act(async () => {
    vi.advanceTimersByTime(8000);
    await Promise.resolve();
  });

  expect(getQueue).toHaveBeenCalledTimes(2);
  expect(getPlayerState).toHaveBeenCalledTimes(2);
});

test('sends playback control commands and volume changes', async () => {
  const user = userEvent.setup();

  render(<App />);

  await screen.findByText(/current song/i);

  await user.click(screen.getByLabelText(/pause/i));
  await waitFor(() => expect(pause).toHaveBeenCalled());

  await user.click(screen.getByLabelText(/restart track/i));
  await waitFor(() => expect(restart).toHaveBeenCalled());

  await user.click(screen.getByLabelText(/skip track/i));
  await waitFor(() => expect(skip).toHaveBeenCalled());

  const volume = screen.getByLabelText(/volume/i);
  fireEvent.change(volume, { target: { value: '55' } });
  fireEvent.mouseUp(volume);

  await waitFor(() => expect(setVolume).toHaveBeenCalledWith(55));
});

test('opens the song details panel for the current track', async () => {
  const user = userEvent.setup();

  render(<App />);

  await screen.findByText(/current song/i);
  await user.click(screen.getByRole('button', { name: /about this song/i }));

  expect(await screen.findByText(/artist background/i)).toBeInTheDocument();
  expect(screen.getByText(/daft punk were a french electronic music duo/i)).toBeInTheDocument();
  expect(screen.getAllByText(/electronic/i).length).toBeGreaterThan(0);
  expect(getSongInfo).toHaveBeenCalledWith(player.item);
});
