# windowshow

这个项目是纯静态网页（`index.html` + `css/` + `js/` + `datas/` + `plugins/`），可以直接部署到 GitHub Pages。

## GitHub Pages 发布（推荐）

1. 把代码推送到 GitHub 仓库（通常是 `main` 分支）。
2. 打开仓库 `Settings -> Pages`。
3. 在 `Build and deployment` 中选择：
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
4. 保存后等待 1-3 分钟。
5. 访问页面地址：
   - `https://sjqbjut.github.io/windowshow/`

## 关于 CNAME


如果后续你要绑定自己的域名：

1. 在仓库根目录新建 `CNAME` 文件，内容只写你的域名（例如 `demo.example.com`）。
2. 到域名服务商配置 DNS（通常是 `CNAME` 记录指向 `<你的用户名>.github.io`）。
3. 在仓库 `Settings -> Pages` 里填写同一个自定义域名。

## 本地预览（可选）

```powershell
py -m http.server 8000
```

然后打开 `http://127.0.0.1:8000/` 预览。
地图调试模式`http://127.0.0.1:8000/?mapDebug=1`