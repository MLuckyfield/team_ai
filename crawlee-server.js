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
            waitForSelector = null, 
            fullPage = false,
            viewportWidth = 1280,
            viewportHeight = 720
        } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
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
                log.info(`Analyzing page: ${request.url}`);
                
                // Set viewport
                await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

                // Wait for selector if specified
                if (waitForSelector) {
                    try {
                        await page.waitForSelector(waitForSelector, { timeout: 10000 });
                        log.info(`Successfully waited for selector: ${waitForSelector}`);
                    } catch (error) {
                        log.warning(`Selector ${waitForSelector} not found, continuing anyway`);
                    }
                }

                // Give page time to fully load
                await page.waitForTimeout(2000);

                // Get page data for AI analysis
                result = {
                    url: request.url,
                    title: await page.title(),
                    timestamp: new Date().toISOString(),
                    viewport: { width: viewportWidth, height: viewportHeight },
                    // Get clean HTML (remove scripts, styles for AI analysis)
                    html: await page.evaluate(() => {
                        // Clone the document to avoid modifying the original
                        const clone = document.cloneNode(true);
                        // Remove script and style tags for cleaner AI analysis
                        const scripts = clone.querySelectorAll('script, style, noscript');
                        scripts.forEach(el => el.remove());
                        return clone.documentElement.outerHTML;
                    }),
                    // Get screenshot as base64
                    screenshot: await page.screenshot({ 
                        encoding: 'base64',
                        fullPage: fullPage,
                        type: 'png'
                    }),
                    // Get basic page structure info
                    pageInfo: await page.evaluate(() => {
                        return {
                            hasImages: document.images.length > 0,
                            hasLinks: document.links.length > 0,
                            hasForms: document.forms.length > 0,
                            hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
                            hasLists: document.querySelectorAll('ul, ol').length > 0,
                            hasTables: document.querySelectorAll('table').length > 0,
                            totalElements: document.querySelectorAll('*').length
                        };
                    })
                };
            },
            failedRequestHandler({ request, log }) {
                log.error(`Failed to analyze ${request.url}`);
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
        console.error('Analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
                    waitForSelector: 'Wait for specific selector before analysis (optional)',
                    fullPage: 'Take full page screenshot (default: false)',
                    viewportWidth: 'Browser viewport width (default: 1280)',
                    viewportHeight: 'Browser viewport height (default: 720)'
                },
                returns: {
                    screenshot: 'Base64 encoded PNG screenshot',
                    html: 'Clean HTML content (scripts/styles removed)',
                    pageInfo: 'Basic page structure information',
                    title: 'Page title',
                    url: 'Processed URL'
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