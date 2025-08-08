const express = require('express');
const path = require('path');

const app = express();

// Example API route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from server!' });
});

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'build');
  app.use(express.static(buildPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
