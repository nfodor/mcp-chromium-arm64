#!/usr/bin/env node
/**
 * Self-contained smoke test for the Chromium ARM64 MCP server.
 *
 * Spins up a local HTTP server (no external network), drives `node index.js`
 * over stdio, and asserts the real behaviour of the features:
 *   - navigate + get_content
 *   - full-page screenshot captures below-the-fold content
 *   - CHROMIUM_MAX_SCREENSHOT_HEIGHT cap + warning
 *   - set_cookies (JSON array) and cookieHeader are actually sent
 *   - get_cookies round-trips
 *   - CHROMIUM_USER_DATA_DIR persists a cookie across a full restart
 *
 * Skips cleanly (exit 0) if no Chromium-family browser is installed.
 * Run: npm test
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// PNG dimensions straight from the IHDR chunk (no image deps).
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// Local fixture server: a tall page and a cookie-echo endpoint.
function startFixtureServer() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/cookies')) {
      const jar = {};
      (req.headers.cookie || '').split(';').forEach((p) => {
        const i = p.indexOf('=');
        if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
      });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ cookies: jar }));
    } else {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><body style="margin:0;font:40px sans-serif;color:#fff">' +
        '<div style="height:700px;background:#c0392b">TOP</div>' +
        '<div style="height:1000px;background:#2980b9">MIDDLE</div>' +
        '<div id="b" style="height:700px;background:#27ae60">BOTTOM_MARKER</div>' +
        '</body>'
      );
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// One MCP server process driven over stdio, responses correlated by id.
function openSession(env = {}) {
  const child = spawn('node', ['index.js'], { cwd: SERVER_DIR, env: { ...process.env, ...env } });
  const pending = new Map();
  let id = 0;
  const onLine = (line) => {
    line = line.trim();
    if (!line.startsWith('{')) return;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch { /* non-JSON log line */ }
  };
  let buf = '';
  const feed = (d) => { buf += d; const parts = buf.split('\n'); buf = parts.pop(); parts.forEach(onLine); };
  child.stdout.on('data', feed);
  child.stderr.on('data', feed);

  const call = (name, args = {}, timeoutMs = 15000) => new Promise((resolve, reject) => {
    const myId = ++id;
    const t = setTimeout(() => { pending.delete(myId); reject(new Error(`timeout: ${name}`)); }, timeoutMs);
    pending.set(myId, (msg) => { clearTimeout(t); resolve(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args }, id: myId }) + '\n');
  });
  const text = (msg) => msg?.result?.content?.[0]?.text ?? '';
  const close = async () => { try { await call('close_browser', {}, 8000); } catch {} child.kill(); };
  return { call, text, close };
}

async function main() {
  const fixture = await startFixtureServer();
  const base = `http://127.0.0.1:${fixture.address().port}`;
  const tmpShot = path.join(os.tmpdir(), `smoke_full_${process.pid}.png`);
  const tmpCap = path.join(os.tmpdir(), `smoke_cap_${process.pid}.png`);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke_profile_'));

  console.log('\nChromium ARM64 MCP — smoke test');
  console.log(`fixture: ${base}\n`);

  // ---- Session 1: cookies + full-page (ephemeral profile) ----
  const s1 = openSession();
  try {
    // Browser availability probe (skip if none installed).
    const nav0 = s1.text(await s1.call('navigate', { url: base }));
    if (/Could not find a Chromium-family browser/i.test(nav0)) {
      console.log('SKIP: no Chromium-family browser installed.');
      await s1.close(); fixture.close(); process.exit(0);
    }

    console.log('cookies:');
    const set = s1.text(await s1.call('set_cookies', {
      url: base,
      cookies: [{ name: 'json_ck', value: 'J1', domain: '127.0.0.1', path: '/' }],
      cookieHeader: 'hdr_ck=H1; hdr_eq=a=b',
    }));
    check('set_cookies reports 3 cookies (2 header + 1 json)', /Set 3 cookie/.test(set), set);

    await s1.call('navigate', { url: `${base}/cookies` });
    await sleep(1200);
    let echoed = {};
    try { echoed = JSON.parse(s1.text(await s1.call('get_content', { type: 'text' }))).cookies; } catch {}
    check('json cookie sent to server', echoed.json_ck === 'J1', JSON.stringify(echoed));
    check('cookieHeader cookie sent to server', echoed.hdr_ck === 'H1', JSON.stringify(echoed));
    check('cookieHeader value with "=" preserved', echoed.hdr_eq === 'a=b', JSON.stringify(echoed));

    const exported = JSON.parse(s1.text(await s1.call('get_cookies', {})));
    check('get_cookies round-trips json_ck', exported.some((c) => c.name === 'json_ck' && c.value === 'J1'));

    console.log('full-page screenshot:');
    await s1.call('navigate', { url: base });
    await sleep(1000);
    s1.text(await s1.call('screenshot', { name: path.basename(tmpShot), fullPage: true }));
    // server writes to /tmp/<name>
    const shotPath = path.join('/tmp', path.basename(tmpShot));
    const size = fs.existsSync(shotPath) ? pngSize(shotPath) : { w: 0, h: 0 };
    check('full-page height captures below the fold (>1500px)', size.h > 1500, `${size.w}x${size.h}`);
  } finally {
    await s1.close();
  }

  // ---- Session 2: height cap + warning ----
  console.log('height cap:');
  const s2 = openSession({ CHROMIUM_MAX_SCREENSHOT_HEIGHT: '1000' });
  try {
    await s2.call('navigate', { url: base });
    await sleep(1000);
    const capMsg = s2.text(await s2.call('screenshot', { name: path.basename(tmpCap), fullPage: true }));
    const capPath = path.join('/tmp', path.basename(tmpCap));
    const capSize = fs.existsSync(capPath) ? pngSize(capPath) : { w: 0, h: 0 };
    check('capped image height == 1000', capSize.h === 1000, `${capSize.w}x${capSize.h}`);
    check('cap warning present in response', /warning: page is \d+px tall/.test(capMsg), capMsg);
  } finally {
    await s2.close();
  }

  // ---- Sessions 3a/3b: persistence across restart ----
  console.log('persistent profile:');
  const s3a = openSession({ CHROMIUM_USER_DATA_DIR: profileDir });
  try {
    await s3a.call('set_cookies', {
      url: base,
      cookies: [{ name: 'persist_ck', value: 'SURVIVES', domain: '127.0.0.1', path: '/', expirationDate: 4102444800 }],
    });
  } finally {
    await s3a.close();
  }
  await sleep(800);
  const s3b = openSession({ CHROMIUM_USER_DATA_DIR: profileDir });
  try {
    await s3b.call('navigate', { url: `${base}/cookies` });
    await sleep(1200);
    let after = {};
    try { after = JSON.parse(s3b.text(await s3b.call('get_content', { type: 'text' }))).cookies; } catch {}
    check('cookie survives a full browser restart', after.persist_ck === 'SURVIVES', JSON.stringify(after));
  } finally {
    await s3b.close();
  }

  fixture.close();
  fs.rmSync(profileDir, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('smoke test crashed:', e); process.exit(1); });
