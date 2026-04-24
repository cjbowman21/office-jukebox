import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import PlayerControls from './PlayerControls';
import SongInfoPanel from './SongInfoPanel';
import { getPlayerState, getQueue } from '../utils/spotifyAPI';

const AUTO_REFRESH_MS = 8000;

const formatDuration = (durationMs = 0) => {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const artistNames = (track) => track?.artists?.map((artist) => artist.name).join(', ') || 'Unknown artist';

const QueueViewer = ({ refreshToken }) => {
  const [queue, setQueue] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [songInfoOpen, setSongInfoOpen] = useState(false);

  const loadPlayback = async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [queueData, playerData] = await Promise.all([
        getQueue(),
        getPlayerState(),
      ]);
      setQueue(queueData);
      setPlayer(playerData);
      if (!playerData?.item && !queueData?.currently_playing) {
        setSongInfoOpen(false);
      }
      setError('');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.code === 'SPOTIFY_QUEUE_FAILED'
        ? 'Failed to load queue. Make sure Spotify is playing on the office account.'
        : err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    let intervalId;

    const fetchQueue = async (silent = false) => {
      if (!active) {
        return;
      }
      await loadPlayback(silent);
    };

    fetchQueue(false);
    intervalId = window.setInterval(() => fetchQueue(true), AUTO_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshToken]);

  const handleRefresh = async () => {
    await loadPlayback(true);
  };

  const handlePlaybackCommand = async () => {
    await loadPlayback(true);
  };

  if (loading) {
    return (
      <section className="queue-section state-panel">
        <div className="spinner" />
        <p>Loading queue...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="queue-section state-panel error-panel">
        <h2>Queue unavailable</h2>
        <p>{error}</p>
        <button type="button" onClick={handleRefresh}>Retry</button>
      </section>
    );
  }

  const currentTrack = player?.item || queue?.currently_playing;
  const upcoming = queue?.queue || [];
  const progressMs = player?.progress_ms || 0;
  const durationMs = currentTrack?.duration_ms || 0;
  const progressPercent = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0;

  return (
    <section className="queue-section" aria-live="polite">
      <div className="section-header">
        <div>
          <p className="eyebrow">Now playing</p>
          <h2>{currentTrack ? currentTrack.name : 'Nothing is playing'}</h2>
          {currentTrack && (
            <p>
              {artistNames(currentTrack)}
              {player && <span className="playback-state"> - {player.is_playing ? 'Playing' : 'Paused'}</span>}
            </p>
          )}
        </div>
        <div className="header-actions">
          {currentTrack && (
            <button
              type="button"
              className="ghost-button icon-text-button"
              onClick={() => setSongInfoOpen(true)}
            >
              <Info size={16} aria-hidden="true" />
              About this song
            </button>
          )}
          <button type="button" className="ghost-button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing' : 'Refresh queue'}
          </button>
        </div>
      </div>

      {currentTrack && (
        <div className="now-playing">
          {currentTrack.album?.images?.[0] && (
            <img src={currentTrack.album.images[0].url} alt="" className="album-cover" />
          )}
          <div className="now-playing-copy">
            <h3>{currentTrack.album?.name}</h3>
            <p className="muted">
              {formatDuration(progressMs)} / {formatDuration(durationMs)}
            </p>
            <div className="progress-track" aria-label="Playback progress">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
      )}

      <PlayerControls
        player={player}
        disabled={false}
        onCommand={handlePlaybackCommand}
        onError={(err) => setError(err.message)}
      />

      <div className="section-header compact">
        <div>
          <p className="eyebrow">Up next</p>
          <h2>{upcoming.length} queued</h2>
        </div>
        {lastUpdated && <p className="updated-note">Updated {lastUpdated.toLocaleTimeString()}</p>}
      </div>

      {upcoming.length > 0 ? (
        <ol className="queue-list">
          {upcoming.map((track, index) => (
            <li key={`${track.uri}-${index}`} className="queue-item">
              <span className="queue-index">{index + 1}</span>
              <span className="track-copy">
                <span className="track-name">{track.name}</span>
                <span className="track-artist">{artistNames(track)}</span>
              </span>
              <span className="track-duration">{formatDuration(track.duration_ms)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-text">The queue is empty.</p>
      )}

      <SongInfoPanel
        open={songInfoOpen}
        track={currentTrack}
        onClose={() => setSongInfoOpen(false)}
      />
    </section>
  );
};

export default QueueViewer;
