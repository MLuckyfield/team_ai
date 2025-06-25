const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PlaywrightCrawler, Dataset } = require('crawlee');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
    try {
        const { 
            urls, 
            selector, 
            maxRequestsPerCrawl = 10,
            headless = true,
            waitForSelector = null,
            screenshot = false
        } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ 
                error: 'URLs array is required and must not be empty' 
            });
        }

        const results = [];
        
        const crawler = new PlaywrightCrawler({
            maxRequestsPerCrawl,
            headless,
            launchContext: {
                launchOptions: {
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            },
            async requestHandler({ page, request, log }) {
                log.info(`Processing ${request.url}`);
                
                // Wait for selector if specified
                if (waitForSelector) {
                    try {
                        await page.waitForSelector(waitForSelector, { timeout: 10000 });
                    } catch (error) {
                        log.warning(`Selector ${waitForSelector} not found on ${request.url}`);
                    }
                }

                // Extract data based on selector
                let data = {};
                
                if (selector) {
                    try {
                        data.extractedData = await page.$$eval(selector, elements => 
                            elements.map(el => ({
                                text: el.textContent?.trim(),
                                html: el.innerHTML,
                                attributes: Array.from(el.attributes).reduce((acc, attr) => {
                                    acc[attr.name] = attr.value;
                                    return acc;
                                }, {})
                            }))
                        );
                    } catch (error) {
                        log.warning(`Failed to extract data with selector ${selector}: ${error.message}`);
                        data.extractedData = [];
                    }
                } else {
                    // Default extraction - title and basic page info
                    data.title = await page.title();
                    data.url = request.url;
                    data.text = await page.textContent('body');
                }

                // Take screenshot if requested
                if (screenshot) {
                    try {
                        data.screenshot = await page.screenshot({ 
                            encoding: 'base64',
                            fullPage: false 
                        });
                    } catch (error) {
                        log.warning(`Failed to take screenshot: ${error.message}`);
                    }
                }

                results.push(data);
            },
            failedRequestHandler({ request, log }) {
                log.error(`Request ${request.url} failed`);
                results.push({
                    url: request.url,
                    error: 'Request failed',
                    success: false
                });
            }
        });

        // Add URLs to the crawler
        await crawler.addRequests(urls.map(url => ({ url })));
        
        // Run the crawler
        await crawler.run();

        res.json({
            success: true,
            totalProcessed: results.length,
            results: results
        });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Simple page content extraction endpoint
app.post('/extract', async (req, res) => {
    try {
        const { url, selector, waitForSelector = null } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const crawler = new PlaywrightCrawler({
            maxRequestsPerCrawl: 1,
            headless: true,
            launchContext: {
                launchOptions: {
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            },
            async requestHandler({ page, request, log }) {
                if (waitForSelector) {
                    try {
                        await page.waitForSelector(waitForSelector, { timeout: 10000 });
                    } catch (error) {
                        log.warning(`Selector ${waitForSelector} not found`);
                    }
                }

                const result = {
                    url: request.url,
                    title: await page.title(),
                    timestamp: new Date().toISOString()
                };

                if (selector) {
                    try {
                        result.data = await page.$$eval(selector, elements => 
                            elements.map(el => ({
                                text: el.textContent?.trim(),
                                html: el.innerHTML
                            }))
                        );
                    } catch (error) {
                        result.data = [];
                        result.error = `Selector not found: ${selector}`;
                    }
                } else {
                    result.content = await page.textContent('body');
                }

                res.json({
                    success: true,
                    ...result
                });
            },
            failedRequestHandler({ request }) {
                res.status(500).json({
                    success: false,
                    error: `Failed to load ${request.url}`
                });
            }
        });

        await crawler.addRequests([{ url }]);
        await crawler.run();

    } catch (error) {
        console.error('Extraction error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// AI-focused endpoint: Get page analysis data (screenshot + HTML)
app.post('/analyze', async (req, res) => {
    try {
        const { 
            url, 
            waitForSelector = null, // Optional: if not provided, waits for network idle instead
            fullPage = false,
            viewportWidth = 1280,
            viewportHeight = 720
        } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        let result = {
            url: url,
            success: false,
            error: 'Analysis not completed - no request processed'
        };

        const crawler = new PlaywrightCrawler({
            maxRequestsPerCrawl: 1,
            headless: true,
            requestHandlerTimeoutSecs: 120, // Increase timeout to 2 minutes
            launchContext: {
                launchOptions: {
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            },
            async requestHandler({ page, request, log }) {
                try {
                    log.info(`Analyzing page: ${request.url}`);
                    
                    // Set viewport
                    await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

                                    // Wait for selector if specified, but don't fail if it doesn't exist
                let selectorFound = false;
                if (waitForSelector) {
                    try {
                        await page.waitForSelector(waitForSelector, { timeout: 15000 });
                        log.info(`Successfully waited for selector: ${waitForSelector}`);
                        selectorFound = true;
                    } catch (error) {
                        log.warning(`Selector ${waitForSelector} not found within 15s, continuing with page load anyway`);
                        // Still try to wait for basic page load
                        try {
                            await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
                            log.info('Page DOM content loaded');
                        } catch (loadError) {
                            log.warning('DOM content load timeout, continuing anyway');
                        }
                    }
                } else {
                    // No specific selector - wait for network to be mostly idle
                    try {
                        await page.waitForLoadState('networkidle', { timeout: 30000 });
                        log.info('Page network activity settled');
                    } catch (error) {
                        log.warning('Network idle timeout, continuing anyway');
                        // Fallback to DOM content loaded
                        try {
                            await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
                            log.info('Page DOM content loaded as fallback');
                        } catch (loadError) {
                            log.warning('DOM content load timeout, continuing anyway');
                        }
                    }
                }

                                    // Give page additional time to fully render dynamic content
                // Use longer wait if selector wasn't found to give more time for dynamic content
                const waitTime = selectorFound ? 2000 : 5000;
                await page.waitForTimeout(waitTime);
                log.info(`Waited ${waitTime}ms for dynamic content to load`);

                    // Get page title
                    const title = await page.title();
                    log.info(`Page title: ${title}`);

                                    // Get clean HTML (remove scripts, styles for AI analysis)
                let html = '';
                let htmlExtractionMethod = 'unknown';
                
                // Try multiple strategies to get HTML content
                try {
                    // Strategy 1: Clean HTML with scripts/styles removed
                    html = await page.evaluate(() => {
                        // Clone the document to avoid modifying the original
                        const clone = document.cloneNode(true);
                        // Remove script and style tags for cleaner AI analysis
                        const scripts = clone.querySelectorAll('script, style, noscript');
                        scripts.forEach(el => el.remove());
                        return clone.documentElement.outerHTML;
                    });
                    htmlExtractionMethod = 'clean_html';
                    log.info(`Clean HTML extracted, length: ${html.length} characters`);
                } catch (error) {
                    log.warning(`Failed to extract clean HTML: ${error.message}`);
                    
                    try {
                        // Strategy 2: Full page content
                        html = await page.content();
                        htmlExtractionMethod = 'full_content';
                        log.info(`Full page content extracted, length: ${html.length} characters`);
                    } catch (contentError) {
                        log.warning(`Failed to get page content: ${contentError.message}`);
                        
                        try {
                            // Strategy 3: Just the body content
                            html = await page.evaluate(() => {
                                return document.body ? document.body.outerHTML : document.documentElement.outerHTML;
                            });
                            htmlExtractionMethod = 'body_content';
                            log.info(`Body content extracted, length: ${html.length} characters`);
                        } catch (bodyError) {
                            log.error(`All HTML extraction methods failed: ${bodyError.message}`);
                            html = '<html><body>HTML extraction failed</body></html>';
                            htmlExtractionMethod = 'extraction_failed';
                        }
                    }
                }

                    // Get screenshot as base64
                    let screenshot = '';
                    try {
                        screenshot = await page.screenshot({ 
                            encoding: 'base64',
                            fullPage: fullPage,
                            type: 'png'
                        });
                        log.info(`Screenshot captured, size: ${screenshot.length} characters`);
                    } catch (error) {
                        log.error(`Failed to capture screenshot: ${error.message}`);
                    }

                    // Get basic page structure info
                    let pageInfo = {};
                    try {
                        pageInfo = await page.evaluate(() => {
                            return {
                                hasImages: document.images.length > 0,
                                hasLinks: document.links.length > 0,
                                hasForms: document.forms.length > 0,
                                hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
                                hasLists: document.querySelectorAll('ul, ol').length > 0,
                                hasTables: document.querySelectorAll('table').length > 0,
                                totalElements: document.querySelectorAll('*').length
                            };
                        });
                        log.info(`Page info extracted: ${JSON.stringify(pageInfo)}`);
                    } catch (error) {
                        log.error(`Failed to extract page info: ${error.message}`);
                    }

                                    // Build successful result
                result = {
                    success: true,
                    url: request.url,
                    title: title,
                    timestamp: new Date().toISOString(),
                    viewport: { width: viewportWidth, height: viewportHeight },
                    html: html,
                    screenshot: screenshot,
                    pageInfo: pageInfo,
                    extractionInfo: {
                        waitForSelector: waitForSelector || null,
                        selectorFound: selectorFound,
                        htmlExtractionMethod: htmlExtractionMethod,
                        htmlLength: html.length
                    }
                };

                    log.info(`Analysis completed successfully for ${request.url}`);

                } catch (error) {
                    log.error(`Error in requestHandler: ${error.message}`);
                    result = {
                        success: false,
                        url: request.url,
                        error: `Analysis failed - Request handler error: ${error.message}`,
                        errorType: 'REQUEST_HANDLER_ERROR',
                        timestamp: new Date().toISOString()
                    };
                }
            },
            failedRequestHandler({ request, log }) {
                log.error(`Failed to analyze ${request.url}`);
                result = {
                    success: false,
                    url: request.url,
                    error: 'Analysis failed - Unable to load page (network or browser error)',
                    errorType: 'PAGE_LOAD_FAILED',
                    timestamp: new Date().toISOString()
                };
            }
        });

        try {
            await crawler.addRequests([{ url }]);
            await crawler.run();
        } catch (crawlerError) {
            console.error('Crawler execution error:', crawlerError);
            result = {
                success: false,
                url: url,
                error: `Analysis failed - Crawler error: ${crawlerError.message}`,
                errorType: 'CRAWLER_ERROR',
                timestamp: new Date().toISOString()
            };
        }

        // Always return the result, whether successful or not
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            success: false,
            error: `Analysis failed - Server error: ${error.message}`,
            errorType: 'SERVER_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});

// AI-focused endpoint: Scrape with AI-generated selectors
app.post('/scrape-with-selectors', async (req, res) => {
    try {
        const { 
            url, 
            selectors,
            waitForSelector = null,
            extractAttributes = false,
            takeScreenshot = false
        } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        if (!selectors || typeof selectors !== 'object') {
            return res.status(400).json({ 
                error: 'Selectors object is required (e.g., {"title": "h1", "price": ".price"})' 
            });
        }

        let result = {};

        const crawler = new PlaywrightCrawler({
            maxRequestsPerCrawl: 1,
            headless: true,
            launchContext: {
                launchOptions: {
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            },
            async requestHandler({ page, request, log }) {
                log.info(`Scraping with selectors: ${request.url}`);
                
                // Wait for selector if specified
                if (waitForSelector) {
                    try {
                        await page.waitForSelector(waitForSelector, { timeout: 10000 });
                    } catch (error) {
                        log.warning(`Wait selector ${waitForSelector} not found, continuing anyway`);
                    }
                }

                // Give page time to load
                await page.waitForTimeout(1000);

                const extractedData = {};
                const errors = {};

                // Process each selector
                for (const [key, selector] of Object.entries(selectors)) {
                    try {
                        log.info(`Extracting data for "${key}" using selector: ${selector}`);
                        
                        const elements = await page.$$(selector);
                        
                        if (elements.length === 0) {
                            log.warning(`No elements found for selector: ${selector}`);
                            extractedData[key] = [];
                            continue;
                        }

                        const data = await page.$$eval(selector, (elements, extractAttributes) => {
                            return elements.map(el => {
                                const item = {
                                    text: el.textContent?.trim() || '',
                                    html: el.innerHTML?.trim() || ''
                                };
                                
                                if (extractAttributes && el.attributes.length > 0) {
                                    item.attributes = {};
                                    Array.from(el.attributes).forEach(attr => {
                                        item.attributes[attr.name] = attr.value;
                                    });
                                }
                                
                                return item;
                            });
                        }, extractAttributes);

                        extractedData[key] = data;
                        log.info(`Successfully extracted ${data.length} items for "${key}"`);
                        
                    } catch (error) {
                        log.error(`Error extracting data for "${key}": ${error.message}`);
                        errors[key] = error.message;
                        extractedData[key] = [];
                    }
                }

                result = {
                    url: request.url,
                    title: await page.title(),
                    timestamp: new Date().toISOString(),
                    selectors: selectors,
                    extractedData: extractedData,
                    errors: Object.keys(errors).length > 0 ? errors : null,
                    summary: {
                        totalSelectors: Object.keys(selectors).length,
                        successfulExtractions: Object.keys(extractedData).filter(key => 
                            extractedData[key] && extractedData[key].length > 0
                        ).length,
                        failedExtractions: Object.keys(errors).length
                    }
                };

                // Take screenshot if requested
                if (takeScreenshot) {
                    try {
                        result.screenshot = await page.screenshot({ 
                            encoding: 'base64',
                            fullPage: false,
                            type: 'png'
                        });
                    } catch (error) {
                        log.warning(`Failed to take screenshot: ${error.message}`);
                    }
                }
            },
            failedRequestHandler({ request, log }) {
                log.error(`Failed to scrape ${request.url}`);
                result = {
                    url: request.url,
                    error: 'Failed to load page',
                    success: false
                };
            }
        });

        await crawler.addRequests([{ url }]);
        await crawler.run();

        if (result.error) {
            return res.status(500).json(result);
        }

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get API info
app.get('/', (req, res) => {
    res.json({
        name: 'Crawlee API Server',
        version: '1.0.0',
        endpoints: {
            'POST /analyze': 'Get page screenshot and HTML for AI analysis',
            'POST /scrape-with-selectors': 'Scrape using AI-generated selectors',
            'POST /scrape': 'Scrape multiple URLs with custom selectors',
            'POST /extract': 'Extract content from a single URL',
            'GET /health': 'Health check endpoint'
        },
        documentation: {
            analyze: {
                description: 'Get page screenshot and HTML for AI analysis',
                parameters: {
                    url: 'URL to analyze (required)',
                    waitForSelector: 'Wait for specific selector before analysis (optional - if not provided, waits for network idle)',
                    fullPage: 'Take full page screenshot (default: false)',
                    viewportWidth: 'Browser viewport width (default: 1280)',
                    viewportHeight: 'Browser viewport height (default: 720)'
                },
                returns: {
                    screenshot: 'Base64 encoded PNG screenshot',
                    html: 'Clean HTML content (scripts/styles removed)',
                    pageInfo: 'Basic page structure information',
                    title: 'Page title',
                    url: 'Processed URL',
                    extractionInfo: 'Information about selector waiting and HTML extraction method used'
                },
                examples: {
                    'Basic usage (no selector)': {
                        url: 'https://example.com'
                    },
                    'With specific selector': {
                        url: 'https://example.com',
                        waitForSelector: '.content'
                    },
                    'Full page screenshot': {
                        url: 'https://example.com',
                        fullPage: true
                    }
                }
            },
            scrapeWithSelectors: {
                description: 'Scrape using AI-generated selectors',
                parameters: {
                    url: 'URL to scrape (required)',
                    selectors: 'Object with key-value pairs of field names and CSS selectors (required)',
                    waitForSelector: 'Wait for specific selector before scraping (optional)',
                    extractAttributes: 'Include element attributes in results (default: false)',
                    takeScreenshot: 'Include screenshot in results (default: false)'
                },
                example: {
                    url: 'https://example.com',
                    selectors: {
                        title: 'h1',
                        price: '.price',
                        description: '.product-description p'
                    }
                }
            },
            scrape: {
                description: 'Scrape multiple URLs',
                parameters: {
                    urls: 'Array of URLs to scrape (required)',
                    selector: 'CSS selector for data extraction (optional)',
                    maxRequestsPerCrawl: 'Maximum number of requests (default: 10)',
                    headless: 'Run browser in headless mode (default: true)',
                    waitForSelector: 'Wait for specific selector before extraction (optional)',
                    screenshot: 'Take screenshot of each page (default: false)'
                }
            },
            extract: {
                description: 'Extract content from a single URL',
                parameters: {
                    url: 'URL to extract content from (required)',
                    selector: 'CSS selector for data extraction (optional)',
                    waitForSelector: 'Wait for specific selector before extraction (optional)'
                }
            }
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crawlee API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API documentation: http://localhost:${PORT}/`);
}); 