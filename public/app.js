import { createTryOnRenderer } from "./scene.js";

const elements = {
  input: document.querySelector("#photo-input"),
  uploadLabel: document.querySelector("#upload-label"),
  preview: document.querySelector("#preview-image"),
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
let scene3d = null;
let calibrating = false;
let uploadRequest = 0;

const BACKGROUND_REMOVAL_MODULE =
  "https://esm.sh/@imgly/background-removal@1.5.8?bundle";

function setProcessing(active, message = "正在用本地工具抠出宠物") {
  elements.processing.hidden = !active;
  elements.processing.querySelector("strong").textContent = message;
  elements.input.disabled = active;
}

async function removePetBackgroundLocally(file) {
  const { removeBackground } = await import(BACKGROUND_REMOVAL_MODULE);
  return removeBackground(file, {
    output: { format: "image/png" },
  });
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function setSelected(product) {
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
    option.innerHTML = `<img src="${product.asset}" alt="">`;
    option.addEventListener("click", () => setSelected(product));
    elements.styles.append(option);

    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <button class="product-art" type="button" style="--tile:${product.color}" aria-label="试戴${product.name}">
        <span>NEW SEASON</span><img src="${product.asset}" alt="${product.name}口水巾">
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
  elements.generate.disabled = !scene3d;
  elements.generateLabel.textContent = "保存宠物试戴图";

  const requestId = ++uploadRequest;
  setProcessing(true);
  showError("");
  try {
    const cutout = await removePetBackgroundLocally(file);
    if (requestId !== uploadRequest) return;
    const cutoutUrl = URL.createObjectURL(cutout);
    scene3d?.setPetCutout(cutoutUrl);
    elements.previewCaption.textContent = `${selected.name} · 已抠出宠物，可定位口水巾`;
  } catch (error) {
    if (requestId !== uploadRequest) return;
    scene3d?.clearPetCutout();
    elements.previewCaption.textContent = `${selected.name} · 可定位口水巾`;
    showError("本地抠图暂时失败，已保留原图试戴效果，请重试。");
  } finally {
    if (requestId === uploadRequest) setProcessing(false);
  }
});

elements.calibrate.addEventListener("click", () => {
  calibrating = !calibrating;
  elements.stage.classList.toggle("calibrating", calibrating);
  elements.calibrate.textContent = calibrating ? "点一下宠物的脖颈" : "定位脖颈 ↗";
});

elements.stage.addEventListener("click", (event) => {
  if (!calibrating || !scene3d) return;
  const bounds = elements.stage.getBoundingClientRect();
  scene3d.setPlacement((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  calibrating = false;
  elements.stage.classList.remove("calibrating");
  elements.calibrate.textContent = "重新定位 ↗";
});

elements.size.addEventListener("input", () => {
  elements.sizeValue.textContent = `${elements.size.value}%`;
  scene3d?.setSize(Number(elements.size.value));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    scene3d?.setView(button.dataset.view);
  });
});

elements.generate.addEventListener("click", async () => {
  if (!scene3d || !selected) return;
  elements.generate.disabled = true;
  showError("");
  try {
    const blob = await scene3d.exportPng();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `尾巴日记-${selected.name}-宠物试戴.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    showError(error instanceof Error ? error.message : "保存失败，请重试。");
  } finally {
    elements.generate.disabled = false;
  }
});

try {
  scene3d = createTryOnRenderer(
    document.querySelector("#preview"),
    document.querySelector("#render-canvas"),
    elements.preview,
  );
  const response = await fetch("/api/catalog");
  if (!response.ok) throw new Error("款式加载失败，请刷新页面重试。");
  products = await response.json();
  if (!products.length) throw new Error("暂无可用款式。");
  renderProducts();
} catch (error) {
  showError(error instanceof Error ? error.message : "无法启动 3D 试戴，请使用支持 WebGL 的浏览器。");
  elements.selectedName.textContent = "暂时无法加载";
}
