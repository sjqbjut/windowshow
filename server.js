const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const open = require('open');

const files = {};

function addFile(urlPath, relativeFilePath) {
  const absPath = path.join(__dirname, relativeFilePath);
  if (!fs.existsSync(absPath)) return;
  files[urlPath] = fs.readFileSync(absPath);
}

[
  '/index.html',
  '/css/style.css',
  '/css/animeace2_reg.otf',
  '/data/apron.csv',
  '/data/apron_variant.csv',
  '/data/pattern_variant.csv',
  '/data/buildings.csv',
  '/data/patterns.csv',
  '/data/level.csv',
  '/data/area_introduction.csv',
  '/data/fc_building_per_pattern.json',
  '/data/fc_building_total.json',
  '/data/fc_pattern_hierarchy.json',
  '/data/fc_pattern_total.json',
  '/data/map_layout.json',
  '/js/main.js',
  '/js/hierarchy.js',
  '/js/origin.js',
  '/js/lineage.js',
  '/js/lifecycle.js',
  '/plugins/d3.min.js',
  '/plugins/d3-annotation.min.js',
  '/plugins/webfont.js',
].forEach((urlPath) => {
  addFile(urlPath, urlPath.slice(1));
});

function addImageFileBothUrls(urlPrefix, fileName) {
  const absPath = path.join(__dirname, urlPrefix.slice(1), fileName);
  if (!fs.existsSync(absPath)) return false;

  const content = fs.readFileSync(absPath);
  const ext = path.extname(fileName);
  const basename = path.basename(fileName, ext);

  const rawUrl = `${urlPrefix}/${fileName}`;
  const encodedUrl = `${urlPrefix}/${encodeURIComponent(basename)}${ext}`;
  files[rawUrl] = content;
  files[encodedUrl] = content;
  return true;
}

function addFilesFromDir(urlPrefix, relativeDir) {
  const absDir = path.join(__dirname, relativeDir);
  if (!fs.existsSync(absDir)) return;

  fs.readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => addImageFileBothUrls(urlPrefix, entry.name));
}

function addPatternImagesFromCsv() {
  const csvPath = path.join(__dirname, 'data/patterns.csv');
  const imageUrlPrefix = '/data/imgs/patterns_img';
  if (!fs.existsSync(csvPath)) return;

  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) return;

  const patternNames = new Set();
  lines.slice(1).forEach((line) => {
    const firstCommaIndex = line.indexOf(',');
    const rawType = firstCommaIndex >= 0 ? line.slice(0, firstCommaIndex) : line;
    const patternName = rawType.trim();
    if (patternName) patternNames.add(patternName);
  });

  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
  patternNames.forEach((patternName) => {
    imageExtensions.forEach((ext) => {
      addImageFileBothUrls(imageUrlPrefix, `${patternName}${ext}`);
    });
  });
}

addFilesFromDir('/data/imgs/buildings_img', 'data/imgs/buildings_img');
addFilesFromDir('/data/imgs/map', 'data/imgs/map');
addFilesFromDir('/data/imgs/apron', 'data/imgs/apron');
addFilesFromDir('/data/imgs/art_design', 'data/imgs/art_design');
addFilesFromDir('/data/imgs/variant/apron_variant', 'data/imgs/variant/apron_variant');
addFilesFromDir('/data/imgs/variant/patterns_variant', 'data/imgs/variant/patterns_variant');
addFilesFromDir('/data/imgs/summary', 'data/imgs/summary');
addPatternImagesFromCsv();
files['/'] = files['/index.html'];

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.otf': 'font/opentype',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const isPackaged = Boolean(process.pkg);
const lifecycleEnabled =
  process.env.WINDOWSHOW_ENABLE_LIFECYCLE === '1' ||
  (isPackaged && process.env.WINDOWSHOW_DISABLE_LIFECYCLE !== '1');
const lifecycleToken = lifecycleEnabled
  ? process.env.WINDOWSHOW_LIFECYCLE_TOKEN || crypto.randomBytes(16).toString('hex')
  : '';

const LIFECYCLE_PARAM = 'windowshowToken';
const LIFECYCLE_PING_PATH = '/__windowshow__/ping';
const LIFECYCLE_CLOSE_PATH = '/__windowshow__/close';
const LIFECYCLE_CHECK_INTERVAL_MS = 2000;
const LIFECYCLE_TIMEOUT_MS = 25000;
const LIFECYCLE_BOOT_GRACE_MS = 45000;

const lifecycleState = {
  lastSeenAt: Date.now() + LIFECYCLE_BOOT_GRACE_MS,
};

let lifecycleTimer = null;
let shuttingDown = false;
const activeSockets = new Set();

function isValidLifecycleRequest(urlObject) {
  if (!lifecycleEnabled) return false;
  return urlObject.searchParams.get(LIFECYCLE_PARAM) === lifecycleToken;
}

function noContent(res) {
  res.writeHead(204, {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  });
  res.end();
}

function shutdownServer(server) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (lifecycleTimer) {
    clearInterval(lifecycleTimer);
    lifecycleTimer = null;
  }

  const forceExitTimer = setTimeout(() => process.exit(0), 1200);
  forceExitTimer.unref();

  activeSockets.forEach((socket) => socket.destroy());
  activeSockets.clear();

  server.close(() => {
    process.exit(0);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const requestPath = requestUrl.pathname;

  if (requestPath === LIFECYCLE_PING_PATH) {
    if (!isValidLifecycleRequest(requestUrl)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    lifecycleState.lastSeenAt = Date.now();
    noContent(res);
    return;
  }

  if (requestPath === LIFECYCLE_CLOSE_PATH) {
    if (!isValidLifecycleRequest(requestUrl)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    lifecycleState.lastSeenAt = 0;
    noContent(res);
    setTimeout(() => shutdownServer(server), 50);
    return;
  }

  const urlPath = requestPath === '/' ? '/index.html' : requestPath;
  let decodedUrl = urlPath;
  try {
    decodedUrl = decodeURI(urlPath);
  } catch (error) {
    decodedUrl = urlPath;
  }

  const ext = path.extname(urlPath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const content = files[urlPath] || files[decodedUrl];

  if (!content) {
    res.writeHead(404);
    res.end('404 Not Found');
    return;
  }

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
});

server.on('connection', (socket) => {
  activeSockets.add(socket);
  socket.on('close', () => {
    activeSockets.delete(socket);
  });
});

if (lifecycleEnabled) {
  lifecycleTimer = setInterval(() => {
    if (Date.now() - lifecycleState.lastSeenAt > LIFECYCLE_TIMEOUT_MS) {
      shutdownServer(server);
    }
  }, LIFECYCLE_CHECK_INTERVAL_MS);
  lifecycleTimer.unref();
}

const requestedPort = Number.parseInt(process.env.PORT || '', 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 0;
const shouldOpenBrowser = process.env.WINDOWSHOW_SKIP_OPEN !== '1';

server.listen(port, '127.0.0.1', async () => {
  const address = server.address();
  const activePort = typeof address === 'object' && address ? address.port : port;

  let launchUrl = `http://127.0.0.1:${activePort}`;
  if (lifecycleEnabled) {
    launchUrl += `/?${LIFECYCLE_PARAM}=${encodeURIComponent(lifecycleToken)}`;
  }

  if (shouldOpenBrowser) {
    try {
      await open(launchUrl);
    } catch (error) {
      // Keep server running even if opening browser fails.
    }
  }
});

server.on('error', () => {
  shutdownServer(server);
});

process.on('SIGINT', () => shutdownServer(server));
process.on('SIGTERM', () => shutdownServer(server));
