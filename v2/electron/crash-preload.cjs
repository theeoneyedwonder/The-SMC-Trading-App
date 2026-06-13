'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crashAPI', {
  getError: ()     => ipcRenderer.invoke('crash:get-data'),
  submit:   (desc) => ipcRenderer.invoke('crash:submit', desc),
  dismiss:  ()     => ipcRenderer.invoke('crash:dismiss'),
});
