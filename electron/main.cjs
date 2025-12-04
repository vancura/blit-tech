const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

// #region Configuration

// Enable WebGPU support with necessary flags.
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

// Platform-specific flags.
if (process.platform === 'linux') {
    // Enable Vulkan support for Linux.
    app.commandLine.appendSwitch('enable-features', 'Vulkan');
    app.commandLine.appendSwitch('use-angle', 'vulkan');
    app.commandLine.appendSwitch('enable-zero-copy');
} else if (process.platform === 'darwin') {
    // Enable Metal support for macOS.
    app.commandLine.appendSwitch('use-angle', 'metal');
}

// TODO: Steam Deck Game Mode compatibility (WEBKIT_DISABLE_COMPOSITING_MODE)
// When implemented:
// - Force fullscreen mode for better performance
// - Adjust input handling for Steam Deck controls
// - Set display scaling/resolution optimizations
// - Configure GPU performance profile for handheld mode
// - Handle suspend/resume events specific to Steam Deck

// #endregion

// #region Module State

let mainWindow;

// #endregion

// #region Helper Functions

/**
 * Checks if a URL is an internal URL that should be allowed within the app.
 * Internal URLs include file:// protocol and the Vite dev server in development.
 *
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the URL is internal and should be allowed.
 */
function isInternalUrl(url) {
    if (url.startsWith('file://')) {
        return true;
    }

    if (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) {
        return true;
    }

    return false;
}

/**
 * Sets Content Security Policy headers for all web requests.
 * Restricts resource loading to same-origin and allows necessary inline styles.
 *
 * @param {Electron.OnHeadersReceivedListenerDetails} details - Request details.
 * @param {Function} callback - Callback to modify response headers.
 */
function setContentSecurityPolicyHeaders(details, callback) {
    callback({
        responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
                [
                    "default-src 'self'",
                    "script-src 'self'",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: blob:",
                    "font-src 'self' data:",
                    "connect-src 'self' ws: wss:",
                    "worker-src 'self' blob:",
                ].join('; '),
            ],
        },
    });
}

// #endregion

// #region Navigation Handlers

/**
 * Prevents navigation to external URLs within the current window.
 * Called on the 'will-navigate' event. Allows internal URLs (file://, dev server)
 * and blocks all external navigation attempts.
 *
 * @param {Electron.Event} event - The navigation event.
 * @param {string} url - The URL being navigated to.
 */
function preventExternalNavigation(event, url) {
    if (isInternalUrl(url)) {
        return;
    }

    event.preventDefault();
}

/**
 * Handles requests to open new windows or tabs.
 * Called by setWindowOpenHandler. Allows internal URLs to open within the app.
 * External URLs are opened in the system's default browser instead.
 *
 * @param {{ url: string }} details - Window open request details containing the URL.
 * @returns {{ action: 'allow' | 'deny' }} Action to take - 'allow' for internal URLs, 'deny' for external.
 */
function handleNewWindowRequest({ url }) {
    if (isInternalUrl(url)) {
        return { action: 'allow' };
    }

    shell.openExternal(url);

    return { action: 'deny' };
}

// #endregion

// #region Window Lifecycle

/**
 * Handles the main window closed event.
 * Cleans up the window reference when the window is closed.
 */
function onMainWindowClosed() {
    mainWindow = null;
}

/**
 * Creates and configures the main application window.
 *
 * Sets up window dimensions optimized for Steam Deck, configures security settings,
 * applies Content Security Policy, and loads the appropriate content based on environment.
 * Registers event handlers for navigation, window lifecycle, and crash events.
 *
 * @returns {BrowserWindow} The created main application window instance.
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 640,
        minHeight: 480,

        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webgl: true,
            experimentalFeatures: true,
            webSecurity: true,
        },

        backgroundColor: 'black',
        title: 'Blit–Tech',
        fullscreen: process.env.BLIT_FULLSCREEN === '1',
        autoHideMenuBar: !process.env.BLIT_DEV,
    });

    // Apply Content Security Policy to all web requests.
    mainWindow.webContents.session.webRequest.onHeadersReceived(setContentSecurityPolicyHeaders);

    // Load content based on environment.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);

        if (process.env.BLIT_DEV) {
            mainWindow.webContents.openDevTools();
        }
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/examples/index.html'));
    }

    // Register window lifecycle and navigation event handlers.
    mainWindow.on('closed', onMainWindowClosed);
    mainWindow.webContents.on('will-navigate', preventExternalNavigation);
    mainWindow.webContents.setWindowOpenHandler(handleNewWindowRequest);
}

// #endregion

// #region App Lifecycle

/**
 * Initializes the application when Electron is ready.
 * Creates the main window and sets up macOS-specific window activation handling.
 */
app.whenReady().then(() => {
    createWindow();

    // On macOS, recreate window when dock icon is clicked and no windows exist.
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

/**
 * Handles the window-all-closed event.
 * Quits the application on all platforms except macOS, where apps typically
 * continue running even when all windows are closed.
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * Handles GPU process crashes.
 * Logs the crash and notifies the renderer process via IPC.
 *
 * @param {Electron.Event} _event - The crash event.
 * @param {boolean} killed - Whether the process was killed.
 */
app.on('gpu-process-crashed', (_event, killed) => {
    console.error('GPU process crashed!', { killed });

    if (mainWindow) {
        mainWindow.webContents.send('gpu-crashed');
    }
});

/**
 * Handles renderer process crashes or termination.
 * Logs crash details for debugging purposes.
 *
 * @param {Electron.Event} _event - The crash event.
 * @param {Electron.WebContents} _webContents - The affected web contents.
 * @param {Electron.RenderProcessGoneDetails} details - Crash details.
 */
app.on('render-process-gone', (_event, _webContents, details) => {
    console.error('Render process gone!', details);
});

// #endregion
