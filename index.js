#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer-core';

// Global browser instance
let browser = null;
let page = null;

// Log storage
let consoleLogs = [];
let consoleErrors = [];
let networkLogs = [];
let networkErrors = [];

class ChromiumMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'chromium-arm64-server',
        version: '1.2.0',
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
      
      // Set up logging
      this.setupPageLogging(page);
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

  async hover(selector) {
    await this.ensureBrowser();
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.hover(selector);
    
    return {
      content: [{ type: 'text', text: `Hovered over element: ${selector}` }],
    };
  }

  async select(selector, value) {
    await this.ensureBrowser();
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.select(selector, value);
    
    return {
      content: [{ type: 'text', text: `Selected '${value}' in ${selector}` }],
    };
  }

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
    await this.ensureBrowser();
    const selectedElement = await page.evaluate(() => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement !== document.body) {
        return {
          tagName: activeElement.tagName,
          id: activeElement.id,
          className: activeElement.className,
          textContent: activeElement.textContent?.substring(0, 100),
          value: activeElement.value || null,
          selector: activeElement.id ? `#${activeElement.id}` : 
                   activeElement.className ? `.${activeElement.className.split(' ')[0]}` :
                   activeElement.tagName.toLowerCase()
        };
      }
      return null;
    });
    
    return {
      content: [{ type: 'text', text: selectedElement ? JSON.stringify(selectedElement, null, 2) : 'No element currently selected' }],
    };
  }

  setupPageLogging(page) {
    // Console logging
    page.on('console', (msg) => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      
      consoleLogs.push(logEntry);
      
      if (['error', 'warning'].includes(msg.type())) {
        consoleErrors.push(logEntry);
      }
      
      // Keep only last 100 entries
      if (consoleLogs.length > 100) consoleLogs.shift();
      if (consoleErrors.length > 100) consoleErrors.shift();
    });

    // Network logging
    page.on('response', (response) => {
      const logEntry = {
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        method: response.request().method(),
        timestamp: new Date().toISOString()
      };
      
      networkLogs.push(logEntry);
      
      if (response.status() >= 400) {
        networkErrors.push(logEntry);
      }
      
      // Keep only last 100 entries
      if (networkLogs.length > 100) networkLogs.shift();
      if (networkErrors.length > 100) networkErrors.shift();
    });
  }

  async runAccessibilityAudit() {
    await this.ensureBrowser();
    
    try {
      // Basic accessibility checks using browser API
      const auditResults = await page.evaluate(() => {
        const results = [];
        
        // Check for missing alt text on images
        const imagesWithoutAlt = Array.from(document.querySelectorAll('img:not([alt])')).length;
        if (imagesWithoutAlt > 0) {
          results.push(`Found ${imagesWithoutAlt} images without alt text`);
        }
        
        // Check for form inputs without labels
        const inputsWithoutLabels = Array.from(document.querySelectorAll('input:not([aria-label]):not([id])')).length;
        if (inputsWithoutLabels > 0) {
          results.push(`Found ${inputsWithoutLabels} inputs without proper labels`);
        }
        
        // Check for proper heading structure
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        if (headings.length === 0) {
          results.push('No heading structure found on page');
        }
        
        // Check for color contrast (simplified)
        const lowContrastElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const backgroundColor = style.backgroundColor;
          return color === 'rgb(128, 128, 128)' && backgroundColor === 'rgb(255, 255, 255)';
        }).length;
        
        if (lowContrastElements > 0) {
          results.push(`Found ${lowContrastElements} potentially low contrast elements`);
        }
        
        return results.length > 0 ? results : ['Basic accessibility checks passed'];
      });
      
      return {
        content: [{ type: 'text', text: `Accessibility Audit Results:\n${auditResults.join('\n')}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Accessibility audit failed: ${error.message}` }],
        isError: true,
      };
    }
  }

  async runPerformanceAudit() {
    await this.ensureBrowser();
    
    try {
      const performanceMetrics = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0];
        const timing = performance.timing;
        
        return {
          domContentLoaded: perfData ? Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart) : 0,
          loadComplete: perfData ? Math.round(perfData.loadEventEnd - perfData.loadEventStart) : 0,
          firstPaint: timing ? timing.loadEventEnd - timing.navigationStart : 0,
          resourceCount: performance.getEntriesByType('resource').length,
          memoryUsage: performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
          } : 'Not available'
        };
      });
      
      return {
        content: [{ type: 'text', text: `Performance Audit Results:\n${JSON.stringify(performanceMetrics, null, 2)}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Performance audit failed: ${error.message}` }],
        isError: true,
      };
    }
  }

  async runSEOAudit() {
    await this.ensureBrowser();
    
    try {
      const seoResults = await page.evaluate(() => {
        const results = [];
        
        // Check title tag
        const title = document.querySelector('title');
        if (!title || title.textContent.trim().length === 0) {
          results.push('Missing or empty title tag');
        } else if (title.textContent.length > 60) {
          results.push('Title tag is too long (>60 characters)');
        }
        
        // Check meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc || metaDesc.getAttribute('content').trim().length === 0) {
          results.push('Missing or empty meta description');
        }
        
        // Check H1 tags
        const h1Tags = document.querySelectorAll('h1');
        if (h1Tags.length === 0) {
          results.push('No H1 tag found');
        } else if (h1Tags.length > 1) {
          results.push('Multiple H1 tags found');
        }
        
        // Check for canonical link
        const canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
          results.push('Missing canonical link');
        }
        
        // Check for robots meta
        const robotsMeta = document.querySelector('meta[name="robots"]');
        if (!robotsMeta) {
          results.push('Missing robots meta tag');
        }
        
        return results.length > 0 ? results : ['Basic SEO checks passed'];
      });
      
      return {
        content: [{ type: 'text', text: `SEO Audit Results:\n${seoResults.join('\n')}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `SEO audit failed: ${error.message}` }],
        isError: true,
      };
    }
  }

  async runBestPracticesAudit() {
    await this.ensureBrowser();
    
    try {
      const bestPracticesResults = await page.evaluate(() => {
        const results = [];
        
        // Check for HTTPS
        if (location.protocol !== 'https:') {
          results.push('Page is not served over HTTPS');
        }
        
        // Check for console errors
        if (window.console && window.console.error) {
          results.push('Check browser console for any error messages');
        }
        
        // Check for mixed content
        const httpResources = Array.from(document.querySelectorAll('[src], [href]'))
          .filter(el => (el.src || el.href)?.startsWith('http:'))
          .length;
        
        if (httpResources > 0) {
          results.push(`Found ${httpResources} HTTP resources on HTTPS page`);
        }
        
        // Check for deprecated HTML
        const deprecatedTags = Array.from(document.querySelectorAll('font, center, big, small, tt')).length;
        if (deprecatedTags > 0) {
          results.push(`Found ${deprecatedTags} deprecated HTML tags`);
        }
        
        // Check viewport meta tag
        const viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
          results.push('Missing viewport meta tag for mobile optimization');
        }
        
        return results.length > 0 ? results : ['Best practices checks passed'];
      });
      
      return {
        content: [{ type: 'text', text: `Best Practices Audit Results:\n${bestPracticesResults.join('\n')}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Best practices audit failed: ${error.message}` }],
        isError: true,
      };
    }
  }

  async runNextJSAudit() {
    await this.ensureBrowser();
    
    try {
      const nextjsResults = await page.evaluate(() => {
        const results = [];
        
        // Check for Next.js specific indicators
        const nextData = document.querySelector('#__NEXT_DATA__');
        if (!nextData) {
          results.push('This does not appear to be a Next.js application');
          return results;
        }
        
        // Check for Next.js Image optimization
        const nextImages = document.querySelectorAll('img[data-nimg]');
        const regularImages = document.querySelectorAll('img:not([data-nimg])');
        
        if (regularImages.length > 0 && nextImages.length === 0) {
          results.push(`Consider using Next.js Image component for ${regularImages.length} images`);
        }
        
        // Check for Next.js Link usage
        const externalLinks = Array.from(document.querySelectorAll('a[href^="http"]')).length;
        const internalLinks = Array.from(document.querySelectorAll('a[href^="/"]')).length;
        
        if (internalLinks > 0) {
          results.push(`Found ${internalLinks} internal links - ensure Next.js Link component is used`);
        }
        
        // Check for Next.js Head usage
        const headTags = document.querySelectorAll('meta, title, link[rel="stylesheet"]');
        if (headTags.length < 3) {
          results.push('Consider using Next.js Head component for better SEO');
        }
        
        return results.length > 0 ? results : ['Next.js specific checks passed'];
      });
      
      return {
        content: [{ type: 'text', text: `Next.js Audit Results:\n${nextjsResults.join('\n')}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Next.js audit failed: ${error.message}` }],
        isError: true,
      };
    }
  }

  async runDebuggerMode() {
    await this.ensureBrowser();
    
    try {
      // Enable additional debugging features
      await page.evaluateOnNewDocument(() => {
        window.debugMode = true;
        console.log('Debug mode enabled');
      });
      
      const debugInfo = await page.evaluate(() => {
        const info = {
          url: window.location.href,
          userAgent: navigator.userAgent,
          screenSize: `${screen.width}x${screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
          errors: [],
          warnings: [],
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
        };
        
        // Collect any existing console errors
        if (window.console && window.console.error) {
          info.errors.push('Check browser console for detailed error messages');
        }
        
        return info;
      });
      
      return {
        content: [{ type: 'text', text: `Debugger Mode Results:\n${JSON.stringify(debugInfo, null, 2)}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Debugger mode failed: ${error.message}` }],
        isError: true,
      };
    }
  }

  async runAuditMode() {
    await this.ensureBrowser();
    
    try {
      // Run all audits in sequence
      const results = {};
      
      results.accessibility = await this.runAccessibilityAudit();
      results.performance = await this.runPerformanceAudit();
      results.seo = await this.runSEOAudit();
      results.bestPractices = await this.runBestPracticesAudit();
      results.nextjs = await this.runNextJSAudit();
      
      const summary = Object.entries(results)
        .map(([category, result]) => `${category}: ${result.isError ? 'FAILED' : 'COMPLETED'}`)
        .join('\n');
      
      const fullReport = Object.entries(results)
        .map(([category, result]) => `\n=== ${category.toUpperCase()} ===\n${result.content[0].text}`)
        .join('\n');
      
      return {
        content: [{ type: 'text', text: `Comprehensive Audit Mode Results:\n\nSUMMARY:\n${summary}\n\nFULL REPORT:${fullReport}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Audit mode failed: ${error.message}` }],
        isError: true,
      };
    }
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
      // Log errors to stderr in a way that doesn't interfere with MCP protocol
      process.stderr.write(`[MCP Error] ${error.message}\n`);
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
    // MCP server started - no console output to avoid protocol interference
  }
}

const server = new ChromiumMCPServer();
server.run().catch(error => {
  process.stderr.write(`Failed to start MCP server: ${error.message}\n`);
  process.exit(1);
});