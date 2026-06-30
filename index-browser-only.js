#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn, execSync } from 'child_process';
import { WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Global browser instance
let chromiumProcess = null;
let wsConnection = null;
let currentTabId = null;
let debuggingPort = 9222;

// Helper function to find Chromium executable
function getChromiumPath() {
  const platform = os.platform();
  
  if (platform === 'linux') {
    // Try common Linux paths
    const linuxPaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable'
    ];
    
    for (const chromePath of linuxPaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  } else if (platform === 'darwin') {
    // macOS paths
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/opt/homebrew/bin/chromium'
    ];
    
    for (const chromePath of macPaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  } else if (platform === 'win32') {
    // Windows paths
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Chromium\\Application\\chrome.exe'
    ];
    
    for (const chromePath of winPaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  }
  
  // Try to find via which command
  try {
    const result = execSync('which chromium-browser || which chromium || which google-chrome', { encoding: 'utf8' }).trim();
    if (result) {
      return result.split('\n')[0];
    }
  } catch (error) {
    // Ignore error, will throw below
  }
  
  throw new Error(`Could not find Chromium browser. Please install it for your platform.`);
}

class BrowserOnlyMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'chromium-browser-only',
        version: '1.3.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // Only expose browsing-related tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'navigate',
          description: 'Navigate to a URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to navigate to',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'get_content',
          description: 'Get page content (HTML or text)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['html', 'text'],
                description: 'Type of content to get',
                default: 'text',
              },
            },
          },
        },
        {
          name: 'screenshot',
          description: 'Take a screenshot of the current page (use fullPage for the entire scrollable length)',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name for the screenshot file',
                default: 'screenshot.png',
              },
              fullPage: {
                type: 'boolean',
                description: 'Capture the entire scrollable page including content below the fold, not just the visible viewport',
                default: false,
              },
            },
          },
        },
        {
          name: 'evaluate',
          description: 'Execute JavaScript in the browser (read-only operations)',
          inputSchema: {
            type: 'object',
            properties: {
              script: {
                type: 'string',
                description: 'JavaScript code to execute (for reading page info)',
              },
            },
            required: ['script'],
          },
        },
        {
          name: 'set_cookies',
          description: 'Import cookies (e.g. exported after logging in elsewhere) so the browser is authenticated without scripting the login form. Auth-critical cookies like x.com auth_token are httpOnly and must come from a real export (DevTools / Cookie-Editor), not document.cookie.',
          inputSchema: {
            type: 'object',
            properties: {
              cookies: {
                type: 'array',
                description: 'Array of cookie objects: { name, value, domain, path?, secure?, httpOnly?, sameSite?, expires?|expirationDate? }. Accepts Cookie-Editor / EditThisCookie export format.',
                items: { type: 'object' },
              },
              url: {
                type: 'string',
                description: 'Optional default URL applied to cookies that omit a domain (e.g. https://x.com)',
              },
            },
            required: ['cookies'],
          },
        },
        {
          name: 'get_cookies',
          description: 'Export all cookies from the current browser session as a JSON array (round-trips with set_cookies).',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'close_browser',
          description: 'Close the browser instance',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'navigate':
            return await this.navigate(args.url);
          case 'get_content':
            return await this.getContent(args.type || 'text');
          case 'screenshot':
            return await this.screenshot(args.name, args.fullPage);
          case 'evaluate':
            return await this.evaluate(args.script);
          case 'set_cookies':
            return await this.setCookies(args.cookies, args.url);
          case 'get_cookies':
            return await this.getCookies();
          case 'close_browser':
            return await this.closeBrowser();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.closeBrowser();
      await this.server.close();
      process.exit(0);
    });
  }

  async sendCDPCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        reject(new Error('No browser connection available'));
        return;
      }

      const commandId = Date.now();
      const command = { id: commandId, method, params };

      const timeout = setTimeout(() => {
        reject(new Error(`CDP command timeout: ${method}`));
      }, 10000);

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === commandId) {
            clearTimeout(timeout);
            wsConnection.off('message', messageHandler);
            if (response.error) {
              reject(new Error(`CDP error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore parsing errors for non-matching messages
        }
      };

      wsConnection.on('message', messageHandler);
      wsConnection.send(JSON.stringify(command));
    });
  }

  async httpRequest(url) {
    return new Promise((resolve, reject) => {
      const request = http.get(url, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(JSON.parse(data)));
      });
      request.on('error', reject);
      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('HTTP request timeout'));
      });
    });
  }

  async ensureChromium() {
    if (chromiumProcess && wsConnection) {
      return;
    }

    return new Promise((resolve, reject) => {
      const chromiumPath = getChromiumPath();
      chromiumProcess = spawn(chromiumPath, [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-ipc-flooding-protection',
        '--enable-logging',
        '--log-level=0',
        `--remote-debugging-port=${debuggingPort}`,
        '--no-first-run',
      ]);

      chromiumProcess.on('error', reject);
      
      // Wait for browser to be ready
      const checkReady = async () => {
        try {
          const response = await this.httpRequest(`http://localhost:${debuggingPort}/json`);
          
          if (!currentTabId && response.length > 0) {
            currentTabId = response[0].id;
          }

          if (!currentTabId) {
            const newTabResponse = await this.httpRequest(`http://localhost:${debuggingPort}/json/new`);
            currentTabId = newTabResponse.id;
          }

          wsConnection = new WebSocket(`ws://localhost:${debuggingPort}/devtools/page/${currentTabId}`);
          
          wsConnection.on('open', () => resolve());
          wsConnection.on('error', reject);
          
        } catch (error) {
          setTimeout(checkReady, 500);
        }
      };

      setTimeout(checkReady, 1000);
    });
  }

  async navigate(url) {
    await this.ensureChromium();
    await this.sendCDPCommand('Page.navigate', { url });
    
    return {
      content: [{ type: 'text', text: `Successfully navigated to ${url}` }],
    };
  }

  async getContent(type = 'text') {
    await this.ensureChromium();
    
    if (type === 'html') {
      const result = await this.sendCDPCommand('DOM.getDocument');
      const html = await this.sendCDPCommand('DOM.getOuterHTML', {
        nodeId: result.root.nodeId,
      });
      return {
        content: [{ type: 'text', text: html.outerHTML }],
      };
    } else {
      const result = await this.sendCDPCommand('Runtime.evaluate', {
        expression: 'document.body.innerText',
        returnByValue: true,
      });
      return {
        content: [{ type: 'text', text: result.result.value || '' }],
      };
    }
  }

  async screenshot(name = 'screenshot.png', fullPage = false) {
    await this.ensureChromium();
    
    const screenshotParams = { format: 'png' };
    let truncationNote = '';
    
    if (fullPage) {
      // Scroll the whole page once to trigger lazy-loaded / scroll-dependent
      // content, then return to the top. Bounded to stay under the CDP timeout.
      await this.sendCDPCommand('Runtime.evaluate', {
        expression: `(async () => {
          const step = window.innerHeight || 800;
          const max = Math.min(document.body.scrollHeight, step * 40);
          for (let y = 0; y < max; y += step) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 50));
          }
          window.scrollTo(0, 0);
          await new Promise(r => setTimeout(r, 100));
        })()`,
        awaitPromise: true,
      });

      // captureBeyondViewport is required to render content outside the current
      // viewport. Prefer CSS-pixel content size; fall back for older Chrome.
      const metrics = await this.sendCDPCommand('Page.getLayoutMetrics');
      const content = metrics.cssContentSize || metrics.contentSize;

      // Chrome can't render a single screenshot past a height limit (~16k px
      // GPU texture cap; higher under --disable-gpu software rendering). Cap
      // the capture and warn instead of silently clipping. Override via
      // CHROMIUM_MAX_SCREENSHOT_HEIGHT.
      const maxHeight = parseInt(process.env.CHROMIUM_MAX_SCREENSHOT_HEIGHT || '32768', 10);
      const fullHeight = Math.ceil(content.height);
      const clipHeight = Math.min(fullHeight, maxHeight);
      if (fullHeight > maxHeight) {
        truncationNote = ` (warning: page is ${fullHeight}px tall; captured top ${maxHeight}px — Chrome rendering limit. Set CHROMIUM_MAX_SCREENSHOT_HEIGHT to raise it.)`;
      }
      screenshotParams.clip = {
        x: 0,
        y: 0,
        width: Math.ceil(content.width),
        height: clipHeight,
        scale: 1,
      };
      screenshotParams.captureBeyondViewport = true;
    }

    const screenshot = await this.sendCDPCommand('Page.captureScreenshot', screenshotParams);
    const screenshotPath = `/tmp/${name}`;
    
    fs.writeFileSync(screenshotPath, screenshot.data, 'base64');
    
    return {
      content: [{ type: 'text', text: `Screenshot saved to ${screenshotPath}${truncationNote}` }],
    };
  }

  async evaluate(script) {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true,
    });
    
    return {
      content: [{ type: 'text', text: `Result: ${JSON.stringify(result.result.value)}` }],
    };
  }

  async setCookies(cookies, url) {
    await this.ensureChromium();
    if (!Array.isArray(cookies) || cookies.length === 0) {
      throw new Error('set_cookies requires a non-empty "cookies" array');
    }
    await this.sendCDPCommand('Network.enable');

    const normSameSite = (s) => {
      if (!s) return undefined;
      const v = String(s).toLowerCase();
      if (v === 'no_restriction' || v === 'none') return 'None';
      if (v === 'lax') return 'Lax';
      if (v === 'strict') return 'Strict';
      return undefined;
    };

    const prepared = cookies.map((c) => {
      const out = { name: c.name, value: String(c.value) };
      if (c.domain) out.domain = c.domain;
      if (c.path) out.path = c.path;
      if (!out.domain) out.url = c.url || url;
      if (c.secure !== undefined) out.secure = !!c.secure;
      if (c.httpOnly !== undefined) out.httpOnly = !!c.httpOnly;
      const ss = normSameSite(c.sameSite);
      if (ss) out.sameSite = ss;
      if (!c.session) {
        const exp = c.expires !== undefined ? c.expires : c.expirationDate;
        if (exp !== undefined) out.expires = Math.floor(Number(exp));
      }
      if (!out.domain && !out.url) {
        throw new Error(`Cookie "${c.name}" needs a domain or a url (pass a top-level url, e.g. https://x.com)`);
      }
      return out;
    });

    await this.sendCDPCommand('Network.setCookies', { cookies: prepared });
    return {
      content: [{ type: 'text', text: `Set ${prepared.length} cookie(s)${url ? ' (default url ' + url + ')' : ''}. Navigate to the target page to use the authenticated session.` }],
    };
  }

  async getCookies() {
    await this.ensureChromium();
    await this.sendCDPCommand('Network.enable');
    const result = await this.sendCDPCommand('Network.getAllCookies');
    const cookies = result.cookies || [];
    return {
      content: [{ type: 'text', text: JSON.stringify(cookies, null, 2) }],
    };
  }

  async closeBrowser() {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
    
    if (chromiumProcess) {
      chromiumProcess.kill('SIGTERM');
      chromiumProcess = null;
    }
    
    currentTabId = null;
    
    return {
      content: [{ type: 'text', text: 'Browser closed successfully' }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new BrowserOnlyMCPServer();
server.run().catch(error => {
  process.stderr.write(`Failed to start browser-only MCP server: ${error.message}\n`);
  process.exit(1);
});