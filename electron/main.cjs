const { app, BrowserWindow } = require('electron');
const path = require('node:path');

// Enable WebGPU support with necessary flags
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

// Platform-specific flags
if (process.platform === 'linux') {
    // Vulkan backend for Linux/Steam Deck
    app.commandLine.appendSwitch('enable-features', 'Vulkan');
    app.commandLine.appendSwitch('use-angle', 'vulkan');
    app.commandLine.appendSwitch('enable-zero-copy');
} else if (process.platform === 'darwin') {
    // Metal backend for macOS (default, no special flags needed)
    app.commandLine.appendSwitch('use-angle', 'metal');
}

// For Steam Deck Game Mode compatibility
if (process.env.WEBKIT_DISABLE_COMPOSITING_MODE) {
    // Steam Deck Game Mode environment detected
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        // Steam Deck native resolution is 1280x800
        minWidth: 640,
        minHeight: 480,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webgl: true,
            // Enable WebGPU
            experimentalFeatures: true,
            // Allow file:// protocol to load local resources
            webSecurity: false,
        },
        backgroundColor: '#000000',
        title: 'Blit-Tech',
        // Start in fullscreen on Steam Deck if requested
        fullscreen: process.env.BLIT_FULLSCREEN === '1',
        // Show dev tools in development
        autoHideMenuBar: !process.env.BLIT_DEV,
    });

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
        // Development mode - connect to Vite dev server
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        if (process.env.BLIT_DEV) {
            mainWindow.webContents.openDevTools();
        }
    } else {
        // Production mode - load built files (examples gallery)
        mainWindow.loadFile(path.join(__dirname, '../dist/examples/index.html'));
    }

    // Log WebGPU availability
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents
            .executeJavaScript('navigator.gpu ? "WebGPU Available" : "WebGPU NOT Available"')
            .then((result) => {
                if (result === 'WebGPU NOT Available') {
                    console.error('ERROR: WebGPU is not available in this Electron instance!');
                    console.error('This might be due to:');
                    console.error('  1. GPU blocklist (try --ignore-gpu-blocklist)');
                    console.error('  2. Missing Vulkan drivers');
                    console.error('  3. Incompatible GPU');
                }
            })
            .catch((err) => console.error('Failed to check WebGPU:', err));
    });

    // Gracefully handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Allow internal navigation, block external URLs
    mainWindow.webContents.on('will-navigate', (event, url) => {
        // Allow file:// URLs (internal app navigation)
        if (url.startsWith('file://')) {
            return;
        }
        // Allow dev server in development
        if (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) {
            return;
        }
        // Block external navigation
        event.preventDefault();
    });

    // Block new windows from opening external URLs
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Allow file:// and dev server URLs
        if (url.startsWith('file://')) {
            return { action: 'allow' };
        }
        if (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) {
            return { action: 'allow' };
        }
        // Open external links in system browser
        const { shell } = require('electron');
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// App lifecycle
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle crashes
app.on('gpu-process-crashed', (_event, killed) => {
    console.error('GPU process crashed!', { killed });
    if (mainWindow) {
        mainWindow.webContents.send('gpu-crashed');
    }
});

app.on('render-process-gone', (_event, _webContents, details) => {
    console.error('Render process gone!', details);
});
