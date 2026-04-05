const fs = require('fs');
const path = require('path');
const http = require('http');
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
  '/datas/buildings.csv',
  '/datas/patterns.csv',
  '/datas/fc_building_per_pattern.json',
  '/datas/fc_building_relations.json',
  '/datas/fc_building_total.json',
  '/datas/fc_pattern_hierarchy.json',
  '/datas/fc_pattern_total.json',
  '/js/main.js',
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

function addBuildingImages() {
  const urlPrefix = '/datas/imgs/buildings_img';
  const absDir = path.join(__dirname, 'datas/imgs/buildings_img');
  if (!fs.existsSync(absDir)) return;

  fs.readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => addImageFileBothUrls(urlPrefix, entry.name));
}

function addPatternImagesFromCsv() {
  const csvPath = path.join(__dirname, 'datas/patterns.csv');
  const imageUrlPrefix = '/datas/imgs/patterns_img';
  if (!fs.existsSync(csvPath)) return;

  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) return;

  const patternNames = new Set();
  lines.slice(1).forEach((line) => {
    const firstCommaIndex = line.indexOf(',');
    const rawType = firstCommaIndex >= 0 ? line.slice(0, firstCommaIndex) : line;
    const patternName = rawType.trim();
    if (patternName) {
      patternNames.add(patternName);
    }
  });

  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
  patternNames.forEach((patternName) => {
    imageExtensions.forEach((ext) => {
      addImageFileBothUrls(imageUrlPrefix, `${patternName}${ext}`);
    });
  });
}

addBuildingImages();
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

const server = http.createServer((req, res) => {
  let url = (req.url || '/').split('?')[0];
  if (url === '/') url = '/index.html';

  let decodedUrl = url;
  try {
    decodedUrl = decodeURI(url);
  } catch (e) {
    decodedUrl = url;
  }

  const ext = path.extname(url);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const content = files[url] || files[decodedUrl];

  if (content) {
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } else {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

const PORT = 8000;
server.listen(PORT, async () => {
  console.log('Server started: http://localhost:8000');
  await open('http://localhost:8000');
});
