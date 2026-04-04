const fs = require('fs');
const path = require('path');
const http = require('http');
const open = require('open');

// 全文件内嵌（你的真实结构）
const files = {
  '/': fs.readFileSync(path.join(__dirname, 'index.html')),
  '/index.html': fs.readFileSync(path.join(__dirname, 'index.html')),

  '/css/style.css': fs.readFileSync(path.join(__dirname, 'css/style.css')),
  '/css/animeace2_reg.otf': fs.readFileSync(path.join(__dirname, 'css/animeace2_reg.otf')),

  '/datas/buildings.csv': fs.readFileSync(path.join(__dirname, 'datas/buildings.csv')),
  '/datas/patterns.csv': fs.readFileSync(path.join(__dirname, 'datas/patterns.csv')),
  '/datas/fc_building_per_pattern.json': fs.readFileSync(path.join(__dirname, 'datas/fc_building_per_pattern.json')),
  '/datas/fc_building_relations.json': fs.readFileSync(path.join(__dirname, 'datas/fc_building_relations.json')),
  '/datas/fc_building_total.json': fs.readFileSync(path.join(__dirname, 'datas/fc_building_total.json')),
  '/datas/fc_pattern_hierarchy.json': fs.readFileSync(path.join(__dirname, 'datas/fc_pattern_hierarchy.json')),
  '/datas/fc_pattern_total.json': fs.readFileSync(path.join(__dirname, 'datas/fc_pattern_total.json')),

  '/datas/imgs/万字纹.png': fs.readFileSync(path.join(__dirname, 'datas/imgs/万字纹.png')),
  '/datas/imgs/三交六椀菱花.png': fs.readFileSync(path.join(__dirname, 'datas/imgs/三交六椀菱花.png')),
  '/datas/imgs/冰裂纹.png': fs.readFileSync(path.join(__dirname, 'datas/imgs/冰裂纹.png')),
  '/datas/imgs/双交四椀菱花.png': fs.readFileSync(path.join(__dirname, 'datas/imgs/双交四椀菱花.png')),
  '/datas/imgs/斜方格.png': fs.readFileSync(path.join(__dirname, 'datas/imgs/斜方格.png')),
  '/datas/imgs/步步锦.png': fs.readFileSync(path.join(__dirname, 'datas/imgs/步步锦.png')),
  '/datas/imgs/轱辘钱.png': fs.readFileSync(path.join(__dirname, 'datas/imgs/轱辘钱.png')),

  '/js/main.js': fs.readFileSync(path.join(__dirname, 'js/main.js')),
  '/plugins/d3.min.js': fs.readFileSync(path.join(__dirname, 'plugins/d3.min.js')),
  '/plugins/d3-annotation.min.js': fs.readFileSync(path.join(__dirname, 'plugins/d3-annotation.min.js')),
  '/plugins/webfont.js': fs.readFileSync(path.join(__dirname, 'plugins/webfont.js')),
};

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.otf': 'font/opentype',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let url = req.url;
  if (url === '/') url = '/index.html';
  const ext = path.extname(url);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  if (files[url]) {
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(files[url]);
  } else {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

const PORT = 8000;
server.listen(PORT, async () => {
  console.log('服务器已启动: http://localhost:8000');
  await open('http://localhost:8000');
});