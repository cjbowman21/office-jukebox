import React, { useEffect, useState } from 'react';
import { getDevices, getSelectedDevice, saveSelectedDevice } from '../utils/spotifyAPI';

const deviceLabel = (device) => {
  const state = device.is_active ? 'active' : 'available';
  return `${device.name} (${device.type}, ${state})`;
};

const DeviceSelector = ({ onDeviceChange, onError }) => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDevices = async () => {
    setLoading(true);
    setError('');
    try {
      const [availableDevices, savedDeviceId] = await Promise.all([
        getDevices(),
        getSelectedDevice(),
      ]);
      setDevices(availableDevices);
      setSelectedDeviceId(savedDeviceId);
    } catch (err) {
      setError(err.message);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [availableDevices, savedDeviceId] = await Promise.all([
          getDevices(),
          getSelectedDevice(),
        ]);
        if (active) {
          setDevices(availableDevices);
          setSelectedDeviceId(savedDeviceId);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          onError?.(err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [onError]);

  const handleChange = async (event) => {
    const deviceId = event.target.value;
    const previousDeviceId = selectedDeviceId;
    const selectedDevice = devices.find((device) => device.id === deviceId);

    setSelectedDeviceId(deviceId);
    setSaving(true);
    setError('');

    try {
      const result = await saveSelectedDevice(deviceId);
      onDeviceChange?.(result.device || selectedDevice);
    } catch (err) {
      setSelectedDeviceId(previousDeviceId);
      setError(err.message);
      onError?.(err);
    } finally {
      setSaving(false);
    }
  };

  const selectedDeviceMissing = selectedDeviceId && !devices.some((device) => device.id === selectedDeviceId);

  return (
    <div className="device-panel">
      <div className="field-header">
        <label htmlFor="device-select">Spotify Connect device</label>
        <button type="button" className="ghost-button" onClick={loadDevices} disabled={loading || saving}>
          Refresh
        </button>
      </div>

      <select
        id="device-select"
        value={selectedDeviceId}
        onChange={handleChange}
        disabled={loading || saving || devices.length === 0}
      >
        <option value="">{loading ? 'Loading devices...' : 'Select a device'}</option>
        {selectedDeviceMissing && <option value={selectedDeviceId}>Saved device is offline</option>}
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {deviceLabel(device)}
          </option>
        ))}
      </select>

      {devices.length === 0 && !loading && !error && (
        <p className="field-note">No Spotify Connect devices are online for the office account.</p>
      )}
      {saving && <p className="field-note">Saving device...</p>}
      {error && <p className="field-note error-text">{error}</p>}
    </div>
  );
};

export default DeviceSelector;
