console.log("RESOLVED ELECTRON PATH:", require.resolve('electron'));
const electronObj = require('electron');
console.log("ELECTRON EXPORTS:", Object.keys(electronObj));
const { app, BrowserWindow, ipcMain, net, protocol, Menu } = electronObj;
protocol.registerSchemesAsPrivileged([
    { scheme: 'kinetiq', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } }
]);
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

app.commandLine.appendSwitch('ignore-certificate-errors');

// Handlers para Control de Ventana y Fullscreen
ipcMain.on('set-fullscreen', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(flag);
});

ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
});

ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
        frame: false, // Quitar bordes y barra de titulo default de Windows
        icon: path.join(__dirname, '../public/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Permite cargar contenido de diferentes orígenes
            allowRunningInsecureContent: true // Útil para logos en http dentro de una app que puede ser https
        },
        title: 'KinetiQ IPTV',
        show: false
    });

    // Quitar menu por defecto (File, Edit, etc.)
    Menu.setApplicationMenu(null);

    if (isDev) {
        mainWindow.loadURL('http://localhost:5174');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        // mainWindow.webContents.openDevTools(); // Abrir DevTools en prod temporalmente para debug
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
