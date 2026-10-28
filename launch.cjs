const { spawn } = require('node:child_process');
const electron = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const args = process.argv.slice(2);
// Electron is the interactive GUI. SW_HIDE here can hide its native window
// even when BrowserWindow requests show:true, leaving a white ghost window.
const child = spawn(electron, args.length ? args : ['.'], { cwd: __dirname, env, stdio: 'inherit', windowsHide: false });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
