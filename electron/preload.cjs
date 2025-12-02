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

    // Listen for GPU crash events
    onGPUCrashed: (callback) => {
        ipcRenderer.on('gpu-crashed', callback);
    },
});
