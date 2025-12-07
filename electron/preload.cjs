const { contextBridge, ipcRenderer } = require('electron');

// #region Helper Functions

/**
 * Validates that a value is a function.
 * Throws TypeError if validation fails.
 *
 * @param {unknown} value - The value to validate.
 * @param {string} paramName - Name of the parameter for error messages.
 * @throws {TypeError} If value is not a function.
 */
function validateFunction(value, paramName) {
    if (typeof value !== 'function') {
        throw new TypeError(`${paramName} must be a function`);
    }
}

// #endregion

// #region IPC Handlers

/**
 * Handles GPU crash events from the main process.
 * Safely wraps IPC listener with validation and cleanup.
 *
 * @param {Function} callback - Function to call when the GPU crash occurs.
 * @throws {TypeError} If callback is not a function.
 */
function handleGPUCrashed(callback) {
    validateFunction(callback, 'Callback');

    // Remove any previous listeners to prevent memory leaks.
    ipcRenderer.removeAllListeners('gpu-crashed');

    // Add the new listener with a wrapper for safety.
    ipcRenderer.on('gpu-crashed', () => {
        callback();
    });
}

// #endregion

// #region API Exposure

/**
 * Exposes a minimal, secure API to the renderer process.
 * Provides environment information and event handlers without exposing Node.js APIs.
 * All exposed functions are validated and safely wrapped.
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /** The current platform (e.g., 'darwin', 'linux', 'win32'). */
    platform: process.platform,

    /** Indicates that the app is running in Electron. */
    isElectron: true,

    /** Version information for Electron, Chrome and Node.js. */
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },

    /**
     * Registers a callback to be invoked when the GPU process crashes.
     * @param {Function} callback - Function to call on GPU crash.
     */
    onGPUCrashed: handleGPUCrashed,
});

// #endregion
