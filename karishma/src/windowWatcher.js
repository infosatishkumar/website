// Finds the frontmost app window on macOS so Karishma can sit on its top edge.
// Uses AppleScript via System Events, which needs Accessibility permission
// (System Settings > Privacy & Security > Accessibility > Karishma).
const { execFile } = require('child_process');

const SCRIPT = `
tell application "System Events"
  set p to first application process whose frontmost is true
  set n to name of p
  try
    set w to front window of p
    set {x, y} to position of w
    set {ww, hh} to size of w
    return n & "|" & x & "|" & y & "|" & ww & "|" & hh
  on error
    return n & "|none"
  end try
end tell`;

class WindowWatcher {
  constructor({ ownNames, onWindow, onPermissionError }) {
    this.ownNames = ownNames;
    this.onWindow = onWindow;
    this.onPermissionError = onPermissionError;
    this.timer = null;
    this.busy = false;
    this.last = null;
  }

  start() {
    if (process.platform !== 'darwin' || this.timer) return;
    this.timer = setInterval(() => this.poll(), 1200);
    this.poll();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.last = null;
    this.onWindow(null);
  }

  poll() {
    if (this.busy) return;
    this.busy = true;
    execFile('osascript', ['-e', SCRIPT], { timeout: 3000 }, (err, stdout, stderr) => {
      this.busy = false;
      if (err) {
        const msg = String(stderr || err.message);
        if (/not allowed|assistive|-1719|-25211|1002/i.test(msg)) {
          this.stop();
          this.onPermissionError();
        }
        return;
      }
      const parts = stdout.trim().split('|');
      const name = parts[0];
      // When Karishma herself is focused (e.g. chatting), keep the previous window.
      if (this.ownNames.includes(name)) return;
      if (parts[1] === 'none' || parts.length < 5) {
        this.emit(null);
        return;
      }
      const [x, y, width, height] = parts.slice(1).map(Number);
      if ([x, y, width, height].some((n) => Number.isNaN(n))) return;
      this.emit({ app: name, x, y, width, height });
    });
  }

  emit(win) {
    const key = JSON.stringify(win);
    if (key === this.last) return;
    this.last = key;
    this.onWindow(win);
  }
}

module.exports = { WindowWatcher };
