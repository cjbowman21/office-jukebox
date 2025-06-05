import React from 'react';

const SearchResults = ({ results, onAddToQueue, isLoading }) => {
  if (isLoading) {
    return (
      <div className="loading-results">
        <div className="spinner"></div>
        <p>Searching Spotify...</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return <div className="no-results">No results found. Try a different search.</div>;
  }

  return (
    <div className="search-results">
      <h3>Search Results</h3>
      <ul>
        {results.map((track) => (
          <li key={track.id} className="track-result">
            <div className="track-info">
              {track.album.images[0] && (
                <img 
                  src={track.album.images[0].url} 
                  alt="Album cover" 
                  className="album-thumb"
                />
              )}
              <div className="track-details">
                <div className="track-name">{track.name}</div>
                <div className="track-artists">
                  {track.artists.map(artist => artist.name).join(', ')}
                </div>
                <div className="track-album">{track.album.name}</div>
              </div>
            </div>
            <button 
              onClick={() => onAddToQueue(track.uri)}
              className="add-queue-btn"
            >
              Add to Queue
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchResults;