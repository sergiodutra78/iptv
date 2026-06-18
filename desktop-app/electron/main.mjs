import electron from 'electron';
const { app, BrowserWindow, ipcMain, Menu } = electron;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

app.commandLine.appendSwitch('ignore-certificate-errors');

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
        frame: false,
        icon: path.join(__dirname, '../public/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            allowRunningInsecureContent: true
        },
        title: 'KinetiQ IPTV',
        show: false
    });

    Menu.setApplicationMenu(null);

    if (isDev) {
        mainWindow.loadURL('http://localhost:5174');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        mainWindow.webContents.openDevTools();
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
