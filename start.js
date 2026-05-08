const { spawn } = require('child_process');

function spawnProcess(script) {
  console.log(`[launcher] starting ${script}`);
  const proc = spawn('node', [script], { stdio: 'inherit' });

  proc.on('close', (code) => {
    console.error(`[launcher] ${script} exited with code ${code} — restarting in 3s`);
    setTimeout(() => spawnProcess(script), 3000);
  });
}

spawnProcess('api/index.js');
spawnProcess('bot/index.js');
