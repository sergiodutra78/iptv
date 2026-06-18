const fs = require("fs"); const path = require("path");
function log(msg) { try { fs.appendFileSync("C:/tmp/kiq.log", new Date().toISOString() + " " + msg + "\n"); } catch (e) {} }
log("START: process.type=" + process.type + " electron=" + (process.versions && process.versions.electron));
let e; try { e = require("electron"); log("electron type=" + typeof e + (typeof e==="string"?" val="+e.substring(0,60):"")); } catch(ex) { log("CATCH: "+ex.message); }
const {app,BrowserWindow,ipcMain,Menu} = e||{};
if (!app) { log("FATAL: no app"); process.exit(1); }
log("app ok");
const isDev = process.env.NODE_ENV === "development";
app.commandLine.appendSwitch("ignore-certificate-errors");
ipcMain.on("window-minimize",(ev)=>{const w=BrowserWindow.fromWebContents(ev.sender);if(w)w.minimize();});
ipcMain.on("window-maximize",(ev)=>{const w=BrowserWindow.fromWebContents(ev.sender);if(w){if(w.isMaximized())w.unmaximize();else w.maximize();}});
ipcMain.on("window-close",(ev)=>{const w=BrowserWindow.fromWebContents(ev.sender);if(w)w.close();});
ipcMain.on("set-fullscreen",(ev,f)=>{const w=BrowserWindow.fromWebContents(ev.sender);if(w)w.setFullScreen(f);});
function createWindow(){log("createWin");const w=new BrowserWindow({width:1280,height:720,backgroundColor:"#000000",frame:false,icon:path.join(__dirname,"../public/icon.png"),webPreferences:{preload:path.join(__dirname,"preload.cjs"),nodeIntegration:false,contextIsolation:true,webSecurity:false,allowRunningInsecureContent:true},title:"KinetiQ IPTV",show:false});Menu.setApplicationMenu(null);if(isDev){w.loadURL("http://localhost:5174");}else{const p=path.join(__dirname,"../dist/index.html");log("loadFile: "+p);w.loadFile(p);w.webContents.openDevTools();}w.once("ready-to-show",()=>{log("ready-to-show");w.show();});w.on("closed",()=>log("win-closed"));}
app.whenReady().then(()=>{log("ready");createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on("window-all-closed",()=>{log("all-closed");if(process.platform!=="darwin")app.quit();});
