/**
 * Live, interactive remote browser over WebSocket.
 *
 * The server streams JPEG frames (CDP Page.startScreencast) to the phone and
 * replays taps, scrolls and keystrokes from the phone into the page.
 */
import {applyDevice, browserInUse, browserReleased, getBrowser} from './browser.js';
import {normalizeUrl} from './actions.js';

const IDLE_MS = Number(process.env.LIVE_IDLE_MS || 10 * 60_000);
const MAX_LIVE = Number(process.env.MAX_LIVE_SESSIONS || 3);
let liveCount = 0;

export function handleLiveConnection(ws) {
  if (liveCount >= MAX_LIVE) {
    ws.send(JSON.stringify({type: 'error', message: 'Too many live sessions. Close another tab first.'}));
    ws.close();
    return;
  }
  liveCount++;
  browserInUse();

  let context;
  let page;
  let cdp;
  let viewport = {width: 390, height: 844};
  let closed = false;
  let idleTimer;

  const send = msg => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      send({type: 'error', message: 'Session closed after inactivity.'});
      ws.close();
    }, IDLE_MS);
  };

  const sendState = async () => {
    if (!page || page.isClosed()) {
      return;
    }
    send({type: 'state', url: page.url(), title: await page.title().catch(() => {
      return '';
    })});
  };

  const startScreencast = async () => {
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 70,
      maxWidth: Math.round(viewport.width * (viewport.deviceScaleFactor || 1)),
      maxHeight: Math.round(viewport.height * (viewport.deviceScaleFactor || 1)),
      everyNthFrame: 1,
    });
  };

  async function setup(msg) {
    const browser = await getBrowser();
    context = await browser.createBrowserContext();
    page = await context.newPage();
    page.setDefaultTimeout(30_000);
    viewport = await applyDevice(page, msg.device || 'iPhone 15 Pro');
    cdp = await page.createCDPSession();
    cdp.on('Page.screencastFrame', async frame => {
      send({type: 'frame', data: frame.data, width: viewport.width, height: viewport.height});
      await cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => {});
    });
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        void sendState();
      }
    });
    page.on('load', () => {
      return void sendState();
    });
    page.on('dialog', async dialog => {
      send({type: 'toast', message: `Dialog (${dialog.type()}): ${dialog.message()}`});
      await dialog.accept().catch(() => {});
    });
    page.on('popup', async popup => {
      // Keep everything in a single tab: open popups in the main page.
      const url = popup?.url();
      await popup?.close().catch(() => {});
      if (url && url !== 'about:blank') {
        await page.goto(url).catch(() => {});
      }
    });
    await startScreencast();
    send({type: 'ready', viewport});
    if (msg.url) {
      await page.goto(normalizeUrl(msg.url), {waitUntil: 'domcontentloaded'});
    }
  }

  async function handle(msg) {
    if (msg.type === 'start') {
      return await setup(msg);
    }
    if (!page || page.isClosed()) {
      return;
    }
    switch (msg.type) {
      case 'navigate':
        await page.goto(normalizeUrl(msg.url), {waitUntil: 'domcontentloaded'});
        break;
      case 'back':
        await page.goBack({waitUntil: 'domcontentloaded'});
        break;
      case 'forward':
        await page.goForward({waitUntil: 'domcontentloaded'});
        break;
      case 'reload':
        await page.reload({waitUntil: 'domcontentloaded'});
        break;
      case 'tap': {
        const x = msg.x * viewport.width;
        const y = msg.y * viewport.height;
        if (viewport.hasTouch) {
          await page.touchscreen.tap(x, y);
        } else {
          await page.mouse.click(x, y);
        }
        break;
      }
      case 'scroll':
        await page.mouse.move(msg.x * viewport.width, msg.y * viewport.height);
        await page.mouse.wheel({deltaX: msg.dx || 0, deltaY: msg.dy || 0});
        break;
      case 'type':
        await page.keyboard.type(String(msg.text || ''), {delay: 10});
        break;
      case 'key':
        await page.keyboard.press(String(msg.key));
        break;
      case 'device':
        await cdp.send('Page.stopScreencast').catch(() => {});
        viewport = await applyDevice(page, msg.device);
        await startScreencast();
        send({type: 'ready', viewport});
        await page.reload({waitUntil: 'domcontentloaded'}).catch(() => {});
        break;
      case 'screenshot': {
        const buf = await page.screenshot({type: 'png', fullPage: Boolean(msg.fullPage)});
        send({type: 'screenshot', data: buf.toString('base64')});
        break;
      }
      case 'pdf': {
        // Print the page as the user sees it now (e.g. after they passed a
        // site's human check by hand). Use screen styles, like a browser.
        await page.emulateMediaType('screen');
        const buf = await page.pdf({format: 'A4', printBackground: true, margin: {top: '1cm', bottom: '1cm', left: '1cm', right: '1cm'}});
        await page.emulateMediaType(null);
        send({type: 'pdf', data: Buffer.from(buf).toString('base64'), title: await page.title()});
        break;
      }
      case 'evaluate': {
        const result = await page.evaluate(`(async () => { ${msg.code} })()`);
        send({type: 'evalResult', result: result === undefined ? null : result});
        break;
      }
    }
  }

  // Process messages in order so taps and keystrokes don't race.
  let queue = Promise.resolve();
  ws.on('message', raw => {
    resetIdle();
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    queue = queue.then(async () => {
      if (closed) {
        return;
      }
      try {
        await handle(msg);
      } catch (err) {
        send({type: 'toast', level: 'error', message: err.message});
      }
    });
  });

  ws.on('close', async () => {
    closed = true;
    liveCount--;
    clearTimeout(idleTimer);
    await cdp?.send('Page.stopScreencast').catch(() => {});
    await context?.close().catch(() => {});
    browserReleased();
  });

  resetIdle();
}
