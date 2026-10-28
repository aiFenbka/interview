const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
require('../main.cjs');
app.whenReady().then(() => {
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('render-process-gone', (_, details) => console.error('Renderer gone', details));
  win.webContents.on('did-fail-load', (_, code, description) => console.error('Load failed', code, description));
  win.webContents.on('console-message', event => console.log('Renderer', event.message));
  win.webContents.once('did-finish-load', async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      assert.equal(win.isVisible(), true, 'The native Windows window must be visible');
      if (process.platform === 'win32') assert.equal(win.isContentProtected(), true, 'Capture exclusion must be enabled');
      assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.documentElement).backgroundColor"), 'rgb(16, 21, 33)');
      await win.webContents.executeJavaScript("document.getElementById('pin').click()");
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(win.isAlwaysOnTop(), true, 'Rendered controls must handle clicks through IPC');
      await win.webContents.executeJavaScript("document.getElementById('settingsToggle').click()");
      const example = '**Когда использовать useMemo?**\n\n- **Механизм:** кеширует результат вычисления между рендерами.\n- **Компромисс:** *сначала измерьте производительность*, затем добавляйте оптимизацию.\n- **Пример:** скрипт `test` в файле `package.json`:\n\n```json\n{\n  "scripts": {\n    "test": "vitest",\n    "coverage": "vitest run --coverage"\n  }\n}\n```';
      await win.webContents.executeJavaScript(`window.renderAnswer(${JSON.stringify(example)})`);
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log(JSON.stringify({ visible: win.isVisible(), focused: win.isFocused(), bounds: win.getBounds(), gpu: app.getGPUFeatureStatus(), page: await win.webContents.executeJavaScript(`({title:document.title,background:getComputedStyle(document.body).backgroundColor,heading:document.querySelector('h1')?.textContent,ready:document.readyState})`) }));
      const shot = await win.webContents.capturePage();
      const output = path.join(app.getPath('temp'), 'react-assistant-visual.png');
      fs.writeFileSync(output, shot.toPNG());
      console.log(output);
      win.close();
      assert.equal(win.isDestroyed(), false, 'Close must preserve the tray session');
      assert.equal(win.isVisible(), false, 'Close must hide the window');
      app.emit('activate');
      assert.equal(win.isVisible(), true, 'The existing window must be recoverable');
      if (process.platform === 'win32') assert.equal(win.isContentProtected(), true, 'Capture exclusion must survive tray restore');
      win.minimize();
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(win.isVisible(), false, 'Minimize must hide to tray');
      app.emit('activate');
      assert.equal(win.isVisible(), true);
      console.log('PASS: close/minimize hide to tray, restore preserves window, normal quit.');
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  });
});
