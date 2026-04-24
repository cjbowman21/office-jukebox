import React, { useEffect, useRef, useState } from 'react';
import { searchTracks } from '../utils/spotifyAPI';

const formatDuration = (durationMs) => {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const AutoCompleteSearch = ({ onAddToQueue, onError }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [pendingUri, setPendingUri] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setShowResults(false);
      setIsLoading(false);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setShowResults(true);

    const delayDebounce = window.setTimeout(async () => {
      try {
        const tracks = await searchTracks(trimmedQuery);
        if (active) {
          setResults(tracks);
          setActiveIndex(-1);
        }
      } catch (error) {
        if (active) {
          setResults([]);
          onError?.(error);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(delayDebounce);
    };
  }, [query, onError]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (track) => {
    setPendingUri(track.uri);
    try {
      const added = await onAddToQueue(track.uri);
      if (added !== false) {
        setQuery('');
        setResults([]);
        setShowResults(false);
      }
    } finally {
      setPendingUri('');
    }
  };

  const handleKeyDown = (event) => {
    if (!showResults) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, -1));
    }

    if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < results.length) {
      event.preventDefault();
      handleSelect(results[activeIndex]);
    }

    if (event.key === 'Escape') {
      setShowResults(false);
    }
  };

  return (
    <div className="search-panel" ref={searchRef}>
      <label htmlFor="track-search">Add a song</label>
      <div className="search-input-wrap">
        <input
          id="track-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowResults(true);
          }}
          onFocus={() => query && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search songs or artists"
          autoComplete="off"
        />
        {isLoading && <div className="spinner small" aria-label="Searching" />}
      </div>

      {showResults && query.trim() && (
        <div className="search-results-dropdown" role="listbox" aria-label="Spotify search results">
          {isLoading ? (
            <div className="dropdown-row muted">Searching Spotify...</div>
          ) : results.length === 0 ? (
            <div className="dropdown-row muted">No results found for "{query}"</div>
          ) : (
            results.map((track, index) => (
              <button
                type="button"
                key={track.id}
                className={`dropdown-row result-row ${index === activeIndex ? 'active' : ''}`}
                onClick={() => handleSelect(track)}
                onMouseEnter={() => setActiveIndex(index)}
                disabled={Boolean(pendingUri)}
              >
                <span className="track-image">
                  {track.album?.images?.[0] ? (
                    <img src={track.album.images[0].url} alt="" />
                  ) : (
                    <span className="image-placeholder" />
                  )}
                </span>
                <span className="track-copy">
                  <span className="track-name">{track.name}</span>
                  <span className="track-artist">{track.artists.map((artist) => artist.name).join(', ')}</span>
                </span>
                <span className="track-duration">{formatDuration(track.duration_ms)}</span>
                <span className="add-label">{pendingUri === track.uri ? 'Adding' : 'Add'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AutoCompleteSearch;
