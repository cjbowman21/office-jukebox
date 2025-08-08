import axios from 'axios';

const unauthorized = { unauthorized: true };

const handleUnauthorized = (error) => {
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    return unauthorized;
  }
  throw error;
};

export const getQueue = async () => {
  try {
    const response = await axios.get('/api/queue');
    return response.data;
  } catch (error) {
    try {
      return handleUnauthorized(error);
    } catch (err) {
      console.error('Error fetching queue:', err);
      return null;
    }
  }
};

export const searchTracks = async (query) => {
  try {
    const response = await axios.get('/api/search', { params: { q: query } });
    return response.data.tracks || response.data;
  } catch (error) {
    const result = handleUnauthorized(error);
    if (result.unauthorized) {
      return result;
    }
    console.error('Error searching tracks:', error);
    return [];
  }
};

export const addToQueue = async (trackUri) => {
  try {
    await axios.post('/api/queue', { uri: trackUri });
    return true;
  } catch (error) {
    const result = handleUnauthorized(error);
    if (result.unauthorized) {
      return result;
    }
    console.error('Error adding to queue:', error);
    return false;
  }
};

