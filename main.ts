import { products } from "./catalog.ts";

const root = new URL("./public/", import.meta.url);
const encoder = new TextEncoder();
const maxBodyBytes = 11 * 1024 * 1024;
const maxPhotoBytes = 10 * 1024 * 1024;
const maxConcurrent = 2;
const windowMs = 60 * 60 * 1000;
const maxPerWindow = 3;
const recent = new Map<string, number[]>();
let active = 0;

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function imageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return "image/png";
  if (new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

async function limitedFormData(request: Request): Promise<FormData | null> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return null;
  if (Number(request.headers.get("content-length")) > maxBodyBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    return await new Request("http://local/form", {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type")! },
      body,
    }).formData();
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function clientId(request: Request, info: Deno.ServeHandlerInfo): string {
  // Deno Deploy provides this header; locally, fall back to the TCP peer.
  return request.headers.get("x-deno-remote-addr") ??
    (info.remoteAddr && "hostname" in info.remoteAddr ? info.remoteAddr.hostname : "unknown");
}

async function tryOn(request: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
  const key = Deno.env.get("IMAGE_API_KEY");
  if (!key) return json({ error: "店铺尚未配置图像生成服务，请稍后再试。" }, 503);
  const id = clientId(request, info);
  const now = Date.now();
  const hits = (recent.get(id) ?? []).filter((time) => now - time < windowMs);
  if (hits.length >= maxPerWindow) return json({ error: "生成次数已达上限，请一小时后再试。" }, 429);
  if (active >= maxConcurrent) return json({ error: "正在处理其他试戴，请稍后重试。" }, 503);

  const form = await limitedFormData(request);
  if (!form) return json({ error: "请上传 10 MB 以内的 JPG、PNG 或 WebP 照片。" }, 400);
  const photo = form.get("photo");
  const product = products.find((item) => item.id === form.get("productId"));
  if (!(photo instanceof File) || !product || !photo.size || photo.size > maxPhotoBytes) {
    return json({ error: "照片或款式无效，请重新选择。" }, 400);
  }
  const photoBytes = new Uint8Array(await photo.arrayBuffer());
  const mime = imageType(photoBytes);
  if (!mime) return json({ error: "仅支持 JPG、PNG 或 WebP 图片。" }, 400);

  hits.push(now);
  recent.set(id, hits);
  if (recent.size > 10000) {
    for (const [client, dates] of recent) {
      if (dates.every((date) => now - date >= windowMs)) recent.delete(client);
    }
  }
  active++;
  try {
    const base = new URL(Deno.env.get("IMAGE_API_BASE_URL") || "https://meapi.space/v1");
    if (base.protocol !== "https:") {
      return json({ error: "图像服务地址配置无效。" }, 503);
    }
    const endpoint = new URL(`${base.pathname.replace(/\/+$/, "")}/images/edits`, base.origin);
    const productBytes = await Deno.readFile(new URL(`.${product.asset}`, root));
    const payload = new FormData();
    payload.append("model", Deno.env.get("IMAGE_MODEL") || "gpt-image-2.5-flare");
    payload.append("image[]", new Blob([photoBytes], { type: mime }), `dog.${mime.split("/")[1]}`);
    payload.append("image[]", new Blob([productBytes], { type: "image/png" }), `${product.id}.png`);
    payload.append("size", "1024x1024");
    payload.append("quality", "medium");
    payload.append("output_format", "png");
    payload.append("prompt", [
      "Create one photorealistic, dimensional virtual try-on image of the SAME dog in image 1 wearing",
      `the exact triangular dog bandana shown in image 2 (${product.detail}).`,
      "Image 1 is the identity and scene reference. Preserve the dog's face, eyes, fur color, breed,",
      "pose and recognizable markings. Keep the image 1 background as close as possible.",
      "Place the bandana naturally around the neck, below the chin. Show realistic fabric volume,",
      "folds, stitching, and soft contact shadows, while preserving the exact colors and pattern",
      "of image 2. The bandana must be visible and correctly fitted, not a flat pasted sticker.",
      "No extra dogs, accessories, text, logos, collage, or split-screen. Output one finished image.",
    ].join(" "));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: payload,
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error("Image API error", response.status, details.slice(0, 500));
      return json({ error: "生成服务暂时不可用，请稍后重试。" }, 502);
    }
    const result = await response.json();
    const base64 = result.data?.[0]?.b64_json;
    if (typeof base64 !== "string") return json({ error: "生成结果为空，请重试。" }, 502);
    return json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    console.error("Try-on failed", error);
    return json({ error: "生成中断，请稍后重试。" }, 502);
  } finally {
    active--;
  }
}

async function staticFile(pathname: string): Promise<Response> {
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
  if (!fileUrl.href.startsWith(root.href)) return new Response("Not found", { status: 404 });
  const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
  if (!types[ext]) return new Response("Not found", { status: 404 });
  try {
    const bytes = await Deno.readFile(fileUrl);
    return new Response(bytes, {
      headers: {
        "content-type": types[ext],
        "x-content-type-options": "nosniff",
        "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      },
    });
  } catch {
    return new Response(encoder.encode("Not found"), { status: 404 });
  }
}

export function handler(request: Request, info: Deno.ServeHandlerInfo): Promise<Response> | Response {
  const url = new URL(request.url);
  if (url.pathname === "/api/catalog" && request.method === "GET") {
    return json(products.map(({ id, name, price, subtitle, color, asset }) =>
      ({ id, name, price, subtitle, color, asset })
    ));
  }
  if (url.pathname === "/api/try-on") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    return tryOn(request, info);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  return staticFile(url.pathname);
}

if (import.meta.main) {
  Deno.serve({ port: Number(Deno.env.get("PORT") || 8000) }, handler);
}
