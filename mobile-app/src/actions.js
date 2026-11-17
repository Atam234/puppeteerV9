/**
 * One-shot tasks the app can run: screenshot, PDF, scrape, inspect and
 * multi-step automation. Each runs in its own isolated incognito page.
 */
import {withPage} from './browser.js';

export class UserError extends Error {}

/** Accepts "example.com" or full URLs, but only http(s). */
export function normalizeUrl(input) {
  let value = String(input || '').trim();
  if (!value) {
    throw new UserError('Maglagay ng URL / Please enter a URL.');
  }
  // "example.com" or "localhost:3000" → add https://, but keep explicit
  // schemes like "http://" or "file:" so they can be validated below.
  if (
    !/^[a-z][a-z0-9+.-]*:\/\//i.test(value) &&
    !/^(javascript|data|file|about|chrome|blob|view-source|mailto):/i.test(value)
  ) {
    // Local addresses usually don't have TLS.
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i;
    value = (local.test(value) ? 'http://' : 'https://') + value;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UserError(`Hindi valid na URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UserError('Only http:// and https:// URLs are allowed.');
  }
  return url.href;
}

const WAIT_UNTIL = new Set([
  'load',
  'domcontentloaded',
  'networkidle0',
  'networkidle2',
]);

async function open(page, opts) {
  const url = normalizeUrl(opts.url);
  const waitUntil = WAIT_UNTIL.has(opts.waitUntil)
    ? opts.waitUntil
    : 'networkidle2';
  const response = await page.goto(url, {waitUntil});
  const delay = Math.min(Number(opts.delay || 0), 15_000);
  if (delay > 0) {
    await new Promise(r => {
      return setTimeout(r, delay);
    });
  }
  return response;
}

async function hideSelectors(page, selectors) {
  const list = String(selectors || '')
    .split(',')
    .map(s => {
      return s.trim();
    })
    .filter(Boolean);
  if (list.length) {
    await page.addStyleTag({
      content: `${list.join(',')}{display:none!important}`,
    });
  }
}

export async function screenshot(opts) {
  return await withPage(opts, async page => {
    await open(page, opts);
    await hideSelectors(page, opts.hide);
    const type = ['png', 'jpeg', 'webp'].includes(opts.format)
      ? opts.format
      : 'png';
    const shotOpts = {type, fullPage: Boolean(opts.fullPage)};
    if (type !== 'png') {
      shotOpts.quality = Math.max(10, Math.min(100, Number(opts.quality || 85)));
    }
    if (opts.selector) {
      const el = await page.waitForSelector(opts.selector, {timeout: 10_000});
      if (!el) {
        throw new UserError(`Walang nakitang element: ${opts.selector}`);
      }
      return {buffer: await el.screenshot(shotOpts), type};
    }
    return {buffer: await page.screenshot(shotOpts), type};
  });
}

export async function pdf(opts) {
  return await withPage({...opts, device: 'desktop'}, async page => {
    await open(page, opts);
    await hideSelectors(page, opts.hide);
    const margin = opts.margin || '1cm';
    const buffer = await page.pdf({
      format: ['A4', 'Letter', 'Legal', 'A3', 'A5'].includes(opts.paper)
        ? opts.paper
        : 'A4',
      landscape: Boolean(opts.landscape),
      printBackground: opts.background !== false,
      margin: {top: margin, bottom: margin, left: margin, right: margin},
    });
    return {buffer, title: await page.title()};
  });
}

const SCRAPE_PRESETS = {
  links: {selector: 'a[href]', attr: 'href'},
  images: {selector: 'img[src]', attr: 'src'},
  headings: {selector: 'h1,h2,h3,h4,h5,h6', attr: ''},
  paragraphs: {selector: 'p', attr: ''},
  tables: {selector: 'table', attr: 'table'},
};

export async function scrape(opts) {
  const preset = SCRAPE_PRESETS[opts.preset];
  const selector = preset ? preset.selector : String(opts.selector || '').trim();
  const attr = preset ? preset.attr : String(opts.attr || '').trim();
  if (!selector) {
    throw new UserError('Maglagay ng CSS selector.');
  }
  const limit = Math.min(Number(opts.limit || 500), 5000);
  return await withPage(opts, async page => {
    await open(page, opts);
    const items = await page.$$eval(
      selector,
      (els, attr, limit) => {
        const clean = s => {
          return (s || '').replace(/\s+/g, ' ').trim();
        };
        return els.slice(0, limit).map(el => {
          if (attr === 'table') {
            return {
              tag: 'table',
              rows: [...el.querySelectorAll('tr')].map(tr => {
                return [...tr.querySelectorAll('th,td')].map(c => {
                  return clean(c.textContent);
                });
              }),
            };
          }
          const out = {tag: el.tagName.toLowerCase(), text: clean(el.innerText ?? el.textContent)};
          if (attr) {
            // Resolve URLs to absolute for href/src.
            out[attr] =
              attr in el && typeof el[attr] === 'string'
                ? el[attr]
                : el.getAttribute(attr);
          }
          if (el.tagName === 'IMG') {
            out.alt = el.alt;
          }
          return out;
        });
      },
      attr,
      limit,
    );
    return {
      url: page.url(),
      title: await page.title(),
      selector,
      attr,
      count: items.length,
      items,
    };
  });
}

export async function inspect(opts) {
  return await withPage(opts, async page => {
    const consoleMessages = [];
    const failed = [];
    const byType = {};
    let totalBytes = 0;
    let requestCount = 0;
    page.on('console', msg => {
      if (consoleMessages.length < 200) {
        consoleMessages.push({type: msg.type(), text: msg.text()});
      }
    });
    page.on('pageerror', err => {
      consoleMessages.push({type: 'pageerror', text: String(err.message || err)});
    });
    page.on('requestfailed', req => {
      failed.push({url: req.url(), error: req.failure()?.errorText});
    });
    page.on('requestfinished', async req => {
      requestCount++;
      const type = req.resourceType();
      byType[type] = (byType[type] || 0) + 1;
      const len = Number(req.response()?.headers()['content-length'] || 0);
      totalBytes += len;
    });

    const started = Date.now();
    const response = await open(page, opts);
    const loadMs = Date.now() - started;

    const info = await page.evaluate(() => {
      const meta = name => {
        return (
          document.querySelector(`meta[name="${name}"]`)?.content ||
          document.querySelector(`meta[property="${name}"]`)?.content ||
          ''
        );
      };
      const nav = performance.getEntriesByType('navigation')[0];
      const paints = Object.fromEntries(
        performance.getEntriesByType('paint').map(p => {
          return [p.name, Math.round(p.startTime)];
        }),
      );
      const imgs = [...document.images];
      return {
        title: document.title,
        description: meta('description'),
        ogTitle: meta('og:title'),
        ogImage: meta('og:image'),
        lang: document.documentElement.lang,
        viewportMeta: meta('viewport'),
        canonical: document.querySelector('link[rel=canonical]')?.href || '',
        h1: [...document.querySelectorAll('h1')].map(h => {
          return h.innerText.trim();
        }).slice(0, 10),
        links: document.querySelectorAll('a[href]').length,
        images: imgs.length,
        imagesWithoutAlt: imgs.filter(i => {
          return !i.alt;
        }).length,
        scripts: document.scripts.length,
        domNodes: document.getElementsByTagName('*').length,
        timing: nav
          ? {
              ttfb: Math.round(nav.responseStart),
              domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
              load: Math.round(nav.loadEventEnd),
              transferSize: nav.transferSize,
            }
          : null,
        paints,
      };
    });
    const metrics = await page.metrics();
    const cookies = await page.cookies();
    return {
      url: page.url(),
      status: response?.status() ?? null,
      headers: response?.headers() ?? {},
      securityState: response?.securityDetails()
        ? {
            protocol: response.securityDetails().protocol(),
            issuer: response.securityDetails().issuer(),
            validTo: new Date(response.securityDetails().validTo() * 1000).toISOString(),
          }
        : null,
      loadMs,
      ...info,
      requests: {count: requestCount, byType, totalBytes, failed: failed.slice(0, 50)},
      metrics: {
        jsHeapUsedMB: +(metrics.JSHeapUsedSize / 1048576).toFixed(2),
        layoutCount: metrics.LayoutCount,
        scriptDurationMs: Math.round(metrics.ScriptDuration * 1000),
      },
      cookies: cookies.map(c => {
        return {name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly};
      }),
      console: consoleMessages,
    };
  });
}

/**
 * Runs a list of user-defined steps. Supported actions:
 * goto, click, type, press, wait, waitFor, scroll, select, hover,
 * screenshot, extract, evaluate.
 */
export async function automate(opts) {
  const steps = Array.isArray(opts.steps) ? opts.steps.slice(0, 50) : [];
  if (!steps.length) {
    throw new UserError('Walang steps. Add at least one step.');
  }
  return await withPage(opts, async page => {
    const log = [];
    const screenshots = [];
    const data = [];
    for (const [i, step] of steps.entries()) {
      const started = Date.now();
      const entry = {step: i + 1, action: step.action, ok: true};
      try {
        switch (step.action) {
          case 'goto':
            await page.goto(normalizeUrl(step.value), {waitUntil: 'networkidle2'});
            entry.detail = page.url();
            break;
          case 'click':
            await page.locator(step.selector).click();
            break;
          case 'type':
            await page.locator(step.selector).fill(String(step.value ?? ''));
            break;
          case 'press':
            await page.keyboard.press(step.value || 'Enter');
            break;
          case 'hover':
            await page.locator(step.selector).hover();
            break;
          case 'select':
            await page.select(step.selector, String(step.value ?? ''));
            break;
          case 'wait':
            await new Promise(r => {
              return setTimeout(r, Math.min(Number(step.value || 1000), 30_000));
            });
            break;
          case 'waitFor':
            await page.waitForSelector(step.selector, {visible: true});
            break;
          case 'waitForNavigation':
            await page.waitForNavigation({waitUntil: 'networkidle2'});
            break;
          case 'scroll':
            await page.evaluate(px => {
              return px === 'bottom'
                ? window.scrollTo(0, document.body.scrollHeight)
                : window.scrollBy(0, Number(px) || window.innerHeight);
            }, step.value);
            break;
          case 'screenshot': {
            const buf = await page.screenshot({
              type: 'jpeg',
              quality: 80,
              fullPage: step.value === 'full',
            });
            screenshots.push({step: i + 1, data: buf.toString('base64')});
            break;
          }
          case 'extract': {
            const values = await page.$$eval(
              step.selector,
              (els, attr) => {
                return els.slice(0, 500).map(el => {
                  return attr
                    ? (attr in el && typeof el[attr] === 'string' ? el[attr] : el.getAttribute(attr))
                    : (el.innerText ?? el.textContent).trim();
                });
              },
              step.value || '',
            );
            data.push({step: i + 1, selector: step.selector, values});
            entry.detail = `${values.length} item(s)`;
            break;
          }
          case 'evaluate': {
            // Runs inside the sandboxed browser page, never on the server.
            const result = await page.evaluate(
              `(async () => { ${step.value} })()`,
            );
            data.push({step: i + 1, result: result ?? null});
            break;
          }
          default:
            throw new UserError(`Unknown action: ${step.action}`);
        }
      } catch (err) {
        entry.ok = false;
        entry.error = err.message;
      }
      entry.ms = Date.now() - started;
      log.push(entry);
      if (!entry.ok && !opts.continueOnError) {
        break;
      }
    }
    return {finalUrl: page.url(), title: await page.title(), log, screenshots, data};
  });
}
