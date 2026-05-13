const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
});
