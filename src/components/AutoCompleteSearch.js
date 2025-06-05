import React, { useState, useEffect, useRef } from 'react';
import { searchTracks } from '../utils/spotifyAPI';

const AutoCompleteSearch = ({ token, onAddToQueue }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // Debounce search to avoid excessive API calls
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    setShowResults(true);
    
    const delayDebounce = setTimeout(async () => {
      try {
        const searchResults = await searchTracks(query, token);
        setResults(searchResults);
        setActiveIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, token]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showResults) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            handleSelect(results[activeIndex]);
          }
          break;
        case 'Escape':
          setShowResults(false);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showResults, results, activeIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (track) => {
    onAddToQueue(track.uri);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setShowResults(true);
  };

  return (
    <div className="auto-complete-container" ref={searchRef}>
      <div className="search-input-container">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search songs, artists..."
          className="search-input"
          onFocus={() => setShowResults(true)}
        />
        {isLoading && (
          <div className="search-spinner">
            <div className="spinner"></div>
          </div>
        )}
      </div>

      {showResults && query && (
        <div className="search-results-dropdown">
          {isLoading ? (
            <div className="dropdown-item">
              <div className="spinner small"></div>
              <span>Searching...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="dropdown-item no-results">
              No results found for "{query}"
            </div>
          ) : (
            results.map((track, index) => (
              <div
                key={track.id}
                className={`dropdown-item ${index === activeIndex ? 'active' : ''}`}
                onClick={() => handleSelect(track)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div className="track-image">
                  {track.album.images[0] ? (
                    <img 
                      src={track.album.images[0].url} 
                      alt={track.name} 
                    />
                  ) : (
                    <div className="image-placeholder">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M6 3l14 9-14 9V3z" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div className="track-info">
                  <div className="track-name">{track.name}</div>
                  <div className="track-artist">
                    {track.artists.map(artist => artist.name).join(', ')}
                  </div>
                </div>
                
                <div className="track-duration">
                  {Math.floor(track.duration_ms / 60000)}:
                  {((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AutoCompleteSearch;