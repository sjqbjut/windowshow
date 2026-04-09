const fs = require('fs');
const path = require('path');
const http = require('http');
const open = require('open');

// 内存静态文件表：
//   key   => 请求路径（例如 "/css/style.css"）
//   value => 文件 Buffer 内容
//
// 启动时一次性预加载，避免每次请求都触发磁盘 I/O。
const files = {};

// 将单个静态文件注册到内存表。
function addFile(urlPath, relativeFilePath) {
  const absPath = path.join(__dirname, relativeFilePath);
  if (!fs.existsSync(absPath)) return;
  files[urlPath] = fs.readFileSync(absPath);
}

[
  '/index.html',
  '/css/style.css',
  '/css/animeace2_reg.otf',
  '/datas/apron.csv',
  '/datas/apron_variant.csv',
  '/datas/buildings.csv',
  '/datas/patterns.csv',
  '/datas/area_introduction.csv',
  '/datas/fc_building_per_pattern.json',
  '/datas/fc_building_total.json',
  '/datas/fc_pattern_hierarchy.json',
  '/datas/fc_pattern_total.json',
  '/datas/map_layout.json',
  '/js/main.js',
  '/plugins/d3.min.js',
  '/plugins/d3-annotation.min.js',
  '/plugins/webfont.js',
].forEach((urlPath) => {
  addFile(urlPath, urlPath.slice(1));
});

// 图片同时注册两种 URL：
// 1) 原始文件名 URL（用于直接引用）
// 2) URL 编码后的 basename URL（兼容中文/空格）
//
// 例：
//   /datas/imgs/patterns_img/万字纹.jpg
//   /datas/imgs/patterns_img/%E4%B8%87%E5%AD%97%E7%BA%B9.jpg
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

// 遍历目录并注册所有建筑图片。
function addBuildingImages() {
  const urlPrefix = '/datas/imgs/buildings_img';
  const absDir = path.join(__dirname, 'datas/imgs/buildings_img');
  if (!fs.existsSync(absDir)) return;

  fs.readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => addImageFileBothUrls(urlPrefix, entry.name));
}
// 遍历目录并注册所有地图图片。
function addMapImages() {
  const urlPrefix = '/datas/imgs/map';
  const absDir = path.join(__dirname, 'datas/imgs/map');
  if (!fs.existsSync(absDir)) return;

  fs.readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => addImageFileBothUrls(urlPrefix, entry.name));
}
// 遍历目录并注册衍生谱系用到的裙板纹样图片。
function addApronImages() {
  const urlPrefix = '/datas/imgs/apron';
  const absDir = path.join(__dirname, 'datas/imgs/apron');
  if (!fs.existsSync(absDir)) return;

  fs.readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => addImageFileBothUrls(urlPrefix, entry.name));
}
// 注册页面装饰图（导航灯笼、封面等）。
function addArtDesignImages() {
  const urlPrefix = '/datas/imgs/art_design';
  const absDir = path.join(__dirname, 'datas/imgs/art_design');
  if (!fs.existsSync(absDir)) return;

  fs.readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => addImageFileBothUrls(urlPrefix, entry.name));
}
// 根据 datas/patterns.csv 中的纹样名注册纹样图片。
// 这样服务端可访问资源与数据集保持一致。
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
addMapImages();
addApronImages();
addArtDesignImages();
addPatternImagesFromCsv();
files['/'] = files['/index.html'];

// 项目内用到的最小 MIME 类型映射。
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

// 轻量静态服务器：
// - 去掉查询参数
// - 先按原始 URL 查找，再尝试 decodeURI 后的 URL
// - 从预加载内存表返回内容
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
    // 这里不额外拼接 charset：
    // 该服务主要回传静态/二进制资源，浏览器默认处理即可。
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } else {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

// 默认使用系统分配端口，避免与本机已有服务冲突。
// 如需固定端口，可通过环境变量 PORT 指定。
const requestedPort = Number.parseInt(process.env.PORT || '', 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 0;

server.listen(port, '127.0.0.1', async () => {
  // 当 port=0 时，Node 会自动分配可用端口，需要从 address() 读取。
  const address = server.address();
  const activePort = typeof address === 'object' && address ? address.port : port;
  const url = `http://127.0.0.1:${activePort}`;
  console.log(`Server started: ${url}`);
  // 自动打开浏览器，适配桌面端“双击启动即预览”的使用方式。
  await open(url);
});
