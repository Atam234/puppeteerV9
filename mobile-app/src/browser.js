/**
 * Browser management: loads Puppeteer (preferring the local build from this
 * repository), keeps one shared browser alive, and hands out isolated
 * incognito pages with a concurrency limit.
 */
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_BUILD = path.resolve(
  here,
  '../../packages/puppeteer/lib/puppeteer/puppeteer.js',
);

let puppeteerModule;
export let puppeteerSource = 'npm';

export async function loadPuppeteer() {
  if (puppeteerModule) {
    return puppeteerModule;
  }
  if (process.env.USE_NPM_PUPPETEER !== '1' && existsSync(LOCAL_BUILD)) {
    puppeteerModule = await import(pathToFileURL(LOCAL_BUILD).href);
    puppeteerSource = 'local repo build (packages/puppeteer)';
  } else {
    puppeteerModule = await import('puppeteer');
    puppeteerSource = 'npm package "puppeteer"';
  }
  return puppeteerModule;
}

/** Friendly device presets shown in the app. */
export const DEVICE_PRESETS = [
  {id: 'desktop', label: 'Desktop (1366×768)'},
  {id: 'desktop-hd', label: 'Desktop HD (1920×1080)'},
  {id: 'iPhone 15 Pro', label: 'iPhone 15 Pro'},
  {id: 'iPhone 15 Pro Max', label: 'iPhone 15 Pro Max'},
  {id: 'iPhone SE', label: 'iPhone SE'},
  {id: 'Pixel 7', label: 'Pixel 7'},
  {id: 'Galaxy S9+', label: 'Galaxy S9+'},
  {id: 'iPad Pro 11', label: 'iPad Pro 11'},
  {id: 'iPad Mini', label: 'iPad Mini'},
];

const DESKTOP = {
  desktop: {width: 1366, height: 768},
  'desktop-hd': {width: 1920, height: 1080},
};

export async function applyDevice(page, deviceId = 'desktop') {
  const {KnownDevices} = await loadPuppeteer();
  if (DESKTOP[deviceId]) {
    await page.setViewport({...DESKTOP[deviceId], deviceScaleFactor: 1});
    return {isMobile: false, hasTouch: false, ...DESKTOP[deviceId]};
  }
  const device = KnownDevices[deviceId];
  if (!device) {
    await page.setViewport({...DESKTOP.desktop, deviceScaleFactor: 1});
    return {isMobile: false, hasTouch: false, ...DESKTOP.desktop};
  }
  await page.emulate(device);
  return device.viewport;
}

// LOW_MEMORY=1 is meant for small cloud plans (e.g. 512 MB on Render free).
const LOW_MEMORY = process.env.LOW_MEMORY === '1';
const LOW_MEMORY_ARGS = [
  '--renderer-process-limit=1',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-features=Translate,OptimizationHints,MediaRouter',
  '--js-flags=--max-old-space-size=192',
];
// Close the shared browser after a quiet period to give memory back.
const BROWSER_IDLE_MS = Number(process.env.BROWSER_IDLE_MS || (LOW_MEMORY ? 120_000 : 0));
let idleTimer;
let activeUsers = 0;

export function browserInUse() {
  activeUsers++;
  clearTimeout(idleTimer);
}

export function browserReleased() {
  activeUsers = Math.max(0, activeUsers - 1);
  if (BROWSER_IDLE_MS > 0 && activeUsers === 0) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (activeUsers === 0) {
        void closeBrowser();
      }
    }, BROWSER_IDLE_MS);
  }
}

let browserPromise;

export async function getBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => {
      return null;
    });
    if (browser?.connected) {
      return browser;
    }
  }
  browserPromise = (async () => {
    const puppeteer = (await loadPuppeteer()).default;
    const browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'false' ? false : true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        ...(LOW_MEMORY ? LOW_MEMORY_ARGS : []),
      ],
    });
    browser.on('disconnected', () => {
      browserPromise = undefined;
    });
    return browser;
  })();
  return await browserPromise;
}

export async function closeBrowser() {
  const browser = await browserPromise?.catch(() => {
    return null;
  });
  await browser?.close().catch(() => {});
  browserPromise = undefined;
}

// Simple semaphore so a phone can't accidentally start 50 browsers at once.
const MAX_JOBS = Number(process.env.MAX_JOBS || 3);
let running = 0;
const waiting = [];

async function acquire() {
  if (running < MAX_JOBS) {
    running++;
    return;
  }
  await new Promise(resolve => {
    return waiting.push(resolve);
  });
  running++;
}

function release() {
  running--;
  waiting.shift()?.();
}

/**
 * Runs `fn(page)` in a fresh incognito context that is always cleaned up.
 */
export async function withPage(options, fn) {
  await acquire();
  browserInUse();
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(Number(options.timeout || 30_000));
    page.setDefaultNavigationTimeout(Number(options.timeout || 30_000));
    await applyDevice(page, options.device);
    if (options.darkMode) {
      await page.emulateMediaFeatures([
        {name: 'prefers-color-scheme', value: 'dark'},
      ]);
    }
    return await fn(page);
  } finally {
    await context?.close().catch(() => {});
    browserReleased();
    release();
  }
}

export function stats() {
  return {running, waiting: waiting.length, maxJobs: MAX_JOBS};
}
