# Office Jukebox

This project contains a React frontend and an Express server for an office jukebox.

## Server

The Express app lives in `server/index.js` and is protected with Windows authentication via [`passport-windowsauth`](https://www.npmjs.com/package/passport-windowsauth). The middleware authenticates users against Active Directory and the authenticated Windows profile is available on `req.user` for all API requests.

### Spotify credentials

The server interacts with the Spotify Web API using a shared office account. Configure the following environment variables before starting the server:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN` – a long-lived refresh token for the office Spotify account

These values are used to generate an access token, which is automatically refreshed when it expires.

---

# Getting Started with Create React App

Express server with React frontend.

## Development

1. Install dependencies: `npm install`.
2. Create a `.env` file with the backend URL:

   ```bash
   REACT_APP_API_URL=http://localhost:5000
   ```

3. Start both servers: `npm run dev`.
   - React runs on [http://localhost:3000](http://localhost:3000).
   - Express listens on [http://localhost:5000](http://localhost:5000).
   - If you need a different backend port, update both the port in the `dev` script and your `REACT_APP_API_URL` so they stay in sync.

## Production

1. Set `REACT_APP_API_URL` to the production backend before building, for example:

   ```bash
   REACT_APP_API_URL=https://api.example.com npm run build
   ```

2. Start the server: `npm start` (serves static files from `build/`).
3. A `Procfile` is provided for platforms like Heroku and runs `npm run build && node server/index.js`.

## Environment Variables

Create a `.env` file or set variables in your host:

```bash
PORT=5000
NODE_ENV=production
# REACT_APP_API_URL=http://localhost:5000
# CLIENT_ID=your-client-id
# CLIENT_SECRET=your-secret
```

- `REACT_APP_REDIRECT_URI` – OAuth callback URL for the React app.

## Reverse Proxy with Windows Authentication

When deploying behind IIS, Nginx, or another reverse proxy, enable Windows Authentication on the proxy and forward requests to the Node server:

- **IIS**: Use Application Request Routing to proxy `/*` to `http://localhost:5000`. Enable Windows Authentication and keep Anonymous Authentication disabled for protected routes.
- **Nginx**: Enable a module such as `auth_gss` or Kerberos, then configure `proxy_pass http://localhost:5000;` for both `/` and `/api` routes.

The Express server will still serve the React `build` directory, while authentication is handled by the proxy.

## Deployment Steps

1. Configure environment variables.
2. `npm run build`.
3. Run `npm start` or deploy using the provided `Procfile`.
