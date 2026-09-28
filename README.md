# 尾巴日记 · 宠物口水巾试戴

顾客上传宠物照片、选择款式，浏览器先用免费开源的本地抠图组件分离宠物，再用 Three.js 渲染弯曲的 3D 口水巾，与照片实时合成，并下载 PNG。抠图在浏览器中运行，客户照片不会上传到 Deno 后端，也不需要图片生成 API。默认位置适合面部与脖颈居中的照片，其他照片可单击脖颈位置校准、使用滑杆调整尺寸和左右视角，无需拖动口水巾。效果仅供参考。

## 本地运行

安装 Deno，在仓库目录执行：

```sh
deno task dev
```

浏览器打开 `http://localhost:8000`。需要支持 WebGL，并允许浏览器加载抠图模型。`public/vendor/` 内已固定 Three.js 0.186.1；抠图模型首次使用时从 `esm.sh` 加载，首次处理可能需要等待。

## GitHub 与 Deno Deploy

仓库中的 `auto_push.bat` 会提交并推送到 GitHub。Deno Deploy 中将此仓库创建为 **Dynamic App**，入口文件为 `main.ts`，不需要构建命令、API 密钥或图片生成模型。GitHub 集成关联 `main` 分支后，后续推送会触发自动部署。

## 换成真实商品

- 编辑 `catalog.ts` 的款式名称、价格、颜色和素材路径。
- 将真实口水巾的正面透明 PNG 放入 `public/assets/`，尺寸建议 800 × 650，主体三角形顶部约从 `(80,145)` 到 `(720,145)`，尖端约在 `(400,570)`。三维网格会按这个区域映射纹理。
- 当前四款、价格和品牌均为演示内容；未接入购物车、订单或支付。
- `public/assets/sample-dog.jpg` 是演示照片，来自 Unsplash 图片服务。正式发布前建议替换为自有照片并确认授权。

演示纹理可通过 `python tools/render_products.py` 重新生成。`public/vendor/three.module.js` 与 `three.core.js` 来自 Three.js 0.186.1。
