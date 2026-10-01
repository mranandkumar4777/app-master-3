'use strict';
// Presenter desktop app (Electron). Starts the built-in server (so the phone
// remote keeps working) and shows the Control window in a normal app window.
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');

// OBS Window Capture బ్లాక్ అవ్వకుండా, లైవ్ విండో క్రాష్ అవ్వకుండా ఉండటానికి
app.disableHardwareAcceleration();

const path = require('path');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const ORIGINS = ['http://localhost:' + PORT, 'http://127.0.0.1:' + PORT];
const isOurs = (url) => ORIGINS.some((o) => url === o || url.startsWith(o + '/'));

let mainWindow = null;
let bgMode = 'dark'; // Live window background setting, reported by the page

function waitForServer(tries, cb) {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 800 }, (res) => {
    res.resume();
    cb(true);
  });
  req.on('error', () => retry());
  req.on('timeout', () => { req.destroy(); retry(); });
  function retry() {
    if (tries <= 0) return cb(false);
    setTimeout(() => waitForServer(tries - 1, cb), 250);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon-512.png'),
    title: 'Presenter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false, // trusted local page only; lets preload replace window.prompt
      sandbox: true,
      backgroundThrottling: false
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(ORIGINS[0] + '/');
}

// Preview / Live windows opened by the page (window.open) become real app windows.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: false,
            sandbox: true,
            backgroundThrottling: false
          }
        }
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

app.whenReady().then(() => {
  waitForServer(20, (ok) => {
    if (!ok) {
      require('./server.js');
    }
    createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
