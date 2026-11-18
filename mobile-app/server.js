/**
 * Puppeteer Mobile — a phone-friendly control panel for Puppeteer.
 *
 * Start:  npm start
 * Then open the printed URL on your phone (same Wi-Fi) and tap
 * "Add to Home Screen" to install it like an app.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import express from 'express';
import {WebSocketServer} from 'ws';

import {
  UserError,
  automate,
  inspect,
  pdf,
  scrape,
  screenshot,
} from './src/actions.js';
import {
  DEVICE_PRESETS,
  closeBrowser,
  loadPuppeteer,
  puppeteerSource,
  stats,
} from './src/browser.js';
import {handleLiveConnection} from './src/live.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
// Access token protects your server-side browser. Set APP_TOKEN to keep it
// stable between restarts, or APP_TOKEN=off to disable (not recommended).
const TOKEN = process.env.APP_TOKEN || crypto.randomBytes(9).toString('base64url');
const AUTH_ENABLED = TOKEN !== 'off';

function isAuthorized(req) {
  if (!AUTH_ENABLED) {
    return true;
  }
  const header = req.headers['authorization'] || '';
  const given =
    (header.startsWith('Bearer ') ? header.slice(7) : '') ||
    new URL(req.url, 'http://x').searchParams.get('token') ||
    '';
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({limit: '1mb'}));
app.use(
  express.static(path.join(here, 'public'), {
    setHeaders(res, file) {
      if (file.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

// The Android app (APK) serves its UI from its own origin, so allow
// cross-origin API calls. Auth is a bearer token (no cookies), so this is safe.
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ok: true, auth: AUTH_ENABLED});
});

app.use('/api', (req, res, next) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({error: 'Invalid or missing access token.'});
  }
  next();
});

app.get('/api/info', async (_req, res) => {
  await loadPuppeteer();
  res.json({devices: DEVICE_PRESETS, puppeteer: puppeteerSource, jobs: stats()});
});

const wrap = fn => {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err instanceof UserError ? 400 : 500;
      if (status === 500) {
        console.error(err);
      }
      res.status(status).json({error: err.message || String(err)});
    }
  };
};

function filename(url, ext) {
  let host = 'page';
  try {
    host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {}
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${host}-${stamp}.${ext}`;
}

app.post(
  '/api/screenshot',
  wrap(async (req, res) => {
    const {buffer, type} = await screenshot(req.body);
    res.setHeader('Content-Type', `image/${type}`);
    res.setHeader('Content-Disposition', `inline; filename="${filename(req.body.url, type === 'jpeg' ? 'jpg' : type)}"`);
    res.end(buffer);
  }),
);

app.post(
  '/api/pdf',
  wrap(async (req, res) => {
    const {buffer} = await pdf(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename(req.body.url, 'pdf')}"`);
    res.end(buffer);
  }),
);

app.post('/api/scrape', wrap(async (req, res) => {
  res.json(await scrape(req.body));
}));
app.post('/api/inspect', wrap(async (req, res) => {
  res.json(await inspect(req.body));
}));
app.post('/api/automate', wrap(async (req, res) => {
  res.json(await automate(req.body));
}));

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'Not found'});
});

// SPA fallback.
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(here, 'public', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({noServer: true, maxPayload: 1024 * 1024});
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/live') || !isAuthorized(req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    handleLiveConnection(ws);
  });
});

server.listen(PORT, HOST, async () => {
  await loadPuppeteer();
  const addrs = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => {
      return i && i.family === 'IPv4' && !i.internal;
    })
    .map(i => {
      return i.address;
    });
  const q = AUTH_ENABLED ? `/?token=${TOKEN}` : '/';
  console.log('\n  📱 Puppeteer Mobile is running');
  console.log(`  Puppeteer: ${puppeteerSource}\n`);
  console.log(`  This computer:  http://localhost:${PORT}${q}`);
  // Cloud hosts (Render, Railway, ...) expose a public HTTPS address.
  const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');
  if (publicUrl) {
    console.log(`  Public link:    ${publicUrl.replace(/\/+$/, '')}${q}`);
  } else {
    for (const a of addrs) {
      console.log(`  On your phone:  http://${a}:${PORT}${q}`);
    }
  }
  if (AUTH_ENABLED && !process.env.APP_TOKEN) {
    console.log('\n  Tip: set APP_TOKEN=yourSecret to keep the same token between restarts.');
  }
  console.log('');

  // Optional self-test on boot, e.g. STARTUP_CHECK_URL=https://chatgpt.com
  if (process.env.STARTUP_CHECK_URL) {
    const started = Date.now();
    try {
      const r = await scrape({url: process.env.STARTUP_CHECK_URL, preset: 'headings', device: 'desktop', timeout: 60_000});
      console.log(`  Startup check OK in ${Date.now() - started} ms: title="${r.title}" headings=${JSON.stringify(r.items.slice(0, 5).map(i => i.text))}`);
    } catch (err) {
      console.log(`  Startup check FAILED after ${Date.now() - started} ms: ${err.message}`);
    }
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await closeBrowser();
    process.exit(0);
  });
}
