// App lifecycle wiring for the Electron main process, kept free of Electron
// imports so it can be unit-tested with a fake `app` (an EventEmitter with
// requestSingleInstanceLock/quit).
//
// Rules (MR-6):
//  - One instance. Two launches would run two backends writing the same
//    hydro-data.json, last writer wins. The second launch quits at once and
//    the first window is brought to the front.
//  - The backend closes on before-quit, NOT on window-all-closed: on macOS the
//    app stays alive with no windows and `activate` reopens one, which needs
//    the backend still running.
//  - On every other platform window-all-closed quits the app (which then
//    fires before-quit and closes the backend).
export function wireLifecycle(app, { platform, createWindow, getWindow, closeServer }) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return { primary: false };
  }

  app.on('second-instance', () => {
    const win = getWindow();
    if (!win) { createWindow(); return; }
    if (typeof win.isMinimized === 'function' && win.isMinimized()) win.restore();
    win.focus();
  });

  app.on('window-all-closed', () => {
    if (platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!getWindow()) createWindow();
  });

  let closed = false;
  app.on('before-quit', () => {
    if (closed) return;
    closed = true;
    closeServer();
  });

  return { primary: true };
}
