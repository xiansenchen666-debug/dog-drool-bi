import { handler } from "./main.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("serves the catalog and the local 3D library", async () => {
  const catalog = await handler(new Request("http://localhost/api/catalog"));
  const products = await catalog.json();
  assert(catalog.status === 200 && products.length === 5, "catalog should have five products");
  assert(products.some((product: { id: string; asset: string; shape: string }) =>
    product.id === "cream-pink-bow" &&
    product.asset === "/assets/cream-pink-bow.png" &&
    product.shape === "bib"
  ), "new bandana should be in the catalog");
  const library = await handler(new Request("http://localhost/vendor/three.module.js"));
  assert(library.status === 200, "Three.js should be available locally");
  assert(library.headers.get("content-type")?.startsWith("text/javascript"), "module MIME type");
});

Deno.test("only serves public files", async () => {
  const source = await handler(new Request("http://localhost/catalog.ts"));
  assert(source.status === 404, "source files should not be served");
  const traversal = await handler(new Request("http://localhost/%2e%2e/main.ts"));
  assert(traversal.status === 404, "path traversal should fail");
  const getApi = await handler(new Request("http://localhost/api/try-on"));
  assert(getApi.status === 405, "try-on should require POST");
});

Deno.test("validates try-on uploads before contacting the image service", async () => {
  const missingImages = await handler(new Request("http://localhost/api/try-on", {
    method: "POST",
    body: new FormData(),
  }));
  assert(missingImages.status === 400, "try-on should require image files");

  const form = new FormData();
  form.append("pet", new File(["pet"], "pet.jpg", { type: "image/jpeg" }));
  form.append("bandana", new File(["bandana"], "bandana.png", { type: "image/png" }));
  const missingConfig = await handler(new Request("http://localhost/api/try-on", {
    method: "POST",
    body: form,
  }));
  assert(missingConfig.status === 503, "try-on should explain missing API configuration");
});
