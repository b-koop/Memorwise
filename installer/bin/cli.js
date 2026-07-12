#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function readVersion() {
  const candidates = [
    path.join(__dirname, '..', 'package.json'),
    path.join(__dirname, '..', '..', 'package.json'),
  ];
  for (const file of candidates) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')).version; } catch {}
  }
  return '0.0.0';
}

const VERSION = readVersion();
const REPO = 'https://github.com/b-koop/the-stacks.git';
const APP_NAME = 'the-stacks';
const PORT = 4747;

// ─── Colors ──────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  bgBlue: '\x1b[44m',
};

function log(msg = '') { console.log(msg); }
function step(msg) { log(`\n  ${c.cyan}${c.bold}>${c.reset} ${msg}`); }
function success(msg) { log(`  ${c.green}${c.bold}✓${c.reset} ${msg}`); }
function warn(msg) { log(`  ${c.yellow}${c.bold}!${c.reset} ${c.dim}${msg}${c.reset}`); }
function fail(msg) { log(`  ${c.red}${c.bold}✗${c.reset} ${msg}`); }
function info(msg) { log(`    ${c.dim}${msg}${c.reset}`); }

const isWin = os.platform() === 'win32';

function supportsNodeVersion(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  return (major === 22 && minor >= 13) || major >= 24;
}

function checkCommand(cmd) {
  try { execSync(isWin ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; }
}

function runQuiet(cmd, cwd) {
  return execSync(cmd, { stdio: 'pipe', cwd, encoding: 'utf8' });
}

function openBrowser(url) {
  const p = os.platform();
  try {
    if (p === 'darwin') execSync(`open ${url}`, { stdio: 'ignore' });
    else if (p === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' });
    else if (p === 'linux') execSync(`xdg-open ${url}`, { stdio: 'ignore' });
  } catch {}
}

// ─── Banner ──────────────────────────────────
function banner() {
  log();
  log(`  ${c.cyan}${c.bold}  _____ _          _             ${c.reset}`);
  log(`  ${c.cyan}${c.bold} |_   _| |__  __ _| | _____  ___ ${c.reset}`);
  log(`  ${c.cyan}${c.bold}   | | | '_ \\/ _\` | |/ / __|/ __|${c.reset}`);
  log(`  ${c.cyan}${c.bold}   | | | | | (_| |   <\\__ \\\\__ \\\\${c.reset}`);
  log(`  ${c.cyan}${c.bold}   |_| |_| |_|\\__,_|_|\\_\\___/|___/${c.reset}`);
  log();
  log(`  ${c.dim}Your local research library${c.reset}                 ${c.dim}v${VERSION}${c.reset}`);
  log(`  ${c.dim}${'─'.repeat(49)}${c.reset}`);
}

// ─── Help ────────────────────────────────────
function showHelp() {
  banner();
  log();
  log(`  ${c.bold}Usage:${c.reset}  the-stacks ${c.dim}[directory] [options]${c.reset}`);
  log();
  log(`  ${c.bold}Commands:${c.reset}`);
  log(`    ${c.cyan}the-stacks${c.reset}              Install and start The Stacks`);
  log(`    ${c.cyan}the-stacks my-research${c.reset}  Install into a custom directory`);
  log(`    ${c.cyan}the-stacks --help${c.reset}       Show this help message`);
  log(`    ${c.cyan}the-stacks --version${c.reset}    Show version number`);
  log();
  log(`  ${c.bold}Options:${c.reset}`);
  log(`    ${c.green}-h, --help${c.reset}         Show this help message`);
  log(`    ${c.green}-v, --version${c.reset}      Show version number`);
  log(`    ${c.green}-p, --port${c.reset} ${c.dim}<port>${c.reset}  Set server port ${c.dim}(default: 4747)${c.reset}`);
  log(`    ${c.green}--no-open${c.reset}          Don't open browser automatically`);
  log(`    ${c.green}--no-update${c.reset}        Skip checking for updates`);
  log();
  log(`  ${c.bold}What it does:${c.reset}`);
  log(`    ${c.dim}1.${c.reset} Clones The Stacks repo (or detects existing install)`);
  log(`    ${c.dim}2.${c.reset} Checks for updates and pulls latest changes`);
  log(`    ${c.dim}3.${c.reset} Installs dependencies`);
  log(`    ${c.dim}4.${c.reset} Builds and starts the production server`);
  log(`    ${c.dim}5.${c.reset} Opens your browser to http://local.thestacks.com:4747`);
  log();
  log(`  ${c.bold}After install:${c.reset}`);
  log(`    ${c.dim}Run again with${c.reset} the-stacks ${c.dim}or${c.reset} npx the-stacks`);
  log(`    ${c.dim}Or manually:${c.reset}     cd the-stacks && npm run build && npm start`);
  log();
  log(`  ${c.dim}GitHub:${c.reset}  ${c.cyan}https://github.com/b-koop/the-stacks${c.reset}`);
  log();
}

// ─── Spinner ─────────────────────────────────
function createSpinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan}${frames[i]}${c.reset} ${text}`);
    i = (i + 1) % frames.length;
  }, 80);
  return {
    stop: (msg) => {
      clearInterval(id);
      process.stdout.write(`\r  ${c.green}${c.bold}✓${c.reset} ${msg}\n`);
    },
    fail: (msg) => {
      clearInterval(id);
      process.stdout.write(`\r  ${c.red}${c.bold}✗${c.reset} ${msg}\n`);
    }
  };
}

// ─── Main ────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  if (args.includes('-v') || args.includes('--version')) {
    log(`the-stacks v${VERSION}`);
    process.exit(0);
  }

  let noOpen = args.includes('--no-open');
  let port = PORT;
  const portIdx = args.indexOf('-p') !== -1 ? args.indexOf('-p') : args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1]) || PORT;
  }

  // Target directory (first arg that isn't a flag)
  const targetDir = args.find(a => !a.startsWith('-')) || APP_NAME;
  const fullPath = path.resolve(targetDir);

  banner();

  // Check Node version
  if (!supportsNodeVersion(process.version)) {
    log();
    fail(`Node.js 22.13+ or 24+ required (you have ${process.version})`);
    info(`Download: https://nodejs.org`);
    process.exit(1);
  }
  success(`Node.js ${c.dim}${process.version}${c.reset}`);

  // Check git
  if (!checkCommand('git')) {
    fail('git not found');
    info(`Install: https://git-scm.com`);
    process.exit(1);
  }
  success(`git ${c.dim}available${c.reset}`);

  // Check if already installed
  let skipUpdate = args.includes('--no-update');
  if (fs.existsSync(fullPath)) {
    const hasPackageJson = fs.existsSync(path.join(fullPath, 'package.json'));
    if (hasPackageJson) {
      log();
      step(`Existing install found at ${c.bold}${targetDir}${c.reset}`);

      // Check for updates
      if (!skipUpdate && fs.existsSync(path.join(fullPath, '.git'))) {
        const updateSpinner = createSpinner('Checking for updates...');
        try {
          runQuiet('git fetch origin', fullPath);
          const local = runQuiet('git rev-parse HEAD', fullPath).trim();
          const remote = runQuiet('git rev-parse origin/main', fullPath).trim();
          if (local !== remote) {
            updateSpinner.stop('Update available — pulling latest...');
            const pullSpinner = createSpinner('Updating The Stacks...');
            try {
              runQuiet('git pull origin main', fullPath);
              pullSpinner.stop('Updated to latest version');
              // Re-install deps if package.json changed
              const depsSpinner = createSpinner('Checking dependencies...');
              try {
                runQuiet('npm install', fullPath);
                depsSpinner.stop('Dependencies up to date');
              } catch {
                depsSpinner.fail('npm install failed — try running it manually');
              }
            } catch {
              pullSpinner.fail('Update failed — starting with current version');
            }
          } else {
            updateSpinner.stop('Already up to date');
          }
        } catch {
          updateSpinner.stop('Skipped update check');
        }
      }

      log();
      startServer(fullPath, port, noOpen);
      return;
    }
  }

  // Clone (quiet — no git noise)
  log();
  const cloneSpinner = createSpinner('Cloning repository...');
  try {
    runQuiet(`git clone --depth 1 ${REPO} "${fullPath}"`);
    cloneSpinner.stop('Repository cloned');
  } catch {
    cloneSpinner.fail('Failed to clone repository');
    info('Check your internet connection and try again');
    info(`Or clone manually: git clone ${REPO}`);
    process.exit(1);
  }

  // Install (quiet — no deprecation warnings)
  const installSpinner = createSpinner('Installing dependencies...');
  try {
    runQuiet('npm install', fullPath);
    installSpinner.stop('Dependencies installed');
  } catch {
    installSpinner.fail('npm install failed');
    info(`Try manually: cd ${targetDir} && npm install`);
    process.exit(1);
  }

  // Optional tools
  log();
  log(`  ${c.dim}Optional tools:${c.reset}`);
  if (checkCommand('ollama')) success(`ollama ${c.dim}(local LLM)${c.reset}`);
  else warn(`ollama not installed — get it at ollama.com`);
  if (checkCommand('ffmpeg')) success(`ffmpeg ${c.dim}(video transcription)${c.reset}`);
  else warn(`ffmpeg not installed — brew install ffmpeg`);

  // Start
  log();
  startServer(fullPath, port, noOpen);
}

function startServer(dir, port, noOpen) {
  const url = `http://localhost:${port}`;
  const displayUrl = port !== PORT ? url : 'http://local.thestacks.com:4747';

  log(`  ${c.dim}${'─'.repeat(49)}${c.reset}`);
  log();
  log(`  ${c.green}${c.bold}  Ready!${c.reset}  ${c.cyan}${displayUrl}${c.reset}`);
  log();
  log(`  ${c.dim}  Open Settings to configure your LLM provider${c.reset}`);
  log(`  ${c.dim}  Add to Dock: ./scripts/create-desktop-app.sh${c.reset}`);
  log(`  ${c.dim}  Press Ctrl+C to stop${c.reset}`);
  log();
  log(`  ${c.dim}${'─'.repeat(49)}${c.reset}`);
  log();

  if (!noOpen) {
    const openUrl = port !== PORT ? `http://localhost:${port}` : 'http://local.thestacks.com:4747';
    setTimeout(() => openBrowser(openUrl), 2500);
  }

  process.chdir(dir);
  const env = { ...process.env, NODE_ENV: 'production' };

  try {
    execSync('npm run build', { stdio: 'inherit', cwd: dir, env });
  } catch {
    fail('Production build failed');
    process.exit(1);
  }

  const cmd = port !== PORT ? 'npx' : 'npm';
  const args = port !== PORT
    ? ['next', 'start', '--port', String(port)]
    : ['run', 'start'];

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: isWin,
    env,
  });
  child.on('exit', (code) => process.exit(code || 0));
}

main().catch((err) => {
  fail(err.message);
  process.exit(1);
});
