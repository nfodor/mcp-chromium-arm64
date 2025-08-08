#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Global browser instance
let chromiumProcess = null;
let wsConnection = null;
let currentTabId = null;
let debuggingPort = 9222;

// Log storage
let consoleLogs = [];
let consoleErrors = [];
let networkLogs = [];
let networkErrors = [];

class DirectChromiumMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'chromium-arm64-server',
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
          name: 'screenshot',
          description: 'Take a screenshot of the current page',
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
                description: 'Capture full page',
                default: false,
              },
            },
          },
        },
        {
          name: 'click',
          description: 'Click an element on the page',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element to click',
              },
            },
            required: ['selector'],
          },
        },
        {
          name: 'fill',
          description: 'Fill an input field',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the input field',
              },
              value: {
                type: 'string',
                description: 'Value to fill',
              },
            },
            required: ['selector', 'value'],
          },
        },
        {
          name: 'evaluate',
          description: 'Execute JavaScript in the browser',
          inputSchema: {
            type: 'object',
            properties: {
              script: {
                type: 'string',
                description: 'JavaScript code to execute',
              },
            },
            required: ['script'],
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
          name: 'hover',
          description: 'Hover over an element on the page',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element to hover',
              },
            },
            required: ['selector'],
          },
        },
        {
          name: 'select',
          description: 'Select an option from a dropdown',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the select element',
              },
              value: {
                type: 'string',
                description: 'Value to select',
              },
            },
            required: ['selector', 'value'],
          },
        },
        {
          name: 'get_console_logs',
          description: 'Get browser console logs',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_console_errors',
          description: 'Get browser console errors',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_network_logs',
          description: 'Get network activity logs',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_network_errors',
          description: 'Get network error logs',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'wipe_logs',
          description: 'Clear all stored logs from memory',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_selected_element',
          description: 'Get information about the currently selected element',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_accessibility_audit',
          description: 'Run an accessibility audit on the current page',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_performance_audit',
          description: 'Run a performance audit on the current page',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_seo_audit',
          description: 'Run an SEO audit on the current page',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_best_practices_audit',
          description: 'Run a best practices audit on the current page',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_nextjs_audit',
          description: 'Run a Next.js specific audit on the current page',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_debugger_mode',
          description: 'Run debugger mode to debug issues in the application',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_audit_mode',
          description: 'Run comprehensive audit mode for optimization',
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
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'navigate':
            return await this.navigate(args.url);
          case 'screenshot':
            return await this.screenshot(args.name || 'screenshot.png', args.fullPage || false);
          case 'click':
            return await this.click(args.selector);
          case 'fill':
            return await this.fill(args.selector, args.value);
          case 'evaluate':
            return await this.evaluate(args.script);
          case 'get_content':
            return await this.getContent(args.type || 'text');
          case 'hover':
            return await this.hover(args.selector);
          case 'select':
            return await this.select(args.selector, args.value);
          case 'get_console_logs':
            return await this.getConsoleLogs();
          case 'get_console_errors':
            return await this.getConsoleErrors();
          case 'get_network_logs':
            return await this.getNetworkLogs();
          case 'get_network_errors':
            return await this.getNetworkErrors();
          case 'wipe_logs':
            return await this.wipeLogs();
          case 'get_selected_element':
            return await this.getSelectedElement();
          case 'run_accessibility_audit':
            return await this.runAccessibilityAudit();
          case 'run_performance_audit':
            return await this.runPerformanceAudit();
          case 'run_seo_audit':
            return await this.runSEOAudit();
          case 'run_best_practices_audit':
            return await this.runBestPracticesAudit();
          case 'run_nextjs_audit':
            return await this.runNextJSAudit();
          case 'run_debugger_mode':
            return await this.runDebuggerMode();
          case 'run_audit_mode':
            return await this.runAuditMode();
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

  async ensureChromium() {
    if (!chromiumProcess || chromiumProcess.exitCode !== null) {
      await this.startChromium();
    }
    
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
      await this.connectToChromium();
    }
  }

  async startChromium() {
    return new Promise((resolve, reject) => {
      chromiumProcess = spawn('/usr/bin/chromium-browser', [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        `--remote-debugging-port=${debuggingPort}`,
        '--no-first-run',
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
        '--window-size=1280,720'
      ]);

      chromiumProcess.on('error', reject);
      
      // Wait for chromium to start
      setTimeout(resolve, 2000);
    });
  }

  async connectToChromium() {
    // Get available tabs
    const response = await this.httpRequest(`http://localhost:${debuggingPort}/json`);
    const tabs = JSON.parse(response);
    
    if (tabs.length === 0) {
      // Create a new tab
      const newTabResponse = await this.httpRequest(`http://localhost:${debuggingPort}/json/new`);
      const newTab = JSON.parse(newTabResponse);
      currentTabId = newTab.id;
    } else {
      currentTabId = tabs[0].id;
    }

    // Connect to WebSocket
    const wsUrl = tabs.find(tab => tab.id === currentTabId)?.webSocketDebuggerUrl || 
                  `ws://localhost:${debuggingPort}/devtools/page/${currentTabId}`;
    
    return new Promise((resolve, reject) => {
      wsConnection = new WebSocket(wsUrl);
      
      wsConnection.on('open', () => {
        this.setupEventListeners();
        resolve();
      });
      
      wsConnection.on('error', reject);
    });
  }

  setupEventListeners() {
    // Enable domains
    this.sendCDPCommand('Runtime.enable');
    this.sendCDPCommand('Network.enable');
    this.sendCDPCommand('Page.enable');
    this.sendCDPCommand('DOM.enable');

    // Set up event listeners
    wsConnection.on('message', (data) => {
      const message = JSON.parse(data);
      
      if (message.method === 'Runtime.consoleAPICalled') {
        const logEntry = {
          type: message.params.type,
          text: message.params.args.map(arg => arg.value || arg.description).join(' '),
          timestamp: new Date().toISOString()
        };
        
        consoleLogs.push(logEntry);
        
        if (['error', 'warning'].includes(message.params.type)) {
          consoleErrors.push(logEntry);
        }
        
        // Keep only last 100 entries
        if (consoleLogs.length > 100) consoleLogs.shift();
        if (consoleErrors.length > 100) consoleErrors.shift();
      }

      if (message.method === 'Network.responseReceived') {
        const logEntry = {
          url: message.params.response.url,
          status: message.params.response.status,
          statusText: message.params.response.statusText,
          method: message.params.response.requestMethod || 'GET',
          timestamp: new Date().toISOString()
        };
        
        networkLogs.push(logEntry);
        
        if (message.params.response.status >= 400) {
          networkErrors.push(logEntry);
        }
        
        // Keep only last 100 entries
        if (networkLogs.length > 100) networkLogs.shift();
        if (networkErrors.length > 100) networkErrors.shift();
      }
    });
  }

  async sendCDPCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      const command = { id, method, params };
      
      const timeout = setTimeout(() => {
        reject(new Error(`CDP command timeout: ${method}`));
      }, 10000);

      const messageHandler = (data) => {
        const response = JSON.parse(data);
        if (response.id === id) {
          clearTimeout(timeout);
          wsConnection.off('message', messageHandler);
          
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      };

      wsConnection.on('message', messageHandler);
      wsConnection.send(JSON.stringify(command));
    });
  }

  async httpRequest(url) {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  async navigate(url) {
    await this.ensureChromium();
    await this.sendCDPCommand('Page.navigate', { url });
    
    return {
      content: [{ type: 'text', text: `Successfully navigated to ${url}` }],
    };
  }

  async screenshot(name, fullPage) {
    await this.ensureChromium();
    
    const screenshotParams = { format: 'png' };
    if (fullPage) {
      const metrics = await this.sendCDPCommand('Page.getLayoutMetrics');
      screenshotParams.clip = {
        x: 0,
        y: 0,
        width: metrics.contentSize.width,
        height: metrics.contentSize.height,
        scale: 1
      };
    }
    
    const result = await this.sendCDPCommand('Page.captureScreenshot', screenshotParams);
    const screenshotPath = `/tmp/${name}`;
    
    fs.writeFileSync(screenshotPath, result.data, 'base64');
    
    return {
      content: [{ type: 'text', text: `Screenshot saved to ${screenshotPath}` }],
    };
  }

  async click(selector) {
    await this.ensureChromium();
    
    // Find element
    const doc = await this.sendCDPCommand('DOM.getDocument');
    const element = await this.sendCDPCommand('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector
    });
    
    if (!element.nodeId) {
      throw new Error(`Element not found: ${selector}`);
    }

    // Get element box
    const box = await this.sendCDPCommand('DOM.getBoxModel', { nodeId: element.nodeId });
    const quad = box.model.content;
    const x = (quad[0] + quad[4]) / 2;
    const y = (quad[1] + quad[5]) / 2;

    // Click
    await this.sendCDPCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x, y,
      button: 'left',
      clickCount: 1
    });
    
    await this.sendCDPCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x, y,
      button: 'left',
      clickCount: 1
    });
    
    return {
      content: [{ type: 'text', text: `Clicked element: ${selector}` }],
    };
  }

  async fill(selector, value) {
    await this.ensureChromium();
    await this.click(selector); // Focus element first
    
    // Clear and type
    await this.sendCDPCommand('Input.insertText', { text: value });
    
    return {
      content: [{ type: 'text', text: `Filled ${selector} with: ${value}` }],
    };
  }

  async evaluate(script) {
    await this.ensureChromium();
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true
    });
    
    return {
      content: [{ type: 'text', text: `Result: ${JSON.stringify(result.result?.value)}` }],
    };
  }

  async getContent(type) {
    await this.ensureChromium();
    
    let content;
    if (type === 'html') {
      const doc = await this.sendCDPCommand('DOM.getDocument');
      const html = await this.sendCDPCommand('DOM.getOuterHTML', { nodeId: doc.root.nodeId });
      content = html.outerHTML;
    } else {
      const result = await this.sendCDPCommand('Runtime.evaluate', {
        expression: 'document.body.innerText',
        returnByValue: true
      });
      content = result.result?.value || '';
    }
    
    return {
      content: [{ type: 'text', text: content }],
    };
  }

  async hover(selector) {
    await this.ensureChromium();
    
    const doc = await this.sendCDPCommand('DOM.getDocument');
    const element = await this.sendCDPCommand('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector
    });
    
    if (!element.nodeId) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await this.sendCDPCommand('DOM.getBoxModel', { nodeId: element.nodeId });
    const quad = box.model.content;
    const x = (quad[0] + quad[4]) / 2;
    const y = (quad[1] + quad[5]) / 2;

    await this.sendCDPCommand('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x, y
    });
    
    return {
      content: [{ type: 'text', text: `Hovered over element: ${selector}` }],
    };
  }

  async select(selector, value) {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const select = document.querySelector('${selector}');
        if (select) {
          select.value = '${value}';
          select.dispatchEvent(new Event('change', { bubbles: true }));
          true;
        } else {
          false;
        }
      `,
      returnByValue: true
    });
    
    if (!result.result?.value) {
      throw new Error(`Select element not found: ${selector}`);
    }
    
    return {
      content: [{ type: 'text', text: `Selected '${value}' in ${selector}` }],
    };
  }

  // Logging methods (same as before)
  async getConsoleLogs() {
    return {
      content: [{ type: 'text', text: JSON.stringify(consoleLogs, null, 2) }],
    };
  }

  async getConsoleErrors() {
    return {
      content: [{ type: 'text', text: JSON.stringify(consoleErrors, null, 2) }],
    };
  }

  async getNetworkLogs() {
    return {
      content: [{ type: 'text', text: JSON.stringify(networkLogs, null, 2) }],
    };
  }

  async getNetworkErrors() {
    return {
      content: [{ type: 'text', text: JSON.stringify(networkErrors, null, 2) }],
    };
  }

  async wipeLogs() {
    consoleLogs = [];
    consoleErrors = [];
    networkLogs = [];
    networkErrors = [];
    
    return {
      content: [{ type: 'text', text: 'All logs cleared from memory' }],
    };
  }

  async getSelectedElement() {
    await this.ensureChromium();
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const activeElement = document.activeElement;
        if (activeElement && activeElement !== document.body) {
          JSON.stringify({
            tagName: activeElement.tagName,
            id: activeElement.id,
            className: activeElement.className,
            textContent: activeElement.textContent?.substring(0, 100),
            value: activeElement.value || null,
            selector: activeElement.id ? \`#\${activeElement.id}\` : 
                     activeElement.className ? \`.\${activeElement.className.split(' ')[0]}\` :
                     activeElement.tagName.toLowerCase()
          });
        } else {
          null;
        }
      `,
      returnByValue: true
    });
    
    const selectedElement = result.result?.value ? JSON.parse(result.result.value) : null;
    
    return {
      content: [{ type: 'text', text: selectedElement ? JSON.stringify(selectedElement, null, 2) : 'No element currently selected' }],
    };
  }

  // Audit methods (simplified versions using Runtime.evaluate)
  async runAccessibilityAudit() {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const results = [];
        const imagesWithoutAlt = Array.from(document.querySelectorAll('img:not([alt])')).length;
        if (imagesWithoutAlt > 0) {
          results.push(\`Found \${imagesWithoutAlt} images without alt text\`);
        }
        
        const inputsWithoutLabels = Array.from(document.querySelectorAll('input:not([aria-label]):not([id])')).length;
        if (inputsWithoutLabels > 0) {
          results.push(\`Found \${inputsWithoutLabels} inputs without proper labels\`);
        }
        
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        if (headings.length === 0) {
          results.push('No heading structure found on page');
        }
        
        JSON.stringify(results.length > 0 ? results : ['Basic accessibility checks passed']);
      `,
      returnByValue: true
    });
    
    const auditResults = JSON.parse(result.result?.value || '[]');
    
    return {
      content: [{ type: 'text', text: `Accessibility Audit Results:\\n${auditResults.join('\\n')}` }],
    };
  }

  async runPerformanceAudit() {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const perfData = performance.getEntriesByType('navigation')[0];
        const timing = performance.timing;
        
        JSON.stringify({
          domContentLoaded: perfData ? Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart) : 0,
          loadComplete: perfData ? Math.round(perfData.loadEventEnd - perfData.loadEventStart) : 0,
          firstPaint: timing ? timing.loadEventEnd - timing.navigationStart : 0,
          resourceCount: performance.getEntriesByType('resource').length,
          memoryUsage: performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
          } : 'Not available'
        });
      `,
      returnByValue: true
    });
    
    const performanceMetrics = JSON.parse(result.result?.value || '{}');
    
    return {
      content: [{ type: 'text', text: `Performance Audit Results:\\n${JSON.stringify(performanceMetrics, null, 2)}` }],
    };
  }

  async runSEOAudit() {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const results = [];
        const title = document.querySelector('title');
        if (!title || title.textContent.trim().length === 0) {
          results.push('Missing or empty title tag');
        } else if (title.textContent.length > 60) {
          results.push('Title tag is too long (>60 characters)');
        }
        
        const metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc || metaDesc.getAttribute('content').trim().length === 0) {
          results.push('Missing or empty meta description');
        }
        
        const h1Tags = document.querySelectorAll('h1');
        if (h1Tags.length === 0) {
          results.push('No H1 tag found');
        } else if (h1Tags.length > 1) {
          results.push('Multiple H1 tags found');
        }
        
        const canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
          results.push('Missing canonical link');
        }
        
        JSON.stringify(results.length > 0 ? results : ['Basic SEO checks passed']);
      `,
      returnByValue: true
    });
    
    const seoResults = JSON.parse(result.result?.value || '[]');
    
    return {
      content: [{ type: 'text', text: `SEO Audit Results:\\n${seoResults.join('\\n')}` }],
    };
  }

  async runBestPracticesAudit() {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const results = [];
        if (location.protocol !== 'https:') {
          results.push('Page is not served over HTTPS');
        }
        
        const httpResources = Array.from(document.querySelectorAll('[src], [href]'))
          .filter(el => (el.src || el.href)?.startsWith('http:'))
          .length;
        
        if (httpResources > 0) {
          results.push(\`Found \${httpResources} HTTP resources on HTTPS page\`);
        }
        
        const deprecatedTags = Array.from(document.querySelectorAll('font, center, big, small, tt')).length;
        if (deprecatedTags > 0) {
          results.push(\`Found \${deprecatedTags} deprecated HTML tags\`);
        }
        
        const viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
          results.push('Missing viewport meta tag for mobile optimization');
        }
        
        JSON.stringify(results.length > 0 ? results : ['Best practices checks passed']);
      `,
      returnByValue: true
    });
    
    const bestPracticesResults = JSON.parse(result.result?.value || '[]');
    
    return {
      content: [{ type: 'text', text: `Best Practices Audit Results:\\n${bestPracticesResults.join('\\n')}` }],
    };
  }

  async runNextJSAudit() {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const results = [];
        const nextData = document.querySelector('#__NEXT_DATA__');
        if (!nextData) {
          results.push('This does not appear to be a Next.js application');
          JSON.stringify(results);
        } else {
          const nextImages = document.querySelectorAll('img[data-nimg]');
          const regularImages = document.querySelectorAll('img:not([data-nimg])');
          
          if (regularImages.length > 0 && nextImages.length === 0) {
            results.push(\`Consider using Next.js Image component for \${regularImages.length} images\`);
          }
          
          const internalLinks = Array.from(document.querySelectorAll('a[href^="/"]')).length;
          if (internalLinks > 0) {
            results.push(\`Found \${internalLinks} internal links - ensure Next.js Link component is used\`);
          }
          
          const headTags = document.querySelectorAll('meta, title, link[rel="stylesheet"]');
          if (headTags.length < 3) {
            results.push('Consider using Next.js Head component for better SEO');
          }
          
          JSON.stringify(results.length > 0 ? results : ['Next.js specific checks passed']);
        }
      `,
      returnByValue: true
    });
    
    const nextjsResults = JSON.parse(result.result?.value || '[]');
    
    return {
      content: [{ type: 'text', text: `Next.js Audit Results:\\n${nextjsResults.join('\\n')}` }],
    };
  }

  async runDebuggerMode() {
    await this.ensureChromium();
    
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: `
        JSON.stringify({
          url: window.location.href,
          userAgent: navigator.userAgent,
          screenSize: \`\${screen.width}x\${screen.height}\`,
          viewportSize: \`\${window.innerWidth}x\${window.innerHeight}\`,
          performance: {
            memory: performance.memory ? {
              used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
              total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB'
            } : 'Not available',
            timing: performance.timing ? {
              pageLoad: performance.timing.loadEventEnd - performance.timing.navigationStart + 'ms',
              domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart + 'ms'
            } : 'Not available'
          }
        });
      `,
      returnByValue: true
    });
    
    const debugInfo = JSON.parse(result.result?.value || '{}');
    
    return {
      content: [{ type: 'text', text: `Debugger Mode Results:\\n${JSON.stringify(debugInfo, null, 2)}` }],
    };
  }

  async runAuditMode() {
    const results = {};
    
    results.accessibility = await this.runAccessibilityAudit();
    results.performance = await this.runPerformanceAudit();
    results.seo = await this.runSEOAudit();
    results.bestPractices = await this.runBestPracticesAudit();
    results.nextjs = await this.runNextJSAudit();
    
    const summary = Object.entries(results)
      .map(([category, result]) => `${category}: ${result.isError ? 'FAILED' : 'COMPLETED'}`)
      .join('\\n');
    
    const fullReport = Object.entries(results)
      .map(([category, result]) => `\\n=== ${category.toUpperCase()} ===\\n${result.content[0].text}`)
      .join('\\n');
    
    return {
      content: [{ type: 'text', text: `Comprehensive Audit Mode Results:\\n\\nSUMMARY:\\n${summary}\\n\\nFULL REPORT:${fullReport}` }],
    };
  }

  async closeBrowser() {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
    
    if (chromiumProcess && chromiumProcess.exitCode === null) {
      chromiumProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => {
        chromiumProcess.on('exit', resolve);
        setTimeout(() => {
          chromiumProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
      
      chromiumProcess = null;
    }
    
    currentTabId = null;
    
    return {
      content: [{ type: 'text', text: 'Browser closed successfully' }],
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      process.stderr.write(`[MCP Error] ${error.message}\\n`);
    };

    process.on('SIGINT', async () => {
      await this.closeBrowser();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.closeBrowser();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new DirectChromiumMCPServer();
server.run().catch(error => {
  process.stderr.write(`Failed to start MCP server: ${error.message}\\n`);
  process.exit(1);
});