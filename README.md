# 尾巴日记 · 狗狗口水巾试戴

客户上传狗狗照片并选择口水巾，Deno TypeScript 后端通过爱码士中转站调用兼容 OpenAI Images Edits 的图像接口，生成具有布料褶皱与立体佩戴效果的试戴图。生成的是 **2D 图片中的 3D 质感效果**，不是可旋转的 3D 模型；AI 效果也不能作为商品尺寸或实物还原的保证。

## 本地运行

安装 Deno，设置 API 密钥后运行：

```powershell
$env:IMAGE_API_KEY = "你的中转站密钥"
deno task dev
```

打开 `http://localhost:8000`。没有密钥时，商品展示仍可预览，生成接口会明确提示尚未配置。默认请求 `https://meapi.space/v1/images/edits`；若中转站提供不同的兼容地址或模型名称，设置 `IMAGE_API_BASE_URL` 和 `IMAGE_MODEL`。需要中转站账号开通支持双图输入的 Images Edits 模型，否则不能完成生成。

## GitHub 与 Deno Deploy

`auto_push.bat` 负责提交并推送到 GitHub，本项目不修改该脚本。在 Deno Deploy 中关联这个 GitHub 仓库，选择 **Dynamic app**，入口文件设置为 `main.ts`。在项目环境变量中添加 `IMAGE_API_KEY`（Secret）；可选设置 `IMAGE_API_BASE_URL` 和 `IMAGE_MODEL`。项目的部署分支选择 `main`。之后运行 `auto_push.bat` 推送，已连接的 GitHub 集成会触发新部署。

API 密钥必须只配置在 Deno Deploy 环境变量，不能提交进仓库。图像生成会产生中转站费用。上线前建议再接入验证码和持久化限额/账号体系；内存频率限制仅限制单实例，无法代替正式的防滥用系统。

## 替换商品

在 `catalog.ts` 中更新商品名称、价格、说明与素材路径。将真实口水巾的清晰正面 PNG/WebP 放进 `public/assets/`，修改对应 `asset` 字段。当前四款、价格与品牌均为演示内容，页面没有支付或订单功能。演示商品图可以使用 `python tools/render_products.py` 重新生成，正式商品请直接替换成实拍素材。

示例狗狗照片来自 Unsplash 图片服务，正式发布时建议替换为自有照片并确认素材授权。客户上传的照片仅在本次请求中发送给图像 API，本站不存储照片或生成结果。
