const elements = {
  input: document.querySelector("#photo-input"),
  uploadLabel: document.querySelector("#upload-label"),
  preview: document.querySelector("#preview-image"),
  generated: document.querySelector("#generated-image"),
  previewLabel: document.querySelector("#preview-label"),
  previewCaption: document.querySelector("#preview-caption"),
  styles: document.querySelector("#style-options"),
  productGrid: document.querySelector("#product-grid"),
  selectedName: document.querySelector("#selected-name"),
  selectedPrice: document.querySelector("#selected-price"),
  generate: document.querySelector("#generate-button"),
  generateLabel: document.querySelector("#generate-label"),
  calibrate: document.querySelector("#calibrate-button"),
  stage: document.querySelector("#preview"),
  size: document.querySelector("#size-range"),
  sizeValue: document.querySelector("#size-value"),
  error: document.querySelector("#error-message"),
  processing: document.querySelector("#processing"),
};

let products = [];
let selected = null;
let photoUrl = null;
let sourceFile = null;
let cutoutBlob = null;
let generatedImage = null;
let scene3d = null;
let calibrating = false;
let uploadRequest = 0;

const BACKGROUND_REMOVAL_MODULE =
  "https://esm.sh/@imgly/background-removal@1.5.8?bundle";
const BACKGROUND_REMOVAL_DATA =
  "https://staticimgly.com/@imgly/background-removal-data/1.5.8/dist/";

function setProcessing(active, message = "正在用本地工具抠出宠物", progress = 0) {
  elements.processing.hidden = !active;
  elements.processing.querySelector("strong").textContent = message;
  elements.processing.querySelector(".progress-fill").style.width = `${progress}%`;
  elements.processing.querySelector(".progress-value").textContent = `${progress}%`;
  elements.input.disabled = active;
}

async function removePetBackgroundLocally(file, onProgress) {
  const { removeBackground } = await import(BACKGROUND_REMOVAL_MODULE);
  return removeBackground(file, {
    model: "isnet_quint8",
    publicPath: BACKGROUND_REMOVAL_DATA,
    output: { format: "image/png" },
    progress: onProgress,
  });
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function clearGeneratedResult() {
  generatedImage = null;
  elements.generated.src = "";
  elements.generated.hidden = true;
  elements.generateLabel.textContent = sourceFile ? "生成自然试戴效果" : "请先上传宠物照片";
}

function setSelected(product) {
  clearGeneratedResult();
  selected = product;
  elements.selectedName.textContent = product.name;
  elements.selectedPrice.textContent = `¥${product.price}`;
  document.querySelectorAll(".style-option").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.productId === product.id));
  });
  scene3d?.setStyle(product);
}

function renderProducts() {
  for (const product of products) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "style-option";
    option.dataset.productId = product.id;
    option.style.setProperty("--tile", product.color);
    option.setAttribute("aria-label", product.name);
    option.title = product.name;
    option.innerHTML = `<img src="${product.asset}" alt="" loading="lazy" decoding="async">`;
    option.addEventListener("click", () => setSelected(product));
    elements.styles.append(option);

    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <button class="product-art" type="button" style="--tile:${product.color}" aria-label="试戴${product.name}">
        <span>NEW SEASON</span><img src="${product.asset}" alt="${product.name}口水巾" loading="lazy" decoding="async">
      </button>
      <div class="product-details"><div><h3>${product.name}</h3><p>${product.subtitle}</p></div><strong>¥${product.price}</strong></div>
      <button class="try-link" type="button">试试这款 <span aria-hidden="true">↗</span></button>
    `;
    const choose = () => {
      setSelected(product);
      document.querySelector("#studio").scrollIntoView({ behavior: "smooth" });
    };
    card.querySelector(".product-art").addEventListener("click", choose);
    card.querySelector(".try-link").addEventListener("click", choose);
    elements.productGrid.append(card);
  }
  setSelected(products[0]);
}

elements.input.addEventListener("change", async () => {
  const file = elements.input.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    showError("请选择 10 MB 以内的 JPG、PNG 或 WebP 照片。");
    elements.input.value = "";
    return;
  }
  showError("");
  sourceFile = file;
  cutoutBlob = null;
  clearGeneratedResult();
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file);
  elements.preview.src = photoUrl;
  elements.preview.alt = "上传的宠物照片与口水巾试戴效果";
  elements.previewLabel.textContent = "你的宠物";
  elements.previewCaption.textContent = `${selected.name} · 正在准备本地抠图`;
  scene3d?.setPlacement(.5, .7);
  scene3d?.clearPetCutout();
  calibrating = false;
  elements.stage.classList.remove("calibrating");
  elements.calibrate.textContent = "定位脖颈 ↗";
  elements.uploadLabel.textContent = file.name.length > 24 ? `${file.name.slice(0, 21)}…` : file.name;
  elements.generate.disabled = false;
  elements.generateLabel.textContent = "生成自然试戴效果";

  const requestId = ++uploadRequest;
  setProcessing(true);
  showError("");
  try {
    const cutout = await removePetBackgroundLocally(file, (key, current, total) => {
      if (requestId !== uploadRequest) return;
      const isDownload = key.startsWith("fetch:");
      const ratio = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
      const progress = isDownload ? Math.round(ratio * 82) : Math.round(82 + ratio * 16);
      setProcessing(
        true,
        isDownload ? "正在下载开源抠图组件" : "正在分析宠物轮廓",
        Math.min(98, progress),
      );
    });
    if (requestId !== uploadRequest) return;
    cutoutBlob = cutout;
    const cutoutUrl = URL.createObjectURL(cutout);
    scene3d?.setPetCutout(cutoutUrl);
    elements.previewCaption.textContent = `${selected.name} · 已抠出宠物，可定位口水巾`;
    setProcessing(true, "抠图完成", 100);
  } catch (error) {
    if (requestId !== uploadRequest) return;
    scene3d?.clearPetCutout();
    cutoutBlob = null;
    elements.previewCaption.textContent = `${selected.name} · 可定位口水巾`;
    showError("本地抠图暂时失败，已保留原图试戴效果，请重试。");
  } finally {
    if (requestId === uploadRequest) setProcessing(false);
  }
});

elements.calibrate.addEventListener("click", () => {
  clearGeneratedResult();
  calibrating = !calibrating;
  elements.stage.classList.toggle("calibrating", calibrating);
  elements.calibrate.textContent = calibrating ? "点一下宠物的脖颈" : "定位脖颈 ↗";
});

elements.stage.addEventListener("click", (event) => {
  if (!calibrating || !scene3d) return;
  clearGeneratedResult();
  const bounds = elements.stage.getBoundingClientRect();
  scene3d.setPlacement((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  calibrating = false;
  elements.stage.classList.remove("calibrating");
  elements.calibrate.textContent = "重新定位 ↗";
});

elements.size.addEventListener("input", () => {
  clearGeneratedResult();
  elements.sizeValue.textContent = `${elements.size.value}%`;
  scene3d?.setSize(Number(elements.size.value));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    clearGeneratedResult();
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    scene3d?.setView(button.dataset.view);
  });
});

async function requestTryOnImage() {
  if (!sourceFile || !selected) throw new Error("请先上传宠物照片并选择口水巾。");
  const bandanaResponse = await fetch(selected.asset);
  if (!bandanaResponse.ok) throw new Error("口水巾素材加载失败，请刷新页面重试。");
  const bandanaBlob = await bandanaResponse.blob();
  const form = new FormData();
  form.append("pet", sourceFile, sourceFile.name);
  if (cutoutBlob) form.append("cutout", cutoutBlob, "pet-cutout.png");
  form.append("bandana", bandanaBlob, `${selected.id}.png`);
  form.append(
    "prompt",
    `把宠物自然地戴上“${selected.name}”口水巾。${selected.detail} 保持宠物的品种、脸部、毛发、姿势、背景和照片构图不变，只在脖颈位置添加口水巾，让布料贴合宠物身体并有真实阴影，生成自然的商品试戴效果图。`,
  );
  const response = await fetch("/api/try-on", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "图像生成失败，请稍后重试。");
  if (typeof payload.image !== "string" || !payload.image) {
    throw new Error("生成服务没有返回图片，请稍后重试。");
  }
  return payload.image;
}

elements.generate.addEventListener("click", async () => {
  if (generatedImage) {
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `尾巴日记-${selected.name}-宠物试戴.png`;
    link.click();
    return;
  }
  if (!sourceFile || !selected) {
    showError("请先上传一张宠物照片。");
    return;
  }
  elements.generate.disabled = true;
  showError("");
  setProcessing(true, "正在提交宠物试戴任务", 8);
  let progress = 8;
  const progressTimer = setInterval(() => {
    progress = Math.min(90, progress + Math.max(1, Math.round((90 - progress) / 8)));
    setProcessing(true, progress < 35 ? "正在准备图片" : "正在生成自然试戴效果", progress);
  }, 700);
  try {
    generatedImage = await requestTryOnImage();
    elements.generated.src = generatedImage;
    elements.generated.hidden = false;
    elements.previewCaption.textContent = `${selected.name} · 已生成自然试戴效果`;
    elements.generateLabel.textContent = "下载生成效果图";
    setProcessing(true, "生成完成", 100);
  } catch (error) {
    generatedImage = null;
    showError(error instanceof Error ? error.message : "保存失败，请重试。");
  } finally {
    clearInterval(progressTimer);
    setProcessing(false);
    elements.generate.disabled = false;
  }
});

async function initializeStudio() {
  try {
    const [{ createTryOnRenderer }, response] = await Promise.all([
      import("./scene.js"),
      fetch("/api/catalog"),
    ]);
    if (!response.ok) throw new Error("款式加载失败，请刷新页面重试。");
    products = await response.json();
    if (!products.length) throw new Error("暂无可用款式。");
    scene3d = createTryOnRenderer(
      document.querySelector("#preview"),
      document.querySelector("#render-canvas"),
      elements.preview,
    );
    renderProducts();
  } catch (error) {
    showError(error instanceof Error ? error.message : "无法启动 3D 试戴，请使用支持 WebGL 的浏览器。");
    elements.selectedName.textContent = "暂时无法加载";
  }
}

const scheduleStudio = window.requestIdleCallback
  ? (callback) => window.requestIdleCallback(callback, { timeout: 900 })
  : (callback) => setTimeout(callback, 120);
scheduleStudio(initializeStudio);
