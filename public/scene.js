import * as THREE from "./vendor/three.module.js";

function bandanaGeometry() {
  const rows = 26;
  const columns = 32;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const width = 1 - t * .998;
    for (let column = 0; column <= columns; column++) {
      const s = column / columns;
      const side = s * 2 - 1;
      const x = side * width * 1.2;
      const y = .5 - t * 1.2;
      const fold = Math.sin(s * Math.PI * 8) * (.025 + t * .055);
      const z = .16 - side * side * (.3 - t * .13) + fold;
      positions.push(x, y, z);
      uvs.push((80 + (320 * t) + 640 * width * s) / 800, 1 - (145 + 425 * t) / 650);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function drawCover(ctx, image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  ctx.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

export function createTryOnRenderer(stage, canvas, photo) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const light = new THREE.DirectionalLight(0xfff5e8, 2.1);
  light.position.set(-1.5, 2.5, 4);
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xb7d4ea, .7);
  fill.position.set(2, -1, 2);
  scene.add(fill);

  const camera = new THREE.OrthographicCamera(-2.5, 2.5, 2, -2, .1, 20);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);

  const geometry = bandanaGeometry();
  const group = new THREE.Group();
  group.scale.y = .68;
  group.rotation.x = -.12;
  scene.add(group);

  const shade = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x2a241f,
    transparent: true,
    opacity: .17,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  shade.position.set(.035, -.04, -.055);
  group.add(shade);
  const cloth = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    roughness: .9,
    metalness: 0,
    transparent: true,
    alphaTest: .04,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  cloth.visible = false;
  shade.visible = false;
  group.add(cloth);

  const loader = new THREE.TextureLoader();
  let selectedId = null;
  let targetAngle = 0;
  let animation = 0;
  let stageWidth = 1;
  let stageHeight = 1;
  let placement = { x: .5, y: .7 };
  let size = 1;

  function render() {
    renderer.render(scene, camera);
  }

  function positionBandana() {
    group.position.x = (placement.x - .5) * 5;
    group.position.y = (0.5 - placement.y) * 5 * stageHeight / stageWidth - .34 * size;
    group.scale.set(size, .68 * size, size);
    render();
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    stageWidth = Math.max(1, Math.round(bounds.width));
    stageHeight = Math.max(1, Math.round(bounds.height));
    const height = 5 * stageHeight / stageWidth;
    camera.left = -2.5;
    camera.right = 2.5;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stageWidth, stageHeight, false);
    positionBandana();
  }

  function setStyle(product) {
    selectedId = product.id;
    const id = selectedId;
    loader.load(product.asset, (texture) => {
      if (selectedId !== id) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      cloth.material.map?.dispose();
      cloth.material.map = texture;
      cloth.material.needsUpdate = true;
      cloth.visible = true;
      shade.visible = true;
      render();
    });
  }

  function setView(view) {
    targetAngle = { left: -.65, front: 0, right: .65 }[view] ?? 0;
    cancelAnimationFrame(animation);
    function animate() {
      group.rotation.y += (targetAngle - group.rotation.y) * .2;
      render();
      if (Math.abs(targetAngle - group.rotation.y) > .001) {
        animation = requestAnimationFrame(animate);
      } else {
        group.rotation.y = targetAngle;
        render();
      }
    }
    animate();
  }

  function setPlacement(x, y) {
    placement = { x: Math.max(.1, Math.min(.9, x)), y: Math.max(.2, Math.min(.9, y)) };
    positionBandana();
  }

  function setSize(percent) {
    size = percent / 100;
    positionBandana();
  }

  async function exportPng() {
    await photo.decode();
    const width = 1600;
    const height = Math.round(width * stageHeight / stageWidth);
    const result = document.createElement("canvas");
    result.width = width;
    result.height = height;
    const ctx = result.getContext("2d");
    if (!ctx) throw new Error("无法创建图片，请换一个浏览器重试。");

    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    render();
    try {
      drawCover(ctx, photo, width, height);
      ctx.drawImage(canvas, 0, 0, width, height);
      return await new Promise((resolve, reject) => {
        result.toBlob((blob) => blob ? resolve(blob) : reject(new Error("无法保存图片。")), "image/png");
      });
    } finally {
      resize();
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  return { setStyle, setView, setPlacement, setSize, exportPng };
}
