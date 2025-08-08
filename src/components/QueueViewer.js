import React, { useState, useEffect } from 'react';
import { getQueue } from '../utils/spotifyAPI';

const QueueViewer = () => {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const queueData = await getQueue();
        if (queueData && queueData.unauthorized) {
          setError('Session expired. Please reauthenticate with Windows.');
        } else if (queueData && queueData.networkError) {
          setError('Network error. Please check your connection and try again.');
        } else if (queueData) {
          setQueue(queueData);
        } else {
          setError('Failed to load queue. Make sure Spotify is playing.');
        }
      } catch (err) {
        setError('Error fetching queue. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
  }, [lastUpdated]);

  if (loading) {
    return <div className="loading">Loading your queue...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!queue) {
    return <div className="empty">No queue data available</div>;
  }

  return (
    <div className="queue-container">
      <h2>Now Playing</h2>
      {queue.currently_playing ? (
        <div className="now-playing">
          <div className="track-info">
            <h3>{queue.currently_playing.name}</h3>
            <p className="artists">
              {queue.currently_playing.artists.map(artist => artist.name).join(', ')}
            </p>
            <p className="album">{queue.currently_playing.album.name}</p>
          </div>
          {queue.currently_playing.album.images[0] && (
            <img 
              src={queue.currently_playing.album.images[0].url} 
              alt="Album cover" 
              className="album-cover"
            />
          )}
        </div>
      ) : (
        <p>Nothing currently playing</p>
      )}

      <h2>Up Next</h2>
      <button onClick={() => setLastUpdated(Date.now())} className="refresh-btn">
      Refresh Queue
    </button>
      {queue.queue && queue.queue.length > 0 ? (
        <ul className="queue-list">
          {queue.queue.map((track, index) => (
            <li key={index} className="queue-item">
              <div className="track-info">
                <span className="track-number">{index + 1}.</span>
                <span className="track-name">{track.name}</span>
                <span className="track-artists">
                  {track.artists.map(artist => artist.name).join(', ')}
                </span>
              </div>
              <span className="track-duration">
                {Math.floor(track.duration_ms / 60000)}:
                {((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Your queue is empty</p>
      )}
    </div>
  );
};

export default QueueViewer;
