# Inter UG Kabaddi Championship

Mobile-first tournament management and live-scoring platform. The project is being built in the phases defined in the product brief.

## Implemented foundation

- React + Vite client with React Router, Axios, Bootstrap 5, Bootstrap Icons, and Socket.IO Client dependencies
- Express API with CORS, environment validation, Mongoose connection handling, and Socket.IO dependency
- Health endpoint at `GET /api/health`
- Mobile-first application shell and frontend-to-backend status check
- Tournament, Team, Player, Match, MatchLineup, MatchEvent, and Admin schemas
- Model validation and database indexes for common lookups and uniqueness constraints
- JWT authentication through secure HTTP-only cookies, bcrypt password services, and role authorization
- Mobile-first admin login and protected administration shell
- Tournament configuration, team management, player management, and squad leadership tools
- Fixture creation, pre-match editing, validation, filtering, and responsive match cards
- Configurable starting-player, substitute, captain, and first-raiding-team lineup selection
- Server-authoritative core scoring for empty raids, touches, bonuses, tackles, player out, and FIFO revival
- Advanced configurable super tackles, super-raid tracking, all-out resets, technical points, and do-or-die raids
- Immutable match-event recording with action identifiers and pre-action state snapshots
- Mobile-first live scoring console with sticky score context, large player/action targets, scoring previews, and guarded confirmations
- Transactional undo for the latest scoring action, reasoned score corrections, and a super-admin audit history with before/after scores
- Persisted timer controls, halftime locking, match completion with winner calculation, and super-admin reopen support
- Room-scoped Socket.IO match broadcasts with automatic admin rejoin, authoritative reconnect refreshes, and synchronized timer state
- Public mobile live-match centre with realtime score, timer, current raider, player status, recent events, fixtures, results, and responsive standings
- Public team and player profiles with compact raid/defence stat grids and tournament leaderboards for points, raiding, defending, bonus, successful raids, and super tackles
- Realtime connection monitoring with automatic room rejoin and authoritative refresh after reconnect; scoring actions lock while an admin is disconnected

The complete tournament workflow is implemented, including public live viewing, standings, statistics, network safety, and development seeding.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- MongoDB 7+ replica set locally, or a MongoDB Atlas connection string. Scoring writes use transactions so match state, events, and player statistics commit atomically.

## Local setup

1. Install all dependencies:

   ```bash
   npm install
   npm run install:all
   ```

2. Create environment files:

   ```bash
   copy server\.env.example server\.env
   copy client\.env.example client\.env
   ```

3. Set `MONGO_URI` in `server/.env`. For scoring actions, the MongoDB deployment must support transactions (a local replica set or MongoDB Atlas).

4. Set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_ROLE`, then create the first administrator:

   ```bash
   npm run admin:create --prefix server
   ```

5. Seed the local development tournament after MongoDB is configured:

   ```bash
   npm run seed:dev --prefix server
   ```

6. Start both applications:

   ```bash
   npm run dev
   ```

7. Open `http://localhost:5173`. The API runs at `http://localhost:5000`; admin sign-in is at `/admin/login`.

## MongoDB Atlas

Create a database deployment in MongoDB Atlas, allow access from the machine running the server, create a database user, and paste the connection string into `server/.env` as `MONGO_URI`. Do not commit `.env` files.

## Validation commands

```bash
npm test
npm run build
```

The health response reports `connected`, `connecting`, `disconnected`, or `unconfigured` for the database. In development, the API remains available when MongoDB is unavailable so configuration problems are visible on the frontend; production startup fails when the database connection cannot be established.

## Folder structure

```text
client/   React/Vite frontend
server/   Express/Mongoose backend
```

### Current server model structure

```text
server/src/models/
  Admin.js
  Match.js
  MatchEvent.js
  MatchLineup.js
  Player.js
  Team.js
  Tournament.js
  shared/
```

Detailed architecture, scoring, deployment, and troubleshooting documentation will be expanded in their relevant phases.

## Production deployment

Do not deploy until you have a MongoDB replica set or MongoDB Atlas deployment: match scoring uses transactions and will not work on a standalone MongoDB server.

1. Deploy the API from `server/` using Node.js 20 or the included [production Dockerfile](server/Dockerfile.production). The root [Procfile](Procfile) supports process-based platforms.
2. Deploy the Vite client as a static site. Set `VITE_API_URL` to `https://api.example.edu/api` and `VITE_SOCKET_URL` to `https://api.example.edu` at build time.
3. Set the API environment variables below. `CLIENT_URL` must be the exact HTTPS frontend origin. For multiple approved origins, provide a comma-separated list.
4. Run `npm ci`, `npm test`, and `npm run build` during CI before releasing.
5. Configure the platform health check to call `GET /api/health` and require a `connected` database status before accepting tournament scoring traffic.

Required production API variables:

```text
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=a-random-secret-of-at-least-32-characters
JWT_EXPIRES_IN=12h
CLIENT_URL=https://app.example.edu
```

Optional first-admin bootstrap variables are `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_ROLE`. Run `npm run admin:create --prefix server` once from a trusted deployment shell; do not expose these values in frontend environment variables.

## Troubleshooting

- `MONGO_URI is required in production`: provide an Atlas or replica-set connection string.
- Browser requests are blocked by CORS: make the deployed frontend URL match one entry in `CLIENT_URL`, including `https://` and no trailing path.
- Login does not persist: production cookies require HTTPS and a matching `CLIENT_URL` origin.
- Scoring fails with transaction errors: use MongoDB Atlas or a replica set, not a standalone local MongoDB instance.
