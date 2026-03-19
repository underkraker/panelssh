const { spawnSync } = require('child_process');
const fs = require('fs');

const isRoot = process.getuid && process.getuid() === 0;

function ensurePrivileges() {
  if (isRoot) return;

  const check = spawnSync('sudo', ['-n', 'true'], {
    encoding: 'utf8',
    timeout: 5000
  });

  if (check.status !== 0) {
    const details = (check.stderr || check.stdout || '').trim();
    throw new Error(`Permisos insuficientes. Ejecute el panel como root o habilite sudo sin prompt. ${details}`.trim());
  }
}

function run(command, args = [], options = {}) {
  const { timeout = 10000, input, ignoreError = false } = options;
  ensurePrivileges();

  const finalCommand = isRoot ? command : 'sudo';
  const finalArgs = isRoot ? args : ['-n', command, ...args];

  const result = spawnSync(finalCommand, finalArgs, {
    encoding: 'utf8',
    timeout,
    input: input || undefined
  });

  if (result.status !== 0) {
    if (ignoreError) return '';
    const err = (result.stderr || result.stdout || 'unknown error').trim();
    throw new Error(err);
  }

  return result.stdout || '';
}

function readTextFile(filePath) {
  if (isRoot) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return run('cat', [filePath]);
}

function writeTextFile(filePath, content) {
  if (isRoot) {
    fs.writeFileSync(filePath, content);
    return;
  }
  run('tee', [filePath], { input: content });
}

function detectPrivilegeMode() {
  if (isRoot) {
    return { isRoot: true, canUseSudo: true, mode: 'root' };
  }

  const check = spawnSync('sudo', ['-n', 'true'], {
    encoding: 'utf8',
    timeout: 5000
  });

  return {
    isRoot: false,
    canUseSudo: check.status === 0,
    mode: check.status === 0 ? 'sudo' : 'none'
  };
}

module.exports = {
  isRoot,
  run,
  readTextFile,
  writeTextFile,
  detectPrivilegeMode
};
