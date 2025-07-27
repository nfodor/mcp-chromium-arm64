#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer-core';

// Global browser instance
let browser = null;
let page = null;

class ChromiumMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'chromium-arm64-server',
        version: '1.0.0',
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

  async ensureBrowser() {
    if (!browser) {
      browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
        timeout: 30000,
      });
    }
    
    if (!page || page.isClosed()) {
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent('Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
    }
  }

  async navigate(url) {
    await this.ensureBrowser();
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    return {
      content: [{ type: 'text', text: `Successfully navigated to ${url}` }],
    };
  }

  async screenshot(name, fullPage) {
    await this.ensureBrowser();
    const screenshotPath = `/tmp/${name}`;
    
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage,
      type: 'png' 
    });
    
    return {
      content: [{ type: 'text', text: `Screenshot saved to ${screenshotPath}` }],
    };
  }

  async click(selector) {
    await this.ensureBrowser();
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    
    return {
      content: [{ type: 'text', text: `Clicked element: ${selector}` }],
    };
  }

  async fill(selector, value) {
    await this.ensureBrowser();
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.type(selector, value);
    
    return {
      content: [{ type: 'text', text: `Filled ${selector} with: ${value}` }],
    };
  }

  async evaluate(script) {
    await this.ensureBrowser();
    const result = await page.evaluate(script);
    
    return {
      content: [{ type: 'text', text: `Result: ${JSON.stringify(result)}` }],
    };
  }

  async getContent(type) {
    await this.ensureBrowser();
    let content;
    
    if (type === 'html') {
      content = await page.content();
    } else {
      content = await page.evaluate(() => document.body.innerText);
    }
    
    return {
      content: [{ type: 'text', text: content }],
    };
  }

  async closeBrowser() {
    if (page) {
      await page.close();
      page = null;
    }
    if (browser) {
      await browser.close();
      browser = null;
    }
    
    return {
      content: [{ type: 'text', text: 'Browser closed successfully' }],
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
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
    console.error('Chromium ARM64 MCP server running on stdio');
  }
}

const server = new ChromiumMCPServer();
server.run().catch(console.error);