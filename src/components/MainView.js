import React, { useState } from 'react';
import AutoCompleteSearch from './AutoCompleteSearch';
import QueueViewer from './QueueViewer';
import { addToQueue } from '../utils/spotifyAPI';

const MainView = () => {
  const [notification, setNotification] = useState(null);

  const handleAddToQueue = async (trackUri) => {
    const result = await addToQueue(trackUri);

    if (result === true) {
      setNotification('Song added to queue!');
      setTimeout(() => setNotification(null), 3000);
    } else if (result && result.unauthorized) {
      setNotification('Session expired. Please reauthenticate with Windows.');
    } else if (result && result.error) {
      setNotification(result.error);
    } else {
      setNotification('Failed to add song to queue. Please try again.');
    }
  };

  return (
    <div className="main-view">
      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}

      <div className="search-section">
        <AutoCompleteSearch onAddToQueue={handleAddToQueue} />
      </div>

      <div className="content-container">
        <QueueViewer />
      </div>
    </div>
  );
};

export default MainView;