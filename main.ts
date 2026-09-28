import { products } from "./catalog.ts";

const root = new URL("./public/", import.meta.url);
const DEFAULT_IMAGE_API_BASE_URL = "https://meapi.space/v1";
const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-flare";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function staticFile(pathname: string, head: boolean): Promise<Response> {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (path === "/") path = "/index.html";
  if (path.includes("\\") || path.split("/").includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const fileUrl = new URL(`.${path}`, root);
  const extension = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
  if (!fileUrl.href.startsWith(root.href) || !types[extension]) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const bytes = await Deno.readFile(fileUrl);
    return new Response(head ? null : bytes, {
      headers: {
        "content-type": types[extension],
        "x-content-type-options": "nosniff",
        "cache-control": "no-cache",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function imageDataUrl(base64: string, mimeType = "image/png"): string {
  return `data:${mimeType};base64,${base64}`;
}

async function readImageResult(response: Response): Promise<string | null> {
  const body = await response.json().catch(() => null) as
    | { data?: Array<{ b64_json?: string; url?: string }> }
    | { image?: string }
    | null;
  const first = body && "data" in body ? body.data?.[0] : undefined;
  if (first?.b64_json) return imageDataUrl(first.b64_json);
  if (first?.url) return first.url;
  if (body && "image" in body && typeof body.image === "string") return body.image;
  return null;
}

async function generateTryOn(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("请求格式不正确，请重新上传图片。", 400);
  }

  const pet = form.get("pet");
  const cutout = form.get("cutout");
  const bandana = form.get("bandana");
  const prompt = form.get("prompt");
  if (!(pet instanceof File) || !(bandana instanceof File)) {
    return jsonError("请同时上传宠物照片和口水巾素材。", 400);
  }
  if (!ACCEPTED_IMAGE_TYPES.has(pet.type) || pet.size > MAX_UPLOAD_BYTES) {
    return jsonError("宠物照片必须是 10 MB 以内的 JPG、PNG 或 WebP。", 400);
  }
  if (!ACCEPTED_IMAGE_TYPES.has(bandana.type) || bandana.size > MAX_UPLOAD_BYTES) {
    return jsonError("口水巾素材格式不受支持。", 400);
  }
  if (cutout instanceof File &&
    (!ACCEPTED_IMAGE_TYPES.has(cutout.type) || cutout.size > MAX_UPLOAD_BYTES)) {
    return jsonError("宠物抠图格式不受支持。", 400);
  }

  const apiKey = Deno.env.get("IMAGE_API_KEY");
  if (!apiKey) {
    return jsonError("图像生成服务尚未配置，请在 Deno Secret 中设置 IMAGE_API_KEY。", 503);
  }

  const baseUrl = (Deno.env.get("IMAGE_API_BASE_URL") || DEFAULT_IMAGE_API_BASE_URL).replace(/\/+$/, "");
  const model = Deno.env.get("IMAGE_MODEL") || DEFAULT_IMAGE_MODEL;
  const upstreamForm = new FormData();
  upstreamForm.append("model", model);
  upstreamForm.append("image[]", pet, pet.name || "pet-image");
  if (cutout instanceof File) {
    upstreamForm.append("image[]", cutout, cutout.name || "pet-cutout.png");
  }
  upstreamForm.append("image[]", bandana, bandana.name || "bandana.png");
  upstreamForm.append(
    "prompt",
    typeof prompt === "string" && prompt.trim()
      ? prompt.trim()
      : "把参考图片中的宠物自然地戴上参考图片中的口水巾。保持宠物的品种、脸部、毛发、姿势、背景和照片构图不变，只在脖颈位置添加口水巾，并让布料贴合毛发和身体，生成真实自然的商品试戴效果图。",
  );
  upstreamForm.append("quality", Deno.env.get("IMAGE_QUALITY") || "low");
  upstreamForm.append("size", "1024x1024");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "生成超时，请稍后重试。"
      : "暂时无法连接图像生成服务，请稍后重试。";
    return jsonError(message, 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("image edit upstream error", upstream.status, detail.slice(0, 500));
    return jsonError(
      upstream.status === 429
        ? "生成服务当前较忙，请稍后重试。"
        : "图像生成失败，请检查图片后重试。",
      upstream.status >= 500 ? 502 : 400,
    );
  }

  const image = await readImageResult(upstream);
  if (!image) return jsonError("生成服务没有返回图片，请稍后重试。", 502);
  return Response.json({ image });
}

export function handler(request: Request): Response | Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/catalog" && request.method === "GET") {
    return Response.json(products.map(({ id, name, price, subtitle, color, asset, shape }) =>
      ({ id, name, price, subtitle, color, asset, shape })
    ));
  }
  if (pathname === "/api/try-on" && request.method === "POST") {
    return generateTryOn(request);
  }
  if (pathname === "/api/try-on") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  return staticFile(pathname, request.method === "HEAD");
}

if (import.meta.main) {
  Deno.serve({ port: Number(Deno.env.get("PORT") || 8000) }, handler);
}
