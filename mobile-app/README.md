# 📱 Puppeteer Mobile

Isang **mobile app (PWA)** para kontrolin ang Puppeteer mula sa phone mo —
walang code na kailangang isulat. Naka-install ito sa home screen na parang
totoong app, at may **Filipino / English** na wika at **dark mode**.

> A phone-friendly, installable app for everything Puppeteer can do:
> live browsing, screenshots, PDFs, data extraction, automation and page audits.

## ✨ Mga Kakayahan

| Tab | Ano ang ginagawa |
| --- | --- |
| 🌐 **Live** | Totoong Chrome na nakikita mo nang live. Tap = click, swipe = scroll, may keyboard, Back/Forward/Reload, palit ng device (iPhone, Pixel, iPad, Desktop), screenshot, at pag-run ng JavaScript sa page. |
| 📸 **Capture** | Screenshot (PNG/JPG/WEBP, full page, isang element lang, dark mode, itago ang cookie banner/ads) o **PDF** (A4/Letter/Legal/A3/A5, landscape, margin). I-download o i-share agad. |
| 📥 **Extract** | Kunin ang links, images, headings, text, tables, o kahit anong CSS selector. I-export bilang **CSV** o **JSON**, o kopyahin. |
| ⚡ **Automate** | Gumawa ng sunud-sunod na hakbang (go to, click, type, press key, hover, select, wait, scroll, screenshot, extract, JavaScript). May templates at puwedeng i-save ang flows. |
| 🔍 **Inspect** | Load time, first paint, requests, laki ng page, DOM nodes, JS memory, console errors, failed requests, SEO (description, H1, lang, viewport), security (HTTPS, cert, HSTS, CSP), cookies. May JSON report. |

Iba pa: history ng mga URL, URL suggestions, Android "Share to" (i-share ang link mula sa ibang app), offline app shell, access token para protektado ang server.

## 🚀 Paano Patakbuhin

Kailangan: **Node.js 22.12+** sa computer o server.

```bash
cd mobile-app
npm install          # dina-download din nito ang Chrome
npm start
```

Lalabas sa terminal ang ganito:

```
  📱 Puppeteer Mobile is running
  This computer:  http://localhost:3000/?token=AbC123...
  On your phone:  http://192.168.1.5:3000/?token=AbC123...
```

1. Siguraduhing **parehong Wi-Fi** ang phone at computer.
2. Buksan sa phone ang link na **"On your phone"**.
3. I-install bilang app:
   - **Android (Chrome):** ⋮ menu → *Add to Home screen* / *Install app*
   - **iPhone (Safari):** Share ⬆ → *Add to Home Screen*

### Gamitin ang Puppeteer code mula sa repo na ito

Kapag na-build mo ang monorepo (`npm install && npm run build` sa root),
awtomatikong gagamitin ng app ang **local build** sa `packages/puppeteer`.
Kung wala pa, ang npm package na `puppeteer` ang gagamitin. Makikita kung alin
sa terminal at sa ⚙️ Settings ng app.

## ⚙️ Settings (environment variables)

| Variable | Default | Paliwanag |
| --- | --- | --- |
| `PORT` | `3000` | Port ng server |
| `HOST` | `0.0.0.0` | `127.0.0.1` kung sa computer lang |
| `APP_TOKEN` | random | Access token. Itakda para hindi magbago tuwing restart. `off` = walang token (huwag gawin sa public internet) |
| `MAX_JOBS` | `3` | Ilang sabay na task |
| `MAX_LIVE_SESSIONS` | `3` | Ilang sabay na Live browser |
| `LIVE_IDLE_MS` | `600000` | Isasara ang Live kapag 10 min walang galaw |
| `PUPPETEER_EXECUTABLE_PATH` | — | Sariling Chrome/Chromium |
| `USE_NPM_PUPPETEER` | — | `1` = laging gamitin ang npm package |

Halimbawa: `APP_TOKEN=akingSikreto PORT=8080 npm start`

## ☁️ Para magamit kahit saan (hindi lang sa bahay)

I-deploy gamit ang Docker sa kahit anong VPS / Render / Railway / Fly.io:

```bash
cd mobile-app
docker build -t puppeteer-mobile .
docker run -p 3000:3000 -e APP_TOKEN=akingSikreto puppeteer-mobile
```

Gumamit ng **HTTPS** (hal. sa likod ng Caddy/Nginx o ng hosting provider) kapag
nasa public internet — kailangan din ito para ma-install ang PWA sa labas ng
local network.

## 🔒 Seguridad

- Lahat ng `/api` at Live connection ay nangangailangan ng token.
- `http://` at `https://` lang ang puwedeng buksan (bawal ang `file://`, atbp.).
- Ang JavaScript na isinusulat mo sa app ay tumatakbo **sa loob ng browser page**, hindi sa server.
- Bawat task ay sariling incognito context na binubura pagkatapos.

## 🗂️ Istruktura

```
mobile-app/
├── server.js          # Express + WebSocket server
├── src/
│   ├── browser.js     # Pag-load ng Puppeteer, shared browser, devices, job limit
│   ├── actions.js     # Screenshot, PDF, scrape, inspect, automate
│   └── live.js        # Live screencast + tap/scroll/type
└── public/            # Ang mobile app (HTML/CSS/JS, PWA manifest, service worker)
```
