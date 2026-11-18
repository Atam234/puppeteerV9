// Puppeteer Mobile — client app (no build step, plain ES modules).

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------ */
/* Storage (always guarded: private mode can throw)                    */
/* ------------------------------------------------------------------ */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('pm.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('pm.' + key, JSON.stringify(value));
    } catch {}
  },
  del(key) {
    try {
      localStorage.removeItem('pm.' + key);
    } catch {}
  },
};

/* ------------------------------------------------------------------ */
/* i18n                                                                */
/* ------------------------------------------------------------------ */
const STRINGS = {
  fil: {
    loginHelp: 'Ikonekta sa Puppeteer Mobile server mo. I-paste ang buong link mula sa terminal (may ?token=…), o ilagay ang address at token.',
    tokenPh: 'Access token',
    login: 'Kumonekta',
    liveEmpty: 'Mag-type ng website sa itaas at pindutin ang Go para magbukas ng totoong browser.',
    liveStart: 'Simulan ang browser',
    type: 'Mag-type',
    capture: 'Capture',
    stop: 'Isara',
    typeHere: 'I-type dito…',
    send: 'Ipadala',
    liveHint: 'Tap = click · Swipe = scroll · Tap muna sa text box bago mag-type.',
    screenshot: 'Screenshot',
    device: 'Device',
    delay: 'Hintay (segundo)',
    fullPage: 'Buong page (full page)',
    darkMode: 'Dark mode',
    paper: 'Papel',
    printBg: 'Isama ang background',
    advanced: 'Advanced',
    elementOnly: 'Isang element lang (CSS selector)',
    hideEls: 'Itago ang mga element (cookie banner, ads)',
    whatToGet: 'Ano ang kukunin?',
    attrOpt: 'Attribute (optional)',
    extract: 'Kunin ang data',
    steps: 'Mga Hakbang',
    templates: 'Templates…',
    addStep: 'Magdagdag ng hakbang',
    continueOnError: 'Ituloy kahit may error',
    save: 'I-save',
    run: 'Patakbuhin',
    analyze: 'Suriin ang page',
    language: 'Wika / Language',
    theme: 'Tema',
    timeout: 'Timeout (segundo)',
    waitUntil: 'Hintayin hanggang',
    clearData: 'Burahin ang history at saved flows',
    logout: 'Mag-logout',
    working: 'Ginagawa…',
    download: 'I-download',
    share: 'I-share',
    open: 'Buksan',
    copy: 'Kopyahin',
    copied: 'Nakopya!',
    found: 'nakita',
    history: 'History',
    settings: 'Settings',
    noHistory: 'Wala pang history.',
    flowName: 'Pangalan ng flow:',
    saved: 'Na-save!',
    deleted: 'Nabura',
    invalidToken: 'Mali ang token. Subukan ulit.',
    offline: 'Hindi maabot ang server. Naka-on ba ito?',
    jsPrompt: 'JavaScript na tatakbo sa page (gamitin ang return):',
    needServer: 'Ilagay ang server address (hal. 192.168.1.5:3000).',
    serverHelp: 'I-paste ang buong link mula sa terminal (may ?token=…) o ilagay ang address at token.',
    connLost: 'Naputol ang koneksyon sa live browser.',
    confirmClear: 'Burahin lahat ng history at saved flows?',
  },
  en: {
    loginHelp: 'Connect to your Puppeteer Mobile server. Paste the full link from the terminal (with ?token=…), or enter the address and token.',
    tokenPh: 'Access token',
    login: 'Connect',
    liveEmpty: 'Type a website above and press Go to open a real browser.',
    liveStart: 'Start browser',
    type: 'Type',
    capture: 'Capture',
    stop: 'Close',
    typeHere: 'Type here…',
    send: 'Send',
    liveHint: 'Tap = click · Swipe = scroll · Tap a text box first, then type.',
    screenshot: 'Screenshot',
    device: 'Device',
    delay: 'Wait (seconds)',
    fullPage: 'Full page',
    darkMode: 'Dark mode',
    paper: 'Paper',
    printBg: 'Print background',
    advanced: 'Advanced',
    elementOnly: 'Single element only (CSS selector)',
    hideEls: 'Hide elements (cookie banners, ads)',
    whatToGet: 'What do you want to get?',
    attrOpt: 'Attribute (optional)',
    extract: 'Extract data',
    steps: 'Steps',
    templates: 'Templates…',
    addStep: 'Add step',
    continueOnError: 'Continue on error',
    save: 'Save',
    run: 'Run',
    analyze: 'Analyze page',
    language: 'Language',
    theme: 'Theme',
    timeout: 'Timeout (seconds)',
    waitUntil: 'Wait until',
    clearData: 'Clear history and saved flows',
    logout: 'Log out',
    working: 'Working…',
    download: 'Download',
    share: 'Share',
    open: 'Open',
    copy: 'Copy',
    copied: 'Copied!',
    found: 'found',
    history: 'History',
    settings: 'Settings',
    noHistory: 'No history yet.',
    flowName: 'Flow name:',
    saved: 'Saved!',
    deleted: 'Deleted',
    invalidToken: 'Wrong token. Try again.',
    offline: 'Cannot reach the server. Is it running?',
    jsPrompt: 'JavaScript to run in the page (use return):',
    needServer: 'Enter the server address (e.g. 192.168.1.5:3000).',
    serverHelp: 'Paste the full link from the terminal (with ?token=…) or enter the address and token.',
    connLost: 'Lost connection to the live browser.',
    confirmClear: 'Delete all history and saved flows?',
  },
};
let lang = store.get('lang', navigator.language?.startsWith('en') ? 'en' : 'fil');
const t = key => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;

function applyI18n(root = document) {
  document.documentElement.lang = lang;
  $$('[data-i18n]', root).forEach(el => (el.textContent = t(el.dataset.i18n)));
  $$('[data-i18n-ph]', root).forEach(el => (el.placeholder = t(el.dataset.i18nPh)));
}

/* ------------------------------------------------------------------ */
/* Theme + settings                                                    */
/* ------------------------------------------------------------------ */
const settings = Object.assign(
  {theme: 'auto', timeout: 60, waitUntil: 'networkidle2'},
  store.get('settings', {}),
);
function applyTheme() {
  if (settings.theme === 'auto') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = settings.theme;
  }
}
applyTheme();

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */
// Inside the Android app (Capacitor) the UI is bundled, so the server lives
// at a user-provided address instead of the page's own origin.
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
let serverUrl = store.get('server', NATIVE ? '' : location.origin);
const apiBase = () => serverUrl.replace(/\/+$/, '');

/** Accepts "192.168.1.5:3000", "http://host:3000/?token=abc", etc. */
function parseServerLink(input) {
  let value = String(input || '').trim();
  if (!value) return {};
  if (!/^https?:\/\//i.test(value)) value = 'http://' + value;
  try {
    const u = new URL(value);
    return {server: u.origin, token: u.searchParams.get('token') || ''};
  } catch {
    return {};
  }
}

let token = store.get('token', '');
{
  const params = new URLSearchParams(location.search);
  if (params.has('token')) {
    token = params.get('token');
    store.set('token', token);
    params.delete('token');
    history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
  }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, body, {raw = false} = {}) {
  let res;
  try {
    res = await fetch(apiBase() + '/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        ...(body ? {'Content-Type': 'application/json'} : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(t('offline'), 0);
  }
  if (res.status === 401) {
    showLogin(t('invalidToken'));
    throw new ApiError(t('invalidToken'), 401);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  return raw ? res : res.json();
}

const commonOpts = () => ({
  timeout: settings.timeout * 1000,
  waitUntil: settings.waitUntil,
});

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */
function toast(message, level = 'info', ms = 3200) {
  const el = document.createElement('div');
  el.className = 'toast' + (level === 'error' ? ' error' : '');
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function busy(button, fn) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> ${t('working')}`;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function errorCard(container, err) {
  container.hidden = false;
  container.replaceChildren(h('div', {class: 'card error-card'}, '⚠️ ' + err.message));
}

const blobToBase64 = blob =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

async function nativeWrite(blob, name, directory) {
  const res = await window.Capacitor.nativePromise('Filesystem', 'writeFile', {
    path: 'Puppeteer/' + name,
    data: await blobToBase64(blob),
    directory,
    recursive: true,
  });
  return res.uri;
}

async function downloadBlob(blob, name) {
  if (NATIVE) {
    try {
      await nativeWrite(blob, name, 'DOCUMENTS');
      toast('✅ Documents/Puppeteer/' + name, 'info', 4500);
    } catch {
      // Older Android versions may block Documents; fall back to sharing.
      await shareBlob(blob, name);
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', {href: url, download: name});
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function shareBlob(blob, name) {
  if (NATIVE) {
    try {
      const uri = await nativeWrite(blob, name, 'CACHE');
      await window.Capacitor.nativePromise('Share', 'share', {title: name, files: [uri]});
    } catch (err) {
      if (!/cancel/i.test(err?.message || '')) toast(err?.message || 'Share failed', 'error');
    }
    return;
  }
  const file = new File([blob], name, {type: blob.type});
  if (navigator.canShare?.({files: [file]})) {
    try {
      await navigator.share({files: [file], title: name});
    } catch {}
  } else {
    downloadBlob(blob, name);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('copied'));
  } catch {
    toast('Clipboard not available', 'error');
  }
}

function fileName(url, ext) {
  let host = 'page';
  try {
    host = new URL(/^https?:/.test(url) ? url : 'https://' + url).hostname;
  } catch {}
  return `${host}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
}

function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else out[el.name] = el.value;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */
function addHistory(kind, url) {
  const list = store.get('history', []);
  list.unshift({kind, url, at: Date.now()});
  store.set('history', list.slice(0, 50));
  refreshUrlSuggestions();
}

function refreshUrlSuggestions() {
  let dl = $('#url-suggestions');
  if (!dl) {
    dl = h('datalist', {id: 'url-suggestions'});
    document.body.append(dl);
    $$('input[inputmode=url]').forEach(i => i.setAttribute('list', 'url-suggestions'));
  }
  const urls = [...new Set(store.get('history', []).map(x => x.url))].slice(0, 15);
  dl.replaceChildren(...urls.map(u => h('option', {value: u})));
}

const KIND_VIEW = {screenshot: 'capture', pdf: 'capture', extract: 'extract', inspect: 'inspect', live: 'live'};

function openHistory() {
  const list = store.get('history', []);
  const body = list.length
    ? h(
        'ul',
        {class: 'list'},
        list.map(item =>
          h(
            'li',
            {},
            h(
              'button',
              {
                class: 'btn ghost block',
                style: 'justify-content:flex-start;text-align:left;min-height:56px',
                onclick: () => {
                  closeSheet();
                  const view = KIND_VIEW[item.kind] || 'live';
                  showView(view);
                  if (view === 'live') {
                    $('#live-url').value = item.url;
                    liveGo();
                  } else {
                    const input = $(`#view-${view} input[name=url]`);
                    if (input) input.value = item.url;
                    if (item.kind === 'pdf' || item.kind === 'screenshot') setCaptureMode(item.kind);
                  }
                },
              },
              h('span', {}, h('b', {}, item.kind.toUpperCase()), ' · ', item.url,
                h('span', {class: 'sub'}, new Date(item.at).toLocaleString())),
            ),
          ),
        ),
      )
    : h('p', {class: 'hint'}, t('noHistory'));
  openSheet(t('history'), body);
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */
function openSheet(title, content) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').replaceChildren(content);
  $('#sheet').hidden = false;
  $('#sheet-backdrop').hidden = false;
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet-backdrop').hidden = true;
}
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet-backdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => e.key === 'Escape' && closeSheet());

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
function showView(name) {
  $$('.view').forEach(v => (v.hidden = v.id !== 'view-' + name));
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $('#page-title').textContent = $('#view-' + name).dataset.title;
  store.set('view', name);
}
$$('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

/* ------------------------------------------------------------------ */
/* Login / boot                                                        */
/* ------------------------------------------------------------------ */
let serverInfo = {devices: []};

function showLogin(message = '') {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-error').textContent = message;
  $('#login-server').value = serverUrl;
  $('#login-token').value = token;
  (serverUrl ? $('#login-token') : $('#login-server')).focus();
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const link = parseServerLink($('#login-server').value);
  if (!link.server) {
    $('#login-error').textContent = t('needServer');
    return;
  }
  serverUrl = link.server;
  token = $('#login-token').value.trim() || link.token;
  store.set('server', serverUrl);
  store.set('token', token);
  await boot();
});

async function boot() {
  applyI18n();
  if (!serverUrl) {
    showLogin();
    return;
  }
  try {
    serverInfo = await api('info');
  } catch (err) {
    if (err.status !== 401) showLogin(err.message);
    return;
  }
  $('#login').hidden = true;
  $('#app').hidden = false;
  fillDevices();
  refreshUrlSuggestions();
  renderSavedFlows();
  if (!$('#steps').children.length) loadSteps(TEMPLATES.search);
  const wanted = new URLSearchParams(location.search).get('view');
  showView($('#view-' + wanted) ? wanted : store.get('view', 'live'));
}

function fillDevices() {
  const opts = () => serverInfo.devices.map(d => h('option', {value: d.id}, d.label));
  $$('.device-select').forEach(sel => {
    sel.replaceChildren(...opts());
    sel.value = 'iPhone 15 Pro';
  });
  $('#automate-device').value = 'desktop';
  const live = $('#live-device');
  live.replaceChildren(...opts());
  live.value = store.get('liveDevice', 'iPhone 15 Pro');
}

/* ------------------------------------------------------------------ */
/* Capture                                                             */
/* ------------------------------------------------------------------ */
let captureMode = 'screenshot';
function setCaptureMode(mode) {
  captureMode = mode;
  $$('#view-capture .segmented button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $$('#capture-form .shot-only').forEach(el => (el.hidden = mode !== 'screenshot'));
  $$('#capture-form .pdf-only').forEach(el => (el.hidden = mode !== 'pdf'));
}
$$('#view-capture .segmented button').forEach(b => b.addEventListener('click', () => setCaptureMode(b.dataset.mode)));

$('#capture-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = formData(e.target);
  data.delay = Number(data.delay || 0) * 1000;
  const out = $('#capture-result');
  await busy($('#capture-submit'), async () => {
    try {
      const res = await api(captureMode, {...commonOpts(), ...data}, {raw: true});
      const blob = await res.blob();
      const ext = captureMode === 'pdf' ? 'pdf' : {png: 'png', jpeg: 'jpg', webp: 'webp'}[data.format];
      const name = fileName(data.url, ext);
      const url = URL.createObjectURL(blob);
      addHistory(captureMode, data.url);
      out.hidden = false;
      out.replaceChildren(
        h(
          'div',
          {class: 'card'},
          captureMode === 'pdf'
            ? h('p', {}, `📄 ${name} · ${(blob.size / 1024).toFixed(0)} KB`)
            : h('img', {class: 'result-img', src: url, alt: 'Screenshot'}),
          h(
            'div',
            {class: 'result-actions'},
            h('button', {class: 'btn primary', onclick: () => downloadBlob(blob, name)}, '⬇ ' + t('download')),
            h('button', {class: 'btn ghost', onclick: () => shareBlob(blob, name)}, '↗ ' + t('share')),
            NATIVE ? null : h('a', {class: 'btn ghost', href: url, target: '_blank', rel: 'noopener'}, t('open')),
          ),
        ),
      );
      out.scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (err) {
      errorCard(out, err);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Extract                                                             */
/* ------------------------------------------------------------------ */
$$('#extract-presets input').forEach(r =>
  r.addEventListener('change', () => {
    $('#extract-form .custom-only').hidden = r.value !== 'custom' || !r.checked;
  }),
);

function toCSV(rows) {
  const esc = v => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(esc).join(',')).join('\n');
}

function extractRows(result) {
  if (result.items[0]?.tag === 'table') {
    return result.items.flatMap((tbl, i) => [[`# table ${i + 1}`], ...tbl.rows, []]);
  }
  const keys = [...new Set(result.items.flatMap(Object.keys))];
  return [keys, ...result.items.map(it => keys.map(k => it[k]))];
}

function renderExtract(result) {
  const out = $('#extract-result');
  const csv = toCSV(extractRows(result));
  const json = JSON.stringify(result.items, null, 2);
  let content;
  if (!result.items.length) {
    content = h('p', {class: 'hint'}, '0 ' + t('found'));
  } else if (result.items[0].tag === 'table') {
    content = h(
      'div',
      {style: 'display:flex;flex-direction:column;gap:12px'},
      result.items.slice(0, 10).map(tbl =>
        h('div', {class: 'table-wrap'},
          h('table', {}, tbl.rows.slice(0, 100).map(r => h('tr', {}, r.map(c => h('td', {}, c)))))),
      ),
    );
  } else if (result.attr === 'src') {
    content = h(
      'div',
      {class: 'thumbs'},
      result.items.slice(0, 200).map(it =>
        h('a', {href: it.src, target: '_blank', rel: 'noopener'},
          h('img', {src: it.src, alt: it.alt || '', loading: 'lazy', referrerpolicy: 'no-referrer'})),
      ),
    );
  } else {
    content = h(
      'ul',
      {class: 'list'},
      result.items.slice(0, 300).map(it => {
        const link = it.href;
        return h(
          'li',
          {},
          it.text || h('i', {}, '(empty)'),
          link ? h('a', {class: 'sub', href: link, target: '_blank', rel: 'noopener'}, link) : null,
          result.attr && !link && it[result.attr] ? h('span', {class: 'sub'}, it[result.attr]) : null,
          !result.attr && it.tag ? h('span', {class: 'sub'}, it.tag) : null,
        );
      }),
    );
  }
  out.hidden = false;
  out.replaceChildren(
    h(
      'div',
      {class: 'card'},
      h('div', {class: 'card-head'},
        h('h2', {}, `${result.count} ${t('found')}`),
        h('span', {class: 'badge'}, result.selector)),
      h('p', {class: 'hint', style: 'text-align:left'}, result.title),
      h(
        'div',
        {class: 'result-actions'},
        h('button', {class: 'btn ghost sm', onclick: () => downloadBlob(new Blob([csv], {type: 'text/csv'}), fileName(result.url, 'csv'))}, '⬇ CSV'),
        h('button', {class: 'btn ghost sm', onclick: () => downloadBlob(new Blob([json], {type: 'application/json'}), fileName(result.url, 'json'))}, '⬇ JSON'),
        h('button', {class: 'btn ghost sm', onclick: () => copyText(json)}, '⧉ ' + t('copy')),
      ),
      content,
    ),
  );
}

$('#extract-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = formData(e.target);
  const btn = e.target.querySelector('button[type=submit]');
  await busy(btn, async () => {
    try {
      const result = await api('scrape', {...commonOpts(), device: 'desktop', ...data});
      addHistory('extract', data.url);
      renderExtract(result);
    } catch (err) {
      errorCard($('#extract-result'), err);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Automate                                                            */
/* ------------------------------------------------------------------ */
const ACTIONS = {
  goto: {label: '🌐 Pumunta sa URL / Go to URL', value: 'https://example.com'},
  click: {label: '👆 Click', selector: 'button'},
  type: {label: '⌨️ Mag-type / Fill input', selector: 'input[name=q]', value: 'text'},
  press: {label: '⏎ Pindutin ang key / Press key', value: 'Enter'},
  hover: {label: '🖱️ Hover', selector: 'a'},
  select: {label: '☰ Pumili sa dropdown / Select', selector: 'select', value: ''},
  waitFor: {label: '👀 Hintayin ang element / Wait for element', selector: '.result'},
  waitForNavigation: {label: '↪ Hintayin ang bagong page / Wait for navigation'},
  wait: {label: '⏱️ Maghintay (ms) / Wait (ms)', value: '1000'},
  scroll: {label: '↕ Scroll (px o "bottom")', value: 'bottom'},
  screenshot: {label: '📸 Screenshot ("full" = buong page)', value: ''},
  extract: {label: '📥 Kunin ang text/attr / Extract', selector: 'h1', value: ''},
  evaluate: {label: '{ } JavaScript (return value)', value: 'return document.title;'},
};

const TEMPLATES = {
  search: [
    {action: 'goto', value: 'https://duckduckgo.com'},
    {action: 'type', selector: 'input[name=q]', value: 'puppeteer'},
    {action: 'press', value: 'Enter'},
    {action: 'waitFor', selector: '[data-testid=result]'},
    {action: 'extract', selector: '[data-testid=result-title-a]', value: ''},
    {action: 'screenshot', value: ''},
  ],
  login: [
    {action: 'goto', value: 'https://the-internet.herokuapp.com/login'},
    {action: 'type', selector: '#username', value: 'tomsmith'},
    {action: 'type', selector: '#password', value: 'SuperSecretPassword!'},
    {action: 'click', selector: 'button[type=submit]'},
    {action: 'waitFor', selector: '#flash'},
    {action: 'extract', selector: '#flash', value: ''},
    {action: 'screenshot', value: ''},
  ],
  scroll: [
    {action: 'goto', value: 'https://news.ycombinator.com'},
    {action: 'scroll', value: 'bottom'},
    {action: 'wait', value: '1000'},
    {action: 'screenshot', value: 'full'},
  ],
};

const ICON = {
  up: '<svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

function stepEl(step = {action: 'goto', value: ''}) {
  const li = h('li', {class: 'step'});
  const fields = h('div', {class: 'step-fields'});
  const select = h('select', {'aria-label': 'Action'},
    Object.entries(ACTIONS).map(([k, v]) => h('option', {value: k}, v.label)));
  select.value = step.action;
  const selector = h('input', {placeholder: 'CSS selector', autocapitalize: 'off', spellcheck: 'false', 'data-k': 'selector'});
  const value = h(step.action === 'evaluate' ? 'textarea' : 'input', {autocapitalize: 'off', spellcheck: 'false', 'data-k': 'value'});
  selector.value = step.selector ?? '';
  value.value = step.value ?? '';

  select.addEventListener('change', () => {
    const def = ACTIONS[select.value];
    // Swap input <-> textarea for JS.
    const wantTextarea = select.value === 'evaluate';
    let v = fields.querySelector('[data-k=value]');
    if (wantTextarea !== (v.tagName === 'TEXTAREA')) {
      const nv = h(wantTextarea ? 'textarea' : 'input', {autocapitalize: 'off', spellcheck: 'false', 'data-k': 'value'});
      v.replaceWith(nv);
      v = nv;
    }
    if (!v.value && def.value) v.value = def.value;
    if (!selector.value && def.selector) selector.value = def.selector;
  });
  fields.append(select, selector, value);
  const sync2 = () => {
    const def = ACTIONS[select.value];
    const v = fields.querySelector('[data-k=value]');
    selector.hidden = !('selector' in def);
    v.hidden = !('value' in def);
    v.placeholder = select.value === 'extract' ? 'attribute (optional): href, src…' : def.value || '';
  };
  select.addEventListener('change', sync2);
  sync2();

  const btns = h(
    'div',
    {class: 'step-btns'},
    h('button', {class: 'icon-btn', type: 'button', 'aria-label': 'Move up', html: ICON.up,
      onclick: () => li.previousElementSibling?.before(li)}),
    h('button', {class: 'icon-btn', type: 'button', 'aria-label': 'Move down', html: ICON.down,
      onclick: () => li.nextElementSibling?.after(li)}),
    h('button', {class: 'icon-btn', type: 'button', 'aria-label': 'Delete', html: ICON.del,
      onclick: () => li.remove()}),
  );
  li.append(fields, btns);
  return li;
}

function readSteps() {
  return $$('#steps .step').map(li => {
    const action = li.querySelector('select').value;
    const def = ACTIONS[action];
    const out = {action};
    if ('selector' in def) out.selector = li.querySelector('[data-k=selector]').value.trim();
    if ('value' in def) out.value = li.querySelector('[data-k=value]').value;
    return out;
  });
}

function loadSteps(steps) {
  $('#steps').replaceChildren(...steps.map(s => stepEl(s)));
}

$('#add-step').addEventListener('click', () => {
  const li = stepEl({action: 'click', selector: ''});
  $('#steps').append(li);
  li.querySelector('select').focus();
});

$('#automate-template').addEventListener('change', e => {
  if (TEMPLATES[e.target.value]) loadSteps(TEMPLATES[e.target.value]);
  e.target.value = '';
});

function renderSavedFlows() {
  const flows = store.get('flows', {});
  $('#saved-flows').replaceChildren(
    ...Object.keys(flows).map(name =>
      h('span', {class: 'chip'},
        h('button', {class: 'chip', style: 'border:0;padding:0;min-height:0', onclick: () => loadSteps(flows[name])}, '📁 ' + name),
        h('button', {
          class: 'chip', style: 'border:0;padding:0 0 0 6px;min-height:0;color:var(--muted)', 'aria-label': 'Delete ' + name,
          onclick: () => {
            delete flows[name];
            store.set('flows', flows);
            renderSavedFlows();
            toast(t('deleted'));
          },
        }, '✕'),
      ),
    ),
  );
}

$('#automate-save').addEventListener('click', () => {
  const name = prompt(t('flowName'));
  if (!name) return;
  const flows = store.get('flows', {});
  flows[name.trim()] = readSteps();
  store.set('flows', flows);
  renderSavedFlows();
  toast(t('saved'));
});

$('#automate-run').addEventListener('click', async e => {
  const out = $('#automate-result');
  const steps = readSteps();
  await busy(e.currentTarget, async () => {
    try {
      const r = await api('automate', {
        ...commonOpts(),
        device: $('#automate-device').value,
        continueOnError: $('#automate-continue').checked,
        steps,
      });
      const firstGoto = steps.find(s => s.action === 'goto');
      if (firstGoto) addHistory('automate', firstGoto.value);
      out.hidden = false;
      out.replaceChildren(
        h(
          'div',
          {class: 'card'},
          h('h2', {}, r.title || r.finalUrl),
          h('p', {class: 'hint', style: 'text-align:left;word-break:break-all'}, r.finalUrl),
          h('ul', {class: 'list'},
            r.log.map(l => h('li', {class: 'log-item'},
              h('span', {class: 'badge ' + (l.ok ? 'ok' : 'bad')}, l.ok ? '✓' : '✗'),
              h('span', {}, `${l.step}. ${l.action}`, l.detail ? h('span', {class: 'sub'}, l.detail) : null,
                l.error ? h('span', {class: 'sub', style: 'color:var(--danger)'}, l.error) : null),
              h('span', {class: 'sub', style: 'margin-left:auto'}, l.ms + 'ms')))),
        ),
        ...r.screenshots.map(s => {
          const blob = b64toBlob(s.data, 'image/jpeg');
          const name = `step-${s.step}.jpg`;
          return h('div', {class: 'card'},
            h('span', {class: 'badge'}, `📸 step ${s.step}`),
            h('img', {class: 'result-img', src: URL.createObjectURL(blob), alt: name}),
            h('div', {class: 'result-actions'},
              h('button', {class: 'btn ghost sm', onclick: () => downloadBlob(blob, name)}, '⬇ ' + t('download')),
              h('button', {class: 'btn ghost sm', onclick: () => shareBlob(blob, name)}, '↗ ' + t('share'))));
        }),
        r.data.length
          ? h('div', {class: 'card'},
              h('div', {class: 'card-head'}, h('h2', {}, 'Data'),
                h('button', {class: 'btn ghost sm', onclick: () => copyText(JSON.stringify(r.data, null, 2))}, '⧉ ' + t('copy'))),
              h('pre', {}, JSON.stringify(r.data, null, 2)))
          : null,
      );
      out.scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (err) {
      errorCard(out, err);
    }
  });
});

function b64toBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], {type});
}

/* ------------------------------------------------------------------ */
/* Inspect                                                             */
/* ------------------------------------------------------------------ */
const fmtBytes = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB');

$('#inspect-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = formData(e.target);
  const out = $('#inspect-result');
  await busy(e.target.querySelector('button[type=submit]'), async () => {
    try {
      const r = await api('inspect', {...commonOpts(), ...data});
      addHistory('inspect', data.url);
      const statusOk = r.status && r.status < 400;
      const errors = r.console.filter(c => c.type === 'error' || c.type === 'pageerror');
      out.hidden = false;
      out.replaceChildren(
        h('div', {class: 'card'},
          h('div', {class: 'card-head'}, h('h2', {}, r.title || '(no title)'),
            h('span', {class: 'badge ' + (statusOk ? 'ok' : 'bad')}, 'HTTP ' + (r.status ?? '?'))),
          h('p', {class: 'hint', style: 'text-align:left;word-break:break-all'}, r.url),
          h('div', {class: 'stats'},
            stat((r.loadMs / 1000).toFixed(2) + 's', 'Load time'),
            stat(r.paints?.['first-contentful-paint'] != null ? r.paints['first-contentful-paint'] + 'ms' : '—', 'First paint'),
            stat(r.requests.count, 'Requests'),
            stat(fmtBytes(r.requests.totalBytes), 'Size (approx.)'),
            stat(r.domNodes, 'DOM nodes'),
            stat(r.metrics.jsHeapUsedMB + ' MB', 'JS memory'),
            stat(errors.length, 'Console errors'),
            stat(r.requests.failed.length, 'Failed requests'))),
        h('div', {class: 'card'},
          h('h2', {}, 'SEO & Accessibility'),
          h('dl', {class: 'kv'},
            kv('Description', r.description || '⚠️ missing'),
            kv('H1', r.h1.join(' | ') || '⚠️ missing'),
            kv('Language', r.lang || '⚠️ missing'),
            kv('Viewport', r.viewportMeta || '⚠️ missing (not mobile-friendly)'),
            kv('Canonical', r.canonical || '—'),
            kv('OG title', r.ogTitle || '—'),
            kv('Links', r.links),
            kv('Images', `${r.images} (${r.imagesWithoutAlt} without alt)`),
            kv('Scripts', r.scripts))),
        h('div', {class: 'card'},
          h('h2', {}, 'Security'),
          h('dl', {class: 'kv'},
            kv('HTTPS', r.securityState ? `✅ ${r.securityState.protocol}` : '⚠️ no'),
            r.securityState ? kv('Issuer', r.securityState.issuer) : null,
            r.securityState ? kv('Cert valid to', r.securityState.validTo.slice(0, 10)) : null,
            kv('HSTS', r.headers['strict-transport-security'] ? '✅' : '—'),
            kv('CSP', r.headers['content-security-policy'] ? '✅' : '—'),
            kv('Server', r.headers.server || '—'),
            kv('Cookies', r.cookies.length))),
        h('div', {class: 'card'},
          h('h2', {}, 'Requests by type'),
          h('dl', {class: 'kv'}, Object.entries(r.requests.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => kv(k, v))),
          r.requests.failed.length
            ? h('details', {}, h('summary', {}, `Failed (${r.requests.failed.length})`),
                h('ul', {class: 'list'}, r.requests.failed.map(f => h('li', {}, f.url, h('span', {class: 'sub'}, f.error)))))
            : null),
        r.console.length
          ? h('div', {class: 'card'},
              h('h2', {}, `Console (${r.console.length})`),
              h('ul', {class: 'list'}, r.console.slice(0, 100).map(c =>
                h('li', {}, h('span', {class: 'badge ' + (c.type.includes('error') ? 'bad' : '')}, c.type), ' ', c.text))))
          : null,
        h('button', {class: 'btn ghost block', onclick: () => downloadBlob(new Blob([JSON.stringify(r, null, 2)], {type: 'application/json'}), fileName(r.url, 'json'))}, '⬇ JSON report'),
      );
      out.scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (err) {
      errorCard(out, err);
    }
  });
});
const stat = (value, label) => h('div', {class: 'stat'}, h('b', {}, value), h('span', {}, label));
const kv = (k, v) => [h('dt', {}, k), h('dd', {}, String(v))];

/* ------------------------------------------------------------------ */
/* Live browser                                                        */
/* ------------------------------------------------------------------ */
let ws = null;
let liveViewport = null;
const screen = $('#live-screen');

function liveSend(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function setLiveUI(active) {
  $('#live-empty').hidden = active;
  screen.hidden = !active;
  $('#live-toolbar').hidden = !active;
  $('#live-hint').hidden = !active;
  if (!active) {
    $('#live-type-form').hidden = true;
    $('#live-loading').hidden = true;
  }
}

function liveConnect(url) {
  if (ws && ws.readyState <= 1) {
    if (url) liveSend({type: 'navigate', url});
    return;
  }
  ws = new WebSocket(`${apiBase().replace(/^http/, 'ws')}/live?token=${encodeURIComponent(token)}`);
  $('#live-loading').hidden = false;
  $('#live-empty').hidden = true;
  ws.onopen = () => liveSend({type: 'start', url, device: $('#live-device').value});
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'ready':
        liveViewport = msg.viewport;
        setLiveUI(true);
        break;
      case 'frame':
        screen.src = 'data:image/jpeg;base64,' + msg.data;
        $('#live-loading').hidden = true;
        break;
      case 'state':
        if (document.activeElement !== $('#live-url')) $('#live-url').value = msg.url === 'about:blank' ? '' : msg.url;
        if (msg.url && msg.url !== 'about:blank') document.title = (msg.title || msg.url) + ' · Puppeteer';
        break;
      case 'screenshot': {
        const blob = b64toBlob(msg.data, 'image/png');
        const name = fileName($('#live-url').value, 'png');
        openSheet('📸 Screenshot', h('div', {class: 'result'},
          h('img', {class: 'result-img', src: URL.createObjectURL(blob), alt: 'Screenshot'}),
          h('div', {class: 'result-actions'},
            h('button', {class: 'btn primary', onclick: () => downloadBlob(blob, name)}, '⬇ ' + t('download')),
            h('button', {class: 'btn ghost', onclick: () => shareBlob(blob, name)}, '↗ ' + t('share')))));
        break;
      }
      case 'pdf': {
        const blob = b64toBlob(msg.data, 'application/pdf');
        const name = fileName($('#live-url').value, 'pdf');
        openSheet('📄 PDF', h('div', {class: 'result'},
          h('p', {}, `${msg.title || name} · ${(blob.size / 1024).toFixed(0)} KB`),
          h('div', {class: 'result-actions'},
            h('button', {class: 'btn primary', onclick: () => downloadBlob(blob, name)}, '⬇ ' + t('download')),
            h('button', {class: 'btn ghost', onclick: () => shareBlob(blob, name)}, '↗ ' + t('share')))));
        break;
      }
      case 'evalResult':
        openSheet('{ } Result', h('pre', {}, JSON.stringify(msg.result, null, 2)));
        break;
      case 'toast':
        toast(msg.message, msg.level);
        break;
      case 'error':
        toast(msg.message, 'error', 5000);
        break;
    }
  };
  ws.onclose = ev => {
    if (ev.code !== 1000 && !$('#live-toolbar').hidden) toast(t('connLost'), 'error');
    ws = null;
    setLiveUI(false);
    document.title = 'Puppeteer Mobile';
  };
}

function liveGo() {
  const url = $('#live-url').value.trim();
  if (!url) {
    $('#live-url').focus();
    return;
  }
  addHistory('live', url);
  $('#live-url').blur();
  liveConnect(url);
}

$('#live-form').addEventListener('submit', e => {
  e.preventDefault();
  liveGo();
});
$('#live-start').addEventListener('click', () => {
  if ($('#live-url').value.trim()) liveGo();
  else liveConnect('');
});
$('#live-back').addEventListener('click', () => liveSend({type: 'back'}));
$('#live-forward').addEventListener('click', () => liveSend({type: 'forward'}));
$('#live-reload').addEventListener('click', () => liveSend({type: 'reload'}));
$('#live-stop').addEventListener('click', () => ws?.close(1000));
$('#live-enter').addEventListener('click', () => liveSend({type: 'key', key: 'Enter'}));
$('#live-tab').addEventListener('click', () => liveSend({type: 'key', key: 'Tab'}));
$('#live-shot').addEventListener('click', () => liveSend({type: 'screenshot', fullPage: false}));
$('#live-pdf').addEventListener('click', () => {
  toast(t('working'));
  liveSend({type: 'pdf'});
});
$('#live-device').addEventListener('change', e => {
  store.set('liveDevice', e.target.value);
  liveSend({type: 'device', device: e.target.value});
});
$('#live-keyboard').addEventListener('click', () => {
  const form = $('#live-type-form');
  form.hidden = !form.hidden;
  if (!form.hidden) $('#live-type-input').focus();
});
$('#live-js').addEventListener('click', () => {
  const ta = h('textarea', {}, 'return document.title;');
  openSheet('{ } JavaScript', h('div', {class: 'settings'},
    h('p', {class: 'hint', style: 'text-align:left'}, t('jsPrompt')), ta,
    h('button', {class: 'btn primary block', onclick: () => liveSend({type: 'evaluate', code: ta.value})}, '▶ ' + t('run'))));
});
$('#live-type-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#live-type-input');
  if (input.value) liveSend({type: 'type', text: input.value});
  input.value = '';
});
// Forward Backspace from the helper input when it's empty.
$('#live-type-input').addEventListener('keydown', e => {
  if (e.key === 'Backspace' && !e.target.value) liveSend({type: 'key', key: 'Backspace'});
});

// Taps and swipes on the screen image.
{
  let start = null;
  let last = null;
  let moved = false;
  const rel = e => {
    const r = screen.getBoundingClientRect();
    return {x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r};
  };
  screen.addEventListener('pointerdown', e => {
    screen.setPointerCapture(e.pointerId);
    start = last = {cx: e.clientX, cy: e.clientY, ...rel(e)};
    moved = false;
  });
  screen.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - last.cx;
    const dy = e.clientY - last.cy;
    if (Math.abs(e.clientX - start.cx) + Math.abs(e.clientY - start.cy) > 10) moved = true;
    if (moved && (Math.abs(dy) > 16 || Math.abs(dx) > 16)) {
      const scale = (liveViewport?.height || 800) / start.r.height;
      liveSend({type: 'scroll', x: start.x, y: start.y, dx: -dx * scale, dy: -dy * scale});
      last = {...last, cx: e.clientX, cy: e.clientY};
    }
  });
  screen.addEventListener('pointerup', e => {
    if (start && !moved) {
      const p = rel(e);
      liveSend({type: 'tap', x: p.x, y: p.y});
    }
    start = null;
  });
  screen.addEventListener('pointercancel', () => (start = null));
  // Mouse wheel on desktop.
  screen.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const p = rel(e);
      liveSend({type: 'scroll', x: p.x, y: p.y, dx: e.deltaX, dy: e.deltaY});
    },
    {passive: false},
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
$('#btn-history').addEventListener('click', openHistory);
$('#btn-settings').addEventListener('click', () => {
  const node = $('#tpl-settings').content.cloneNode(true);
  const wrap = h('div', {}, node);
  applyI18n(wrap);
  $('#set-lang', wrap).value = lang;
  $('#set-theme', wrap).value = settings.theme;
  $('#set-timeout', wrap).value = settings.timeout;
  $('#set-wait', wrap).value = settings.waitUntil;
  $('#set-info', wrap).textContent = `Server: ${serverUrl} · Engine: ${serverInfo.puppeteer || '?'} · Jobs: ${serverInfo.jobs?.running ?? 0}/${serverInfo.jobs?.maxJobs ?? '?'}`;
  const save = () => store.set('settings', settings);
  $('#set-lang', wrap).addEventListener('change', e => {
    lang = e.target.value;
    store.set('lang', lang);
    applyI18n();
    applyI18n(wrap);
  });
  $('#set-theme', wrap).addEventListener('change', e => {
    settings.theme = e.target.value;
    save();
    applyTheme();
  });
  $('#set-timeout', wrap).addEventListener('change', e => {
    settings.timeout = Math.max(5, Math.min(120, Number(e.target.value) || 30));
    save();
  });
  $('#set-wait', wrap).addEventListener('change', e => {
    settings.waitUntil = e.target.value;
    save();
  });
  $('#set-clear', wrap).addEventListener('click', () => {
    if (!confirm(t('confirmClear'))) return;
    store.del('history');
    store.del('flows');
    renderSavedFlows();
    refreshUrlSuggestions();
    toast(t('deleted'));
  });
  $('#set-logout', wrap).addEventListener('click', () => {
    store.del('token');
    token = '';
    ws?.close(1000);
    closeSheet();
    showLogin();
  });
  openSheet(t('settings'), wrap);
});

/* ------------------------------------------------------------------ */
/* PWA                                                                 */
/* ------------------------------------------------------------------ */
if ('serviceWorker' in navigator && !NATIVE) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Android share-target / deep links: /?url=https://...
{
  const shared = new URLSearchParams(location.search).get('url') || new URLSearchParams(location.search).get('text');
  if (shared) {
    const m = shared.match(/https?:\/\/\S+/);
    if (m) $('#live-url').value = m[0];
  }
}

boot();
