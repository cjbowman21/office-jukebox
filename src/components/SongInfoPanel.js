import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Info, Music2, X } from 'lucide-react';
import { getSongInfo } from '../utils/spotifyAPI';

const artistNames = (track) => track?.artists?.map((artist) => artist.name).join(', ') || 'Unknown artist';

const sourceTitle = (item) => {
  if (!item.sourceName) {
    return '';
  }
  return item.sourceUrl ? `${item.sourceName} source` : item.sourceName;
};

const SongInfoPanel = ({ open, track, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trackKey = useMemo(() => {
    if (!track) {
      return '';
    }
    return track.id || track.uri || `${track.name}-${artistNames(track)}`;
  }, [track]);

  useEffect(() => {
    if (!open || !track) {
      return undefined;
    }

    let active = true;

    const loadDetails = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await getSongInfo(track);
        if (active) {
          setDetails(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Song details are unavailable.');
          setDetails(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      active = false;
    };
  }, [open, trackKey]);

  if (!open) {
    return null;
  }

  const imageUrl = track?.album?.images?.[0]?.url;
  const cards = details?.cards || [];
  const facts = details?.facts || [];
  const links = details?.links || [];

  return (
    <div className="song-info-backdrop" onClick={onClose}>
      <aside
        className="song-info-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-info-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="song-info-header">
          <div>
            <p className="eyebrow">About this song</p>
            <h2 id="song-info-title">{track?.name || 'Current track'}</h2>
            {track && <p>{artistNames(track)}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close song details">
            <X size={18} />
          </button>
        </div>

        {imageUrl && (
          <img src={imageUrl} alt="" className="song-info-art" />
        )}

        {loading && (
          <div className="song-info-state">
            <div className="spinner" />
            <p>Loading song details...</p>
          </div>
        )}

        {!loading && error && (
          <div className="song-info-state error-text">
            <Info size={22} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && details && (
          <div className="song-info-content">
            {cards.length > 0 ? (
              <div className="song-info-cards">
                {cards.map((item) => (
                  <article className="song-info-card" key={item.id}>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={sourceTitle(item)}>
                        {item.sourceName}
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="song-info-state">
                <Music2 size={22} />
                <p>No public trivia matched this track yet.</p>
              </div>
            )}

            {facts.length > 0 && (
              <dl className="song-fact-list">
                {facts.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="song-fact">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {links.length > 0 && (
              <div className="source-links">
                {links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};

export default SongInfoPanel;
