const elements = {
  input: document.querySelector("#photo-input"),
  uploadLabel: document.querySelector("#upload-label"),
  preview: document.querySelector("#preview-image"),
  previewLabel: document.querySelector("#preview-label"),
  previewCaption: document.querySelector("#preview-caption"),
  badge: document.querySelector("#image-badge"),
  styles: document.querySelector("#style-options"),
  productGrid: document.querySelector("#product-grid"),
  selectedName: document.querySelector("#selected-name"),
  selectedPrice: document.querySelector("#selected-price"),
  generate: document.querySelector("#generate-button"),
  generateLabel: document.querySelector("#generate-label"),
  download: document.querySelector("#download-button"),
  loading: document.querySelector("#loading-layer"),
  error: document.querySelector("#error-message"),
};

let products = [];
let selected = null;
let photo = null;
let photoUrl = null;
let resultUrl = null;
let busy = false;
let selectionVersion = 0;

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function setSelected(product) {
  selectionVersion++;
  selected = product;
  elements.selectedName.textContent = product.name;
  elements.selectedPrice.textContent = `¥${product.price}`;
  document.querySelectorAll("[data-product-id]").forEach((button) => {
    if (button.classList.contains("style-option")) {
      button.setAttribute("aria-pressed", String(button.dataset.productId === product.id));
    }
  });
  if (resultUrl) {
    resultUrl = null;
    elements.download.hidden = true;
    showOriginal();
  }
}

function showOriginal() {
  elements.preview.src = photoUrl || "/assets/sample-dog.jpg";
  elements.preview.alt = photo ? "上传的狗狗照片" : "示例金毛犬照片";
  elements.previewLabel.textContent = photo ? "原始照片" : "示例照片";
  elements.previewCaption.textContent = photo ? "选好款式，生成试戴图" : "先上传一张狗狗照片";
  elements.badge.hidden = false;
  elements.badge.innerHTML = `<span aria-hidden="true">✳</span> ${photo ? "等待生成" : "等待你的狗狗"}`;
}

function renderProducts() {
  elements.styles.replaceChildren();
  elements.productGrid.replaceChildren();
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
      <button class="product-art" type="button" style="--tile:${product.color}" data-product-id="${product.id}" aria-label="试戴${product.name}">
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

elements.input.addEventListener("change", () => {
  const file = elements.input.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    showError("请选择 10 MB 以内的 JPG、PNG 或 WebP 照片。");
    elements.input.value = "";
    return;
  }
  showError("");
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photo = file;
  selectionVersion++;
  photoUrl = URL.createObjectURL(file);
  resultUrl = null;
  elements.uploadLabel.textContent = file.name.length > 24 ? `${file.name.slice(0, 21)}…` : file.name;
  elements.generate.disabled = false;
  elements.generateLabel.textContent = "生成立体试戴图";
  elements.download.hidden = true;
  showOriginal();
});

elements.generate.addEventListener("click", async () => {
  if (!photo || !selected || busy) return;
  busy = true;
  showError("");
  elements.generate.disabled = true;
  elements.generateLabel.textContent = "正在生成…";
  elements.loading.hidden = false;
  const requestedProduct = selected;
  const requestedVersion = selectionVersion;
  const form = new FormData();
  form.append("photo", photo, photo.name);
  form.append("productId", requestedProduct.id);
  try {
    const response = await fetch("/api/try-on", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "生成失败，请稍后再试。");
    if (requestedVersion !== selectionVersion) return;
    resultUrl = data.image;
    elements.preview.src = resultUrl;
    elements.preview.alt = `狗狗佩戴${requestedProduct.name}口水巾的 AI 生成试戴图`;
    elements.previewLabel.textContent = "AI 试戴效果";
    elements.previewCaption.textContent = `${requestedProduct.name} · 已生成`;
    elements.badge.hidden = true;
    elements.download.hidden = false;
  } catch (error) {
    if (requestedVersion === selectionVersion) {
      showError(error instanceof Error ? error.message : "生成失败，请稍后再试。");
    }
  } finally {
    busy = false;
    elements.loading.hidden = true;
    elements.generate.disabled = false;
    elements.generateLabel.textContent = "重新生成试戴图";
  }
});

elements.download.addEventListener("click", () => {
  if (!resultUrl) return;
  const link = document.createElement("a");
  link.href = resultUrl;
  link.download = `尾巴日记-${selected.name}-试戴.png`;
  link.click();
});

try {
  const response = await fetch("/api/catalog");
  if (!response.ok) throw new Error();
  products = await response.json();
  if (!products.length) throw new Error();
  renderProducts();
} catch {
  showError("款式加载失败，请刷新页面重试。");
  elements.selectedName.textContent = "暂时无法加载";
}
