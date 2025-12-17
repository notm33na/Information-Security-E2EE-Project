# Secure E2EE Messaging & File-Sharing System

A complete end-to-end encrypted messaging and file-sharing system with forward secrecy, MITM protection, and comprehensive security features.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (optional, for full functionality)
- **mkcert** (for trusted local certificates - see Certificate Setup below)

## Installation

### 1. Install Dependencies

Install dependencies for all packages:

```bash
npm run install:all
```

Or install manually:

```bash
# Root dependencies
npm install

# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### 2. Environment Setup

**Copy the example environment file and configure it:**

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` and fill in your actual values. The most important variables are:

- `MONGO_URI` - MongoDB connection string (required for full functionality)
- `LOG_HMAC_KEY` - Generate with: `openssl rand -hex 32` (required in production)

**Important:** Never commit your `.env` file to version control. It contains sensitive information.

See `.env.example` for all available configuration options and their descriptions.

**For Shared Backend Server (Multiple Users on Different Machines):**

If you want multiple users to connect to the same backend server from different machines:

1. **On the machine running the backend server:**

   - Find the machine's IP address (e.g., `192.168.1.100`)
   - Make sure the backend server is accessible on the network

2. **On each client machine:**
   - Create a `.env` file in the `client/` directory
   - Add: `VITE_BACKEND_URL=https://192.168.1.100:8443` (replace with your backend server IP)
   - If not set, defaults to `localhost:8443` (for single-machine development)

**Example `client/.env`:**

```env
VITE_BACKEND_URL=https://192.168.1.100:8443
```

## Certificate Setup (mkcert)

To eliminate browser security warnings, install `mkcert` for trusted local certificates.

### Windows (Chocolatey - Recommended)

1. Install Chocolatey (if not already installed):

   ```powershell
   # Run PowerShell as Administrator
   Set-ExecutionPolicy Bypass -Scope Process -Force
   [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
   iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. Install mkcert:

   ```powershell
   choco install mkcert
   ```

3. Install the local CA:
   ```powershell
   mkcert -install
   ```

### Windows (Scoop)

1. Install Scoop:

   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```

2. Install mkcert:

   ```powershell
   scoop install mkcert
   ```

3. Install the local CA:
   ```powershell
   mkcert -install
   ```

### Manual Installation

1. Download mkcert from: https://github.com/FiloSottile/mkcert/releases
2. Download `mkcert-v*-windows-amd64.exe` for Windows
3. Rename it to `mkcert.exe` and add it to your PATH
4. Run `mkcert -install` in PowerShell as Administrator

**Note:** The `vite-plugin-mkcert` plugin will automatically generate trusted certificates that include your local IP address.

## Starting the Application

### 1. Start the Backend Server

**Important:** The backend server must be running before the frontend can connect to it.

```bash
# Navigate to server directory
cd server

# Start the server
npm run dev
```

The backend server will start on:

- **HTTP**: `http://localhost:8080` (redirects to HTTPS)
- **HTTPS**: `https://localhost:8443` (main API server)
- **WebSocket**: `wss://localhost:8443` (Socket.IO)

You should see:

```
✓ HTTP server running on port 8080 (redirects to HTTPS)
✓ HTTPS server running on port 8443
✓ API available at: https://localhost:8443/api
✓ WebSocket available at: https://localhost:8443
```

### 2. Start the Frontend Development Server

In a **separate terminal**:

```bash
# Navigate to client directory
cd client

# Start the development server
npm run dev
```

The frontend will start on:

- **Frontend**: `https://localhost:5173` (or `http://localhost:5173`)

The Vite dev server will proxy API requests from `/api` to `https://localhost:8443/api`.

## Development Workflow

### Single Machine Setup

1. **Always start backend first**: `cd server && npm run dev`
2. **Then start frontend**: `cd client && npm run dev`
3. **Access the app**: `https://localhost:5173` or `http://localhost:5173`

### Shared Backend Setup (Multiple Users)

For multiple users on different machines to connect to the same backend:

1. **On the backend server machine:**

   - Start the backend: `cd server && npm run dev`
   - Note the machine's IP address (e.g., `192.168.1.100`)
   - Ensure firewall allows connections on port 8443

2. **On each client machine:**
   - Create `client/.env` file with: `VITE_BACKEND_URL=https://192.168.1.100:8443`
   - Start the frontend: `cd client && npm run dev`
   - Access the app via the machine's IP: `https://192.168.1.100:5173` (or the machine's own IP)

**Important Notes:**

- Both users must be able to reach the backend server (same network or VPN)
- The backend server must be accessible on port 8443 from client machines
- Each user can run their own frontend, but they all connect to the same backend
- WebSocket connections will automatically route through the Vite proxy to the shared backend

## Production Build

### Backend

```bash
cd server
npm start
```

### Frontend

```bash
cd client
npm run build
npm run preview
```

## Troubleshooting

### Connection Refused Errors

If you see errors like:

- `ERR_CONNECTION_REFUSED`
- `Network Error: Network Error`
- `Failed to load resource: net::ERR_CONNECTION_REFUSED`

**Solution**: Make sure the backend server is running first!

1. Check if backend is running:

   ```bash
   # In server directory
   npm run dev
   ```

2. Verify backend is accessible:
   - Open `https://localhost:8443/api/health` in your browser
   - You may need to accept the self-signed certificate warning

### Certificate Security Warnings

If you see certificate warnings:

1. **Verify mkcert CA is installed:**

   ```powershell
   mkcert -CAROOT
   ```

   This should show a path. If it doesn't, run `mkcert -install` again.

2. **Clear Vite cache and restart:**

   ```powershell
   cd client
   Remove-Item -Recurse -Force .vite
   Remove-Item -Recurse -Force node_modules\.vite
   npm run dev
   ```

3. **Clear browser cache:**
   - Chrome/Edge: `chrome://settings/clearBrowserData`
   - Firefox: `about:preferences#privacy`

### Vite HMR WebSocket Errors

If you see:

- `WebSocket connection to 'ws://localhost:5173/?token=...' failed`
- `[vite] failed to connect to websocket`

**Solution**: This is usually harmless - it's just Hot Module Replacement (HMR) for live reloading. The app will still work, but you won't get automatic page refreshes on code changes.

To fix:

1. Make sure port 5173 is not blocked by firewall
2. Try restarting the Vite dev server
3. Check if another process is using port 5173

### Port Already in Use

If you get "port already in use" errors:

- **Backend (8443)**: Kill the process using that port or change `PORT_HTTPS` in `.env`
- **Frontend (5173)**: Kill the process or change port in `vite.config.js`

### MongoDB Connection Issues

If MongoDB is not running:

- The server will still start but show a warning
- Some features requiring database will not work
- To use full functionality, start MongoDB: `mongod`

### CORS Errors

CORS is configured on the backend. If you see CORS errors:

- Make sure you're accessing the frontend through `http://localhost:5173` or `https://localhost:5173`
- Don't access the backend directly from the browser (use the proxy)

## Project Structure

```
/
├── client/          → Vite React frontend
├── server/          → Node.js + Express backend
├── scripts/         → Attack simulation scripts (educational)
├── keys/            → ECC keys and HTTPS certificates (gitignored)
├── docs/            → Documentation
├── .env.example     → Example environment variables (copy to .env)
└── .env             → Your environment variables (gitignored, create from .env.example)
```

## Tech Stack

- **Frontend**: React (Vite), TailwindCSS
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Real-time**: WebSockets (Socket.IO)
- **Security**: HTTPS-first, ECC (Elliptic Curve) keypair, JWT
- **Architecture**: Monorepo

## Key Features

- End-to-end encryption (AES-256-GCM)
- Forward secrecy via key rotation
- MITM protection via digital signatures
- Replay attack prevention
- Encrypted file sharing (chunked)
- Comprehensive logging and audit trails
- Attack simulation and demonstration tools

## Available Scripts

### Root Level

- `npm run install:all` - Install all dependencies
- `npm run dev:server` - Start backend server
- `npm run dev:client` - Start frontend server
- `npm run build` - Build frontend for production
- `npm start` - Start production server
- `npm run mitm-attack` - Run MITM attack simulation (requires MITM_ATTACK_MODE=true)
- `npm run replay-attack` - Run replay attack simulation (requires REPLAY_ATTACK_MODE=true)

### Client

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:attacks` - Run attack simulation tests

### Server

- `npm run dev` - Start development server with watch mode
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run generate-keys` - Generate ECC keypair for JWT signing

## Attack Simulations (Educational Purpose Only)

This project includes attack simulation tools for educational demonstration:

### MITM Attack Simulation

1. Set `MITM_ATTACK_MODE=true` in `.env`
2. Start the server
3. Run: `npm run mitm-attack` or `node scripts/run-mitm-attack-simulation.js`

### Replay Attack Simulation

1. Set `REPLAY_ATTACK_MODE=true` in `.env`
2. Start the server
3. Run: `npm run replay-attack` or `node scripts/run-replay-attack-simulation.js`

**Note:** Attack simulations are disabled by default and require explicit activation via environment variables. They are for educational purposes only and demonstrate security protections.
