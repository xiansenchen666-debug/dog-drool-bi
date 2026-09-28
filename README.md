# 尾巴日记 · 3D 狗狗口水巾试戴

顾客上传正面狗狗照片、选择款式，浏览器用 Three.js 渲染弯曲的 3D 口水巾，与照片实时合成，并下载 PNG。**试戴过程中不调用 AI、不上传客户照片、不产生图像 API 费用。** 因为只有单张 2D 照片，纯代码无法准确重建每只狗狗的脖颈和毛发遮挡；默认位置适合面部与脖颈居中的正面照片，其他照片可单击脖颈位置校准、使用滑杆调整尺寸，无需拖动口水巾。效果仅供参考。

## 本地运行

安装 Deno，在仓库目录执行：

```sh
deno task dev
```

浏览器打开 `http://localhost:8000`。需要支持 WebGL。`public/vendor/` 内已固定 Three.js 0.186.1，不依赖运行时 CDN。

## GitHub 与 Deno Deploy

仓库中的 `auto_push.bat` 会提交并推送到 GitHub。Deno Deploy 中将此仓库创建为 **Dynamic App**，入口文件为 `main.ts`，不需要构建命令、API 密钥或图像模型。GitHub 集成关联 `main` 分支后，后续推送会触发自动部署。

## 换成真实商品

- 编辑 `catalog.ts` 的款式名称、价格、颜色和素材路径。
- 将真实口水巾的正面透明 PNG 放入 `public/assets/`，尺寸建议 800 × 650，主体三角形顶部约从 `(80,145)` 到 `(720,145)`，尖端约在 `(400,570)`。三维网格会按这个区域映射纹理。
- 当前四款、价格和品牌均为演示内容；未接入购物车、订单或支付。
- `public/assets/sample-dog.jpg` 是演示照片，来自 Unsplash 图片服务。正式发布前建议替换为自有照片并确认授权。

演示纹理可通过 `python tools/render_products.py` 重新生成。`public/vendor/three.module.js` 与 `three.core.js` 来自 Three.js 0.186.1。
