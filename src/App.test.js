import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock axios to avoid importing the ESM module during tests
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Require App after mocks to prevent axios ESM parsing issues
const App = require('./App').default;

test('renders header and connect message', () => {
  render(<App />);
  expect(screen.getByText(/office jukebox/i)).toBeInTheDocument();
  expect(
    screen.getByText(/connect your spotify account to view the queue/i)
  ).toBeInTheDocument();
});

