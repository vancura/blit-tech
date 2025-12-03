const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal API to renderer process
// This provides information about the environment without exposing Node APIs
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true,

    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },

    // Listen for GPU crash events - safely wrapped
    onGPUCrashed: (callback) => {
        // Validate callback is a function
        if (typeof callback !== 'function') {
            throw new TypeError('Callback must be a function');
        }
        // Remove any previous listeners to prevent memory leaks
        ipcRenderer.removeAllListeners('gpu-crashed');
        // Add the new listener with a wrapper for safety
        ipcRenderer.on('gpu-crashed', (_event) => {
            callback();
        });
    },
});
