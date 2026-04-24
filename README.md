# Office Jukebox

Office Jukebox is a LAN-hosted React and Express app for controlling a shared office Spotify queue. Coworkers authenticate with Windows/NTLM, search Spotify, add tracks to the queue, view now playing/up next, and select the Spotify Connect device used by the shared office account.

## Features

- Windows-authenticated access through `express-ntlm`.
- Shared Spotify account integration using a server-side refresh token.
- Track search with autocomplete and keyboard navigation.
- Add-only queue control for authenticated coworkers.
- Now playing and up-next queue display with automatic and manual refresh.
- Playback controls for play/pause, restart current track, skip current track, and device volume.
- Spotify Connect device picker for all authenticated users.
- Selected device persistence in `server/settings.local.json`.
- Vite frontend served by Express from `dist/` in production.

## Environment

Copy `.env.example` to `.env` and fill in the values for the office environment.

```bash
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

NTLM_DOMAIN=YOUR_DOMAIN
NTLM_DOMAIN_CONTROLLER=ldap://dc.yourdomain.local

SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REFRESH_TOKEN=your-refresh-token
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
```

`server/settings.local.json` is ignored by git and is created automatically when a device is selected.

## Spotify Setup

Create a Spotify developer app for the shared office account and add the redirect URI from `SPOTIFY_REDIRECT_URI`.

Run:

```bash
npm run spotify:auth
```

Open the printed URL while signed into the shared office Spotify account. After approval, the helper prints `SPOTIFY_REFRESH_TOKEN=...`; add that value to `.env`.

The helper requests these scopes:

- `user-read-playback-state`
- `user-read-currently-playing`
- `user-modify-playback-state`

Spotify playback control requires the shared account to have Premium.

## Development

Install dependencies:

```bash
npm install
```

Start the API and frontend:

```bash
npm run dev
```

- Express listens on `http://localhost:5000`.
- Vite listens on `http://localhost:5173`.
- For Windows auth testing, use a domain-joined Windows browser. The recommended dev setup is an ignored `.env.development.local` file with `VITE_API_URL=http://localhost:5000` so the browser authenticates directly with the API instead of through Vite's proxy.
- If integrated auth does not complete on `localhost`, try the machine hostname, for example `http://YOUR-PC-NAME:5000`, and make sure the address is trusted for Windows Integrated Authentication in Edge/Chrome.

## Production LAN Hosting

Build and start the single-server app:

```bash
npm run build
npm start
```

`npm start` serves `dist/` and the `/api` routes from the same port. Point coworkers at the office PC hostname or LAN IP, for example `http://office-jukebox:5000`.

## Verification

```bash
npm test
npm run build
```

Manual acceptance:

1. Open the LAN URL from a domain-joined Windows PC.
2. Confirm Windows authentication succeeds.
3. Select the office Spotify Connect device.
4. Use play/pause, restart, skip, and volume to confirm the selected device can be controlled.
5. Search for a track and add it.
6. Confirm it appears in the shared Spotify queue.
