#!/usr/bin/env node
/**
 * Self-contained smoke test for the Chromium ARM64 MCP server.
 *
 * Spins up a local HTTP fixture server (no external network), drives
 * `node index.js` over stdio, and asserts the real behaviour of the tools:
 *   navigate, get_content (text+html), evaluate, fill, click, select, hover,
 *   screenshot (full-page + height cap), set_cookies (+cookieHeader),
 *   get_cookies, get_console_logs/errors, get_network_logs/errors, wipe_logs,
 *   emulate_device, reset_emulation, run_*_audit, screencast start/status(/stop),
 *   get_selected_element, and CHROMIUM_USER_DATA_DIR persistence across restart.
 *
 * Skips cleanly (exit 0) if no Chromium-family browser is installed.
 * Run: npm test
 */
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasFfmpeg = (() => { try { execFileSync('which', ['ffmpeg'], { stdio: 'ignore' }); return true; } catch { return false; } })();

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`); }
}

// PNG dimensions straight from the IHDR chunk (no image deps).
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// Local fixture: tall page, cookie echo, an interactive page, and 200/404 routes.
function startFixtureServer() {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/cookies') {
      const jar = {};
      (req.headers.cookie || '').split(';').forEach((p) => {
        const i = p.indexOf('='); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
      });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ cookies: jar }));
    } else if (url === '/data') {
      res.setHeader('content-type', 'application/json'); res.end('{"ok":true}');
    } else if (url === '/missing') {
      res.statusCode = 404; res.end('nope');
    } else if (url === '/app') {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><html><head></head><body>' +
        '<button id="btn" onclick="document.title=\'CLICKED\'">Go</button>' +
        '<input id="in">' +
        '<select id="sel"><option value="a">A</option><option value="b">B</option></select>' +
        '<div id="hov" onmouseover="window.__hov=1">hover</div>' +
        '<img id="noalt" src="/data">' +
        '<script>console.log("hello-log");console.error("boom-error");' +
        'fetch("/data").catch(()=>{});fetch("/missing").catch(()=>{});</script>' +
        '</body></html>'
      );
    } else {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><body style="margin:0;font:40px sans-serif;color:#fff">' +
        '<div style="height:700px;background:#c0392b">TOP</div>' +
        '<div style="height:1000px;background:#2980b9">MIDDLE</div>' +
        '<div id="b" style="height:700px;background:#27ae60">BOTTOM_MARKER</div></body>'
      );
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// One MCP server process over stdio, responses correlated by id.
function openSession(env = {}) {
  const child = spawn('node', ['index.js'], { cwd: SERVER_DIR, env: { ...process.env, ...env } });
  const pending = new Map();
  let id = 0, buf = '';
  const onLine = (line) => {
    line = line.trim(); if (!line.startsWith('{')) return;
    try { const m = JSON.parse(line); if (m.id != null && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch {}
  };
  const feed = (d) => { buf += d; const parts = buf.split('\n'); buf = parts.pop(); parts.forEach(onLine); };
  child.stdout.on('data', feed); child.stderr.on('data', feed);
  const call = (name, args = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
    const myId = ++id;
    const t = setTimeout(() => { pending.delete(myId); reject(new Error(`timeout: ${name}`)); }, timeoutMs);
    pending.set(myId, (m) => { clearTimeout(t); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args }, id: myId }) + '\n');
  });
  const text = (m) => m?.result?.content?.[0]?.text ?? '';
  const evalText = async (expr) => text(await call('evaluate', { script: expr }));
  const close = async () => { try { await call('close_browser', {}, 8000); } catch {} child.kill(); };
  return { call, text, evalText, close };
}

// Capture the exact args our server launches Chrome with, via a stub "browser"
// (needs no real Chromium) — proves managed profile, disk-cache cap, headful/persistent.
const STUB = path.join(os.tmpdir(), `smoke_stub_${process.pid}.sh`);
fs.writeFileSync(STUB, '#!/bin/sh\nprintf "%s\\n" "$@" > "$FAKE_ARGS_FILE"\nsleep 5\n');
fs.chmodSync(STUB, 0o755);
let argRun = 0;
async function capturedArgs(env = {}) {
  const argsFile = path.join(os.tmpdir(), `smoke_args_${process.pid}_${++argRun}.txt`);
  try { fs.unlinkSync(argsFile); } catch {}
  const child = spawn('node', ['index.js'], { cwd: SERVER_DIR, env: { ...process.env, ...env, CHROMIUM_PATH: STUB, FAKE_ARGS_FILE: argsFile } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'navigate', arguments: { url: 'http://127.0.0.1:1/' } }, id: 1 }) + '\n');
  await sleep(3000);
  child.kill();
  let out = ''; try { out = fs.readFileSync(argsFile, 'utf8'); } catch {}
  try { fs.unlinkSync(argsFile); } catch {}
  return out.split('\n').filter(Boolean);
}
const profileCount = () => { try { return fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('mcp-chromium-profile-')).length; } catch { return 0; } };

async function main() {
  const fixture = await startFixtureServer();
  const base = `http://127.0.0.1:${fixture.address().port}`;
  const tmpShot = `smoke_full_${process.pid}.png`;
  const tmpCap = `smoke_cap_${process.pid}.png`;
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke_profile_'));

  console.log(`\nChromium ARM64 MCP — smoke test\nfixture: ${base}  (ffmpeg: ${hasFfmpeg})\n`);

  console.log('launch args (stub browser, no real Chrome needed):');
  const dflt = await capturedArgs({});
  check('ephemeral uses a managed --user-data-dir', dflt.some((a) => a.startsWith('--user-data-dir=') && a.includes('mcp-chromium-profile-')), dflt.join(' '));
  check('disk-cache cap applied', dflt.some((a) => /^--disk-cache-size=\d+$/.test(a)), dflt.join(' '));
  check('default launch is headless', dflt.includes('--headless'));
  const persist = await capturedArgs({ CHROMIUM_USER_DATA_DIR: '/tmp/smoke_persist_xyz' });
  check('persistent dir used verbatim (not managed)', persist.includes('--user-data-dir=/tmp/smoke_persist_xyz'), persist.join(' '));
  const headful = await capturedArgs({ CHROMIUM_HEADLESS: 'false' });
  check('CHROMIUM_HEADLESS=false drops --headless', !headful.includes('--headless'));

  const s1 = openSession();
  try {
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
    check('set_cookies reports 3 cookies', /Set 3 cookie/.test(set), set);
    await s1.call('navigate', { url: `${base}/cookies` }); await sleep(1000);
    let echoed = {}; try { echoed = JSON.parse(s1.text(await s1.call('get_content', { type: 'text' }))).cookies; } catch {}
    check('json cookie transmitted', echoed.json_ck === 'J1', JSON.stringify(echoed));
    check('cookieHeader cookie transmitted', echoed.hdr_ck === 'H1', JSON.stringify(echoed));
    check('cookieHeader value with "=" preserved', echoed.hdr_eq === 'a=b', JSON.stringify(echoed));
    const exported = JSON.parse(s1.text(await s1.call('get_cookies', {})));
    check('get_cookies round-trips json_ck', exported.some((c) => c.name === 'json_ck' && c.value === 'J1'));

    console.log('full-page screenshot:');
    await s1.call('navigate', { url: base }); await sleep(900);
    s1.text(await s1.call('screenshot', { name: tmpShot, fullPage: true }));
    const shotPath = path.join('/tmp', tmpShot);
    const size = fs.existsSync(shotPath) ? pngSize(shotPath) : { w: 0, h: 0 };
    check('full-page captures below the fold (>1500px)', size.h > 1500, `${size.w}x${size.h}`);

    console.log('interaction:');
    await s1.call('navigate', { url: `${base}/app` }); await sleep(1300);
    check('evaluate returns a value', (await s1.evalText('1+2')) === 'Result: 3');
    check('get_content html', /id="btn"|<button/.test(s1.text(await s1.call('get_content', { type: 'html' }))));
    await s1.call('fill', { selector: '#in', value: 'typed' });
    check('fill sets input value', (await s1.evalText("document.querySelector('#in').value")) === 'Result: "typed"');
    await s1.call('click', { selector: '#btn' }); await sleep(200);
    check('click fires handler', (await s1.evalText('document.title')) === 'Result: "CLICKED"');
    await s1.call('select', { selector: '#sel', value: 'b' });
    check('select sets option', (await s1.evalText("document.querySelector('#sel').value")) === 'Result: "b"');
    await s1.call('hover', { selector: '#hov' }); await sleep(200);
    check('hover fires mouseover', (await s1.evalText('window.__hov')) === 'Result: 1');

    console.log('logs:');
    check('console logs captured', /hello-log/.test(s1.text(await s1.call('get_console_logs', {}))));
    check('console errors captured', /boom-error/.test(s1.text(await s1.call('get_console_errors', {}))));
    check('network logs captured', /\/data/.test(s1.text(await s1.call('get_network_logs', {}))));
    check('network errors capture 404', /\/missing/.test(s1.text(await s1.call('get_network_errors', {}))));
    await s1.call('wipe_logs', {});
    check('wipe_logs clears console logs', !/hello-log/.test(s1.text(await s1.call('get_console_logs', {}))));
    check('get_selected_element returns without error', !/^Error:/.test(s1.text(await s1.call('get_selected_element', {}))));

    console.log('emulation:');
    const emu = s1.text(await s1.call('emulate_device', { device: 'iphone-16' }));
    check('emulate_device reports preset', /Emulating iphone-16/.test(emu), emu);
    check('emulated UA is iPhone', /iPhone/.test(await s1.evalText('navigator.userAgent')));
    check('reset_emulation runs', !/^Error:/.test(s1.text(await s1.call('reset_emulation', {}))));

    console.log('audits:');
    for (const a of ['run_seo_audit', 'run_accessibility_audit', 'run_best_practices_audit', 'run_performance_audit', 'run_nextjs_audit', 'run_debugger_mode', 'run_audit_mode']) {
      const out = s1.text(await s1.call(a, {}, 45000));
      check(`${a} returns a result`, out.length > 10 && !/^Error:/.test(out), out);
    }

    console.log('screencast:');
    s1.text(await s1.call('start_screencast', {})); await sleep(900);
    check('screencast_status shows recording', /^Recording:/.test(s1.text(await s1.call('screencast_status', {}))));
    if (hasFfmpeg) {
      const stop = s1.text(await s1.call('stop_screencast', { output: 'gif' }, 30000));
      check('stop_screencast encodes a file', /\.(gif|mp4|webm)/.test(stop), stop);
    } else {
      console.log('  – stop_screencast: skipped (no ffmpeg)');
    }
  } finally {
    await s1.close();
  }
  check('managed profile cleaned after session close', profileCount() === 0, `${profileCount()} left`);

  console.log('height cap:');
  const s2 = openSession({ CHROMIUM_MAX_SCREENSHOT_HEIGHT: '1000' });
  try {
    await s2.call('navigate', { url: base }); await sleep(900);
    const capMsg = s2.text(await s2.call('screenshot', { name: tmpCap, fullPage: true }));
    const capPath = path.join('/tmp', tmpCap);
    const capSize = fs.existsSync(capPath) ? pngSize(capPath) : { w: 0, h: 0 };
    check('capped image height == 1000', capSize.h === 1000, `${capSize.w}x${capSize.h}`);
    check('cap warning present', /warning: page is \d+px tall/.test(capMsg), capMsg);
  } finally { await s2.close(); }

  console.log('persistent profile:');
  const s3a = openSession({ CHROMIUM_USER_DATA_DIR: profileDir });
  try {
    await s3a.call('set_cookies', { url: base, cookies: [{ name: 'persist_ck', value: 'SURVIVES', domain: '127.0.0.1', path: '/', expirationDate: 4102444800 }] });
  } finally { await s3a.close(); }
  await sleep(800);
  const s3b = openSession({ CHROMIUM_USER_DATA_DIR: profileDir });
  try {
    await s3b.call('navigate', { url: `${base}/cookies` }); await sleep(1000);
    let after = {}; try { after = JSON.parse(s3b.text(await s3b.call('get_content', { type: 'text' }))).cookies; } catch {}
    check('cookie survives a full restart', after.persist_ck === 'SURVIVES', JSON.stringify(after));
  } finally { await s3b.close(); }

  fixture.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
  try { fs.unlinkSync(STUB); } catch {}
  check('no orphaned managed profiles remain', profileCount() === 0, `${profileCount()} left`);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('smoke test crashed:', e); process.exit(1); });
