import { handler } from "./main.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const info = {
  remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 9000 },
} as Deno.ServeHandlerInfo;

Deno.test("catalog and static assets are served", async () => {
  const catalog = await handler(new Request("http://localhost/api/catalog"), info);
  const data = await catalog.json();
  assert(catalog.status === 200 && data.length === 4, "catalog should contain four styles");
  const image = await handler(new Request("http://localhost/assets/cherry.png"), info);
  assert(image.status === 200 && image.headers.get("content-type") === "image/png", "asset should load");
  const traversal = await handler(new Request("http://localhost/%2e%2e/catalog.ts"), info);
  assert(traversal.status === 404, "source files must not be exposed");
});

Deno.test("try-on rejects invalid input and sends the selected product to image API", async () => {
  const oldKey = Deno.env.get("IMAGE_API_KEY");
  const originalFetch = globalThis.fetch;
  Deno.env.set("IMAGE_API_KEY", "test-key");
  try {
    const badForm = new FormData();
    badForm.append("productId", "nonexistent");
    badForm.append("photo", new Blob([new Uint8Array([1, 2, 3])]), "dog.jpg");
    const bad = await handler(new Request("http://localhost/api/try-on", {
      method: "POST",
      body: badForm,
    }), info);
    assert(bad.status === 400, "unknown product must fail");

    let called = false;
    globalThis.fetch = async (input, init) => {
      called = true;
      assert(String(input) === "https://meapi.space/v1/images/edits", "relay endpoint should be used");
      assert(init?.headers && "authorization" in init.headers, "API key must be server-side");
      const form = init.body as FormData;
      assert(form.getAll("image[]").length === 2, "dog and product references must be sent");
      assert(String(form.get("prompt")).includes("樱桃"), "prompt should include selected style");
      return Response.json({ data: [{ b64_json: "dGVzdA==" }] });
    };
    const form = new FormData();
    form.append("productId", "cherry");
    form.append("photo", new Blob([new Uint8Array([0xff, 0xd8, 0xff, ...Array(20).fill(0)])], {
      type: "image/jpeg",
    }), "dog.jpg");
    const result = await handler(new Request("http://localhost/api/try-on", {
      method: "POST",
      body: form,
    }), { remoteAddr: { transport: "tcp", hostname: "test-success", port: 9000 } } as Deno.ServeHandlerInfo);
    const data = await result.json();
    assert(called && result.status === 200, "image edit should succeed");
    assert(data.image === "data:image/png;base64,dGVzdA==", "image should be returned");
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) Deno.env.delete("IMAGE_API_KEY");
    else Deno.env.set("IMAGE_API_KEY", oldKey);
  }
});
