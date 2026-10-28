const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('assistant', {
  settings: input => ipcRenderer.invoke('settings', input),
  ask: input => ipcRenderer.invoke('ask', input),
  checkConnection: () => ipcRenderer.invoke('check-connection'),
  cancel: () => ipcRenderer.invoke('cancel'),
  pin: value => ipcRenderer.invoke('pin', value),
  onStage: callback => ipcRenderer.on('stage', (_, value) => callback(value)),
  onTranscript: callback => ipcRenderer.on('transcript', (_, value) => callback(value)),
  onShortcut: callback => ipcRenderer.on('ask-shortcut', () => callback()),
  onShortcutStatus: callback => ipcRenderer.on('shortcut-status', (_, value) => callback(value))
});
