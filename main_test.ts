import { handler } from "./main.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("serves the catalog and the local 3D library", async () => {
  const catalog = await handler(new Request("http://localhost/api/catalog"));
  const products = await catalog.json();
  assert(catalog.status === 200 && products.length === 4, "catalog should have four products");
  const library = await handler(new Request("http://localhost/vendor/three.module.js"));
  assert(library.status === 200, "Three.js should be available locally");
  assert(library.headers.get("content-type")?.startsWith("text/javascript"), "module MIME type");
});

Deno.test("only serves public files", async () => {
  const source = await handler(new Request("http://localhost/catalog.ts"));
  assert(source.status === 404, "source files should not be served");
  const traversal = await handler(new Request("http://localhost/%2e%2e/main.ts"));
  assert(traversal.status === 404, "path traversal should fail");
  const oldApi = await handler(new Request("http://localhost/api/try-on", { method: "POST" }));
  assert(oldApi.status === 405, "there should be no image generation endpoint");
});
