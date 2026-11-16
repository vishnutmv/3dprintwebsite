import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));

await page.goto("http://localhost:5180/product/articulated-dragon", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

const updated = await page.evaluate(() => {
  const KEY = "3dp-client-demo-v1";
  const db = JSON.parse(localStorage.getItem(KEY) || "{}");
  if (!db.products?.length) return "no demo db";
  const product = db.products.find((p) => p.slug === "articulated-dragon") ?? db.products[0];
  product.modelUrl =
    "https://st89310.ispot.cc/uploads/products/1794232261-b9b55e182c-pixellabs-glb-3347-1.glb";
  localStorage.setItem(KEY, JSON.stringify(db));
  return product.slug;
});

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

const heading = await page.locator("h1").first().textContent();
const fallback = await page.getByText("3D preview unavailable").count();
const addToCart = await page.getByRole("button", { name: /Add to Cart/i }).count();
await page.screenshot({ path: ".verify/model-fallback.jpg", type: "jpeg", quality: 82 });

console.log(JSON.stringify({ updated, heading, fallback, addToCart, errors, url: page.url() }, null, 2));
await browser.close();
