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

// Get API info
app.get('/', (req, res) => {
    res.json({
        name: 'Crawlee API Server',
        version: '1.0.0',
        endpoints: {
            'POST /scrape': 'Scrape multiple URLs with custom selectors',
            'POST /extract': 'Extract content from a single URL',
            'GET /health': 'Health check endpoint'
        },
        documentation: {
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