import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";

let testWindow: BrowserWindow | null = null;

const createWindow = () => {
  testWindow = new BrowserWindow({
    width: 900,
    height: 760,
    autoHideMenuBar: false,
    title: "Audio Route Test",
    webPreferences: {
      preload: path.join(__dirname, "../preload/manual-audio-route-test-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void testWindow.loadFile(
    path.join(__dirname, "../renderer/manual-audio-route-test.html"),
  );

  testWindow.on("closed", () => {
    testWindow = null;
  });
};

ipcMain.handle("manual-audio-route-test:pick-audio-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select audio file",
    properties: ["openFile"],
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "wav", "aif", "aiff", "m4a", "aac", "flac", "ogg"],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
