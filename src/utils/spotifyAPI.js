import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL;
if (!baseURL) {
  console.warn('REACT_APP_API_URL is not set; falling back to current origin.');
}

const api = axios.create({
  baseURL: baseURL || window.location.origin,
  withCredentials: true,
});

const unauthorized = { unauthorized: true };
const networkError = { networkError: true };

const handleUnauthorized = (error) => {
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    return unauthorized;
  }
  throw error;
};

export const getQueue = async () => {
  try {
    const response = await api.get('/api/queue');
    return response.data;
  } catch (error) {
    if (!error.response) {
      console.error('Network error fetching queue:', error, error.response?.data);
      return networkError;
    }
    try {
      return handleUnauthorized(error);
    } catch (err) {
      console.error('Error fetching queue:', err, err.response?.data);
      return null;
    }
  }
};

export const searchTracks = async (query) => {
  try {
    const response = await api.get('/api/search', { params: { q: query } });
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
    await api.post('/api/add-to-queue', { uri: trackUri });
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

