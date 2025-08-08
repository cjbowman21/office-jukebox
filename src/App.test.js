import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock axios to avoid importing the ESM module during tests
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status: 401 })
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

// Require App after mocks to prevent axios ESM parsing issues
const App = require('./App').default;

test('renders header and authentication prompt', async () => {
  render(<App />);
  expect(screen.getByText(/office jukebox/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/reauthenticate with windows/i)
  ).toBeInTheDocument();
});

