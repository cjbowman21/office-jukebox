import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Volume2 } from 'lucide-react';
import { pause, play, restart, setVolume, skip } from '../utils/spotifyAPI';

const clampVolume = (value) => Math.max(0, Math.min(100, Number(value)));

const PlayerControls = ({ player, disabled, onCommand, onError }) => {
  const [pendingCommand, setPendingCommand] = useState('');
  const [volume, setLocalVolume] = useState(player?.device?.volume_percent ?? 50);

  const isPlaying = Boolean(player?.is_playing);
  const supportsVolume = Boolean(player?.device?.supports_volume);

  useEffect(() => {
    if (typeof player?.device?.volume_percent === 'number') {
      setLocalVolume(player.device.volume_percent);
    }
  }, [player?.device?.volume_percent]);

  const runCommand = async (name, operation) => {
    setPendingCommand(name);
    try {
      await operation();
      await onCommand?.(name);
    } catch (error) {
      onError?.(error);
    } finally {
      setPendingCommand('');
    }
  };

  const commitVolume = async (event) => {
    const nextVolume = clampVolume(event.currentTarget.value);
    setLocalVolume(nextVolume);
    await runCommand('volume', () => setVolume(nextVolume));
  };

  const commandDisabled = disabled || Boolean(pendingCommand);
  const playbackAction = isPlaying ? pause : play;
  const playbackLabel = isPlaying ? 'Pause' : 'Play';

  return (
    <div className="player-controls" aria-label="Playback controls">
      <button
        type="button"
        className="icon-button primary"
        onClick={() => runCommand(isPlaying ? 'pause' : 'play', playbackAction)}
        disabled={commandDisabled}
        title={playbackLabel}
        aria-label={playbackLabel}
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>

      <button
        type="button"
        className="icon-button"
        onClick={() => runCommand('restart', restart)}
        disabled={commandDisabled}
        title="Restart track"
        aria-label="Restart track"
      >
        <RotateCcw size={18} />
      </button>

      <button
        type="button"
        className="icon-button"
        onClick={() => runCommand('skip', skip)}
        disabled={commandDisabled}
        title="Skip track"
        aria-label="Skip track"
      >
        <SkipForward size={18} />
      </button>

      <label className={`volume-control ${!supportsVolume ? 'disabled' : ''}`} htmlFor="volume-control">
        <Volume2 size={18} aria-hidden="true" />
        <span className="sr-only">Volume</span>
        <input
          id="volume-control"
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          onChange={(event) => setLocalVolume(clampVolume(event.target.value))}
          onMouseUp={commitVolume}
          onTouchEnd={commitVolume}
          disabled={commandDisabled || !supportsVolume}
          aria-label="Volume"
        />
        <span className="volume-value">{volume}%</span>
      </label>
    </div>
  );
};

export default PlayerControls;
