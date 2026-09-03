// MR-6: the lifecycle wiring, driven by a fake Electron `app`.

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { wireLifecycle } from '../lifecycle.js';

function fakeApp({ lock = true } = {}) {
  const app = new EventEmitter();
  app.requestSingleInstanceLock = vi.fn(() => lock);
  app.quit = vi.fn();
  return app;
}

function wire(app, over = {}) {
  const deps = {
    platform: 'win32',
    createWindow: vi.fn(),
    getWindow: vi.fn(() => null),
    closeServer: vi.fn(),
    ...over,
  };
  return { result: wireLifecycle(app, deps), deps };
}

describe('single instance', () => {
  it('a second launch quits immediately and wires nothing', () => {
    const app = fakeApp({ lock: false });
    const { result, deps } = wire(app);
    expect(result.primary).toBe(false);
    expect(app.quit).toHaveBeenCalledTimes(1);
    expect(app.listenerCount('before-quit')).toBe(0);
    app.emit('window-all-closed');
    expect(deps.closeServer).not.toHaveBeenCalled();
  });

  it('the first instance takes the lock and focuses its window when a second launch knocks', () => {
    const app = fakeApp();
    const win = { isMinimized: vi.fn(() => true), restore: vi.fn(), focus: vi.fn() };
    const { result } = wire(app, { getWindow: () => win });
    expect(result.primary).toBe(true);
    app.emit('second-instance');
    expect(win.restore).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
    expect(app.quit).not.toHaveBeenCalled();
  });

  it('a second launch with no open window recreates one', () => {
    const app = fakeApp();
    const { deps } = wire(app);
    app.emit('second-instance');
    expect(deps.createWindow).toHaveBeenCalledTimes(1);
  });
});

describe('quit lifecycle', () => {
  it('the backend closes on before-quit, once, and NOT on window-all-closed', () => {
    const app = fakeApp();
    const { deps } = wire(app, { platform: 'darwin' });
    app.emit('window-all-closed');
    expect(deps.closeServer).not.toHaveBeenCalled();
    app.emit('before-quit');
    app.emit('before-quit');
    expect(deps.closeServer).toHaveBeenCalledTimes(1);
  });

  it('window-all-closed quits everywhere except macOS', () => {
    const win = fakeApp();
    wire(win, { platform: 'win32' });
    win.emit('window-all-closed');
    expect(win.quit).toHaveBeenCalledTimes(1);

    const mac = fakeApp();
    wire(mac, { platform: 'darwin' });
    mac.emit('window-all-closed');
    expect(mac.quit).not.toHaveBeenCalled();
  });

  it('activate reopens a window only when none exists', () => {
    const app = fakeApp();
    let win = null;
    const { deps } = wire(app, { getWindow: () => win });
    app.emit('activate');
    expect(deps.createWindow).toHaveBeenCalledTimes(1);
    win = {};
    app.emit('activate');
    expect(deps.createWindow).toHaveBeenCalledTimes(1);
  });
});
