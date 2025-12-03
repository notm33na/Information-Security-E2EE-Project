# Setup Instructions

## Prerequisites
- Node.js (v18 or higher)
- MongoDB (optional, for full functionality)
- npm or yarn

## Starting the Application

### 1. Start the Backend Server

The backend server must be running before the frontend can connect to it.

```bash
# Navigate to server directory
cd server

# Install dependencies (if not already done)
npm install

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

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The frontend will start on:
- **Frontend**: `http://localhost:5173`

The Vite dev server will proxy API requests from `/api` to `https://localhost:8443/api`.

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

### Vite HMR WebSocket Errors

If you see:
- `WebSocket connection to 'ws://localhost:5173/?token=...' failed`
- `[vite] failed to connect to websocket`

**Solution**: This is usually harmless - it's just Hot Module Replacement (HMR) for live reloading. The app will still work, but you won't get automatic page refreshes on code changes.

To fix:
1. Make sure port 5173 is not blocked by firewall
2. Try restarting the Vite dev server
3. Check if another process is using port 5173

### Self-Signed Certificate Warnings

The backend uses self-signed certificates for HTTPS. Your browser will show a security warning. This is normal for development.

**To accept the certificate:**
1. Click "Advanced" or "Show Details"
2. Click "Proceed to localhost" or "Accept the Risk"

## Environment Variables

### Backend (.env in project root)
```env
PORT_HTTP=8080
PORT_HTTPS=8443
MONGO_URI=mongodb://localhost:27017/infosec
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
```

### Frontend
No environment variables needed for development. The Vite proxy handles everything.

## Development Workflow

1. **Always start backend first**: `cd server && npm run dev`
2. **Then start frontend**: `cd client && npm run dev`
3. **Access the app**: `http://localhost:5173`

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

## Common Issues

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
- Make sure you're accessing the frontend through `http://localhost:5173`
- Don't access the backend directly from the browser (use the proxy)

