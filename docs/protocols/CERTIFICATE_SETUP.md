# Certificate Setup Guide

This guide explains how to set up trusted local certificates using mkcert to eliminate browser security warnings during development.

## Installation

### Option 1: Using Chocolatey (Recommended for Windows)

1. Install Chocolatey (if not already installed):

   - Open PowerShell as Administrator
   - Run:
     ```powershell
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

### Option 2: Using Scoop

1. Install Scoop (if not already installed):

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

### Option 3: Manual Installation

1. Download mkcert from: https://github.com/FiloSottile/mkcert/releases
2. Download `mkcert-v*-windows-amd64.exe` for Windows
3. Rename it to `mkcert.exe` and add it to your PATH
4. Run `mkcert -install` in PowerShell as Administrator

## Configuration

After installation, restart your Vite dev server:

```powershell
cd client
npm run dev
```

The `vite-plugin-mkcert` plugin will automatically generate trusted certificates that include:

- `localhost`
- `127.0.0.1`
- Your local IP address (e.g., `192.168.56.1`)

## Verification

After completing the setup, when you visit `https://localhost:5173`, you should see:

- A padlock icon in the address bar
- No security warnings
- "Connection is secure" message

## Troubleshooting

### Still Seeing Warnings?

1. **Verify CA is installed:**

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

   - **Chrome/Edge**: Go to `chrome://settings/clearBrowserData`
   - **Firefox**: Go to `about:preferences#privacy`

4. **Check certificate details:**

   - Click the padlock icon in your browser
   - View certificate details
   - Verify it shows "Issued by: mkcert [your name]"

### Alternative: Manual Certificate Generation

If the plugin doesn't work, you can manually generate a certificate:

```powershell
cd client
mkcert localhost 127.0.0.1 192.168.56.1
```

This creates:

- `localhost+2.pem` (certificate)
- `localhost+2-key.pem` (private key)

Then update `vite.config.js` to use these files directly.
