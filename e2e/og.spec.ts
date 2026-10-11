import { expect, test } from "@playwright/test";

/** Chat apps unfurl links from the meta tags and fetch the image. */
test("the page carries Open Graph tags and serves the preview image", async ({
  request,
}) => {
  const home = await request.get("/");
  expect(home.ok()).toBe(true);
  const html = await home.text();
  expect(html).toContain('property="og:image"');
  const image = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(image).toBe("https://wavelength.lgtm.page/og.png");

  // Join links are the same document, so they unfurl the same way.
  const join = await request.get("/join/BCDF");
  expect(join.ok()).toBe(true);
  expect(await join.text()).toContain('property="og:image"');

  const png = await request.get("/og.png");
  expect(png.ok()).toBe(true);
  expect(png.headers()["content-type"]).toContain("image/png");
  const bytes = await png.body();
  // PNG signature, then the IHDR chunk: width and height as big-endian u32.
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
});
