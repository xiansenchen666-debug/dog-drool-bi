import { products } from "./catalog.ts";

const root = new URL("./public/", import.meta.url);
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

export function handler(request: Request): Response | Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/catalog" && request.method === "GET") {
    return Response.json(products.map(({ id, name, price, subtitle, color, asset }) =>
      ({ id, name, price, subtitle, color, asset })
    ));
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  return staticFile(pathname, request.method === "HEAD");
}

if (import.meta.main) {
  Deno.serve({ port: Number(Deno.env.get("PORT") || 8000) }, handler);
}
