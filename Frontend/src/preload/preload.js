const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  openFileDialog: async () => {
    return await ipcRenderer.invoke('dialog:openFile')
  },
  openDirectoryDialog: async () => {
    return await ipcRenderer.invoke('dialog:openDirectory')
  },
  // 視窗控制
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
  }
})