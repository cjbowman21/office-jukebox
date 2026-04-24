import React, { useCallback, useRef, useState } from 'react';
import AutoCompleteSearch from './AutoCompleteSearch';
import DeviceSelector from './DeviceSelector';
import QueueViewer from './QueueViewer';
import { addToQueue } from '../utils/spotifyAPI';

const friendlyError = (error) => {
  if (error.code === 'MISSING_DEVICE') {
    return 'Select the office Spotify device before adding songs.';
  }
  if (error.code === 'DEVICE_UNAVAILABLE') {
    return 'That Spotify device is not available right now.';
  }
  if (error.code === 'UNAUTHORIZED') {
    return 'Windows session expired. Reopen the site to authenticate again.';
  }
  return error.message || 'Something went wrong.';
};

const MainView = () => {
  const [notification, setNotification] = useState(null);
  const [refreshToken, setRefreshToken] = useState(Date.now());
  const notificationTimeout = useRef(null);

  const showNotification = useCallback((message, tone = 'success') => {
    setNotification({ message, tone });
    window.clearTimeout(notificationTimeout.current);
    notificationTimeout.current = window.setTimeout(() => setNotification(null), 3500);
  }, []);

  const handlePanelError = useCallback((error) => {
    showNotification(friendlyError(error), 'error');
  }, [showNotification]);

  const handleAddToQueue = async (trackUri) => {
    try {
      await addToQueue(trackUri);
      showNotification('Song added to the office queue.');
      setRefreshToken(Date.now());
      return true;
    } catch (error) {
      showNotification(friendlyError(error), 'error');
      return false;
    }
  };

  const handleDeviceChange = (device) => {
    showNotification(`Spotify device set to ${device.name}.`);
    setRefreshToken(Date.now());
  };

  return (
    <div className="workspace">
      {notification && (
        <div className={`notification ${notification.tone}`} role="status">
          {notification.message}
        </div>
      )}

      <section className="toolbar" aria-label="Office jukebox controls">
        <DeviceSelector onDeviceChange={handleDeviceChange} onError={handlePanelError} />
        <AutoCompleteSearch onAddToQueue={handleAddToQueue} onError={handlePanelError} />
      </section>

      <QueueViewer refreshToken={refreshToken} />
    </div>
  );
};

export default MainView;
