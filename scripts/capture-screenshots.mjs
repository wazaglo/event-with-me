// Captures the authenticated UI into docs/screenshots/ using the seeded
// ScreenshotOfficer account against the live backend. Run via `bun run`.
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer";

const BASE = "http://localhost:5173";
const EMAIL = "screenshot@example.com";
const PASSWORD = "Screen123!";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const shots = [
  ["03-dashboard.png", "/dashboard"],
  ["04-events.png", "/events"],
  ["05-participants.png", "/participants"],
  ["06-checkin.png", "/check-in"],
  ["07-walk-in.png", "/walk-in"],
  ["08-reports.png", "/reports"],
  ["09-audit.png", "/audit"],
  ["10-settings.png", "/settings"],
  ["11-staff.png", "/staff"],
  ["12-register-public.png", "/register"],
];

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

async function settle() {
  // TanStack Query + networkidle: wait for spinner-free content, cap at 8s.
  try {
    await page
      .waitForNetworkIdle({ idleTime: 700, timeout: 8000 })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
  } catch {}
}

// 1. Sign in through the real UI form
await page.goto(`${BASE}/auth`, { waitUntil: "networkidle2" });
await page.waitForSelector('input[type="email"], input[name="email"]', {
  timeout: 15000,
});
await settle();
await page.screenshot({ path: OUT + "01-login.png" });

const emailInput = await page.$('input[type="email"], input[name="email"]');
const pwInput = await page.$('input[type="password"], input[name="password"]');
await emailInput.type(EMAIL, { delay: 15 });
await pwInput.type(PASSWORD, { delay: 15 });
await page.screenshot({ path: OUT + "02-login-filled.png" });
await page.keyboard.press("Enter");

await page.waitForFunction(() => !location.pathname.startsWith("/auth"), {
  timeout: 20000,
});
await settle();

// 2. Walk the authenticated pages
for (const [file, path] of shots) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  await settle();
  await page.screenshot({ path: OUT + file });
  console.log("captured", file);
}

await browser.close();
console.log("done");
