const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PlaywrightCrawler, CriticalError } = require('crawlee');
const CronManager = require('./cron');
const createCronRoutes = require('./routes/cronRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize CronManager
const cronManager = new CronManager();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount cron routes
app.use('/cron', createCronRoutes(cronManager));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        cron: cronManager.getStatus()
    });
});

// AI-focused endpoint: Get page analysis data (screenshot + HTML) - WORKING VERSION
app.post('/analyze', async (req, res) => {
    const { 
        url, 
        waitForSelector = null,
        timeout = 30000 
    } = req.body;

    console.log(`\n=== New analyze request ===`);
    console.log(`URL: ${url}`);
    console.log(`Wait for selector: ${waitForSelector}`);
    console.log(`Timeout: ${timeout}`);

    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required',
            url: url || null
        });
    }

    let crawler = null;
    
    try {
        // Use the exact working configuration from our test
        // Container-specific configuration
        const isContainer = process.env.NODE_ENV === 'production';
        
        crawler = new PlaywrightCrawler({
            headless: true,
            maxConcurrency: 1,
            useSessionPool: false,
            requestHandlerTimeoutSecs: Math.ceil(timeout / 1000) + 5,
            navigationTimeoutSecs: Math.ceil(timeout / 1000),
            
            // Force memory storage in containers to avoid persistent storage issues
            ...(isContainer && {
                requestQueueOptions: {
                    forceCloud: false,
                    clientOptions: {
                        forceMemoryStorage: true
                    }
                }
            }),
            
            launchContext: {
                launchOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        ...(isContainer ? [
                            '--disable-gpu',
                            '--no-zygote',
                            '--single-process',
                            '--disable-background-timer-throttling',
                            '--disable-backgrounding-occluded-windows',
                            '--disable-renderer-backgrounding',
                            '--disable-features=TranslateUI',
                            '--disable-ipc-flooding-protection'
                        ] : [])
                    ]
                }
            },
            
            requestHandler: async ({ page, request, log }) => {
                try {
                    console.log(`=== REQUEST HANDLER CALLED ===`);
                    console.log(`Processing URL: ${request.url}`);
                    log.info(`Processing ${request.url}`);
                    
                    await page.setViewportSize({ width: 1280, height: 720 });
                    
                    // Wait strategy
                    if (waitForSelector) {
                        try {
                            await page.waitForSelector(waitForSelector, { 
                                timeout: timeout,
                                state: 'visible'
                            });
                            log.info(`Found selector: ${waitForSelector}`);
                        } catch (selectorError) {
                            log.info(`Selector ${waitForSelector} not found, continuing anyway`);
                        }
                    } else {
                        try {
                            await page.waitForLoadState('networkidle', { timeout: timeout });
                            log.info('Network idle detected');
                        } catch (idleError) {
                            await page.waitForLoadState('domcontentloaded', { timeout: timeout });
                            log.info('DOM content loaded');
                        }
                    }

                    await page.waitForTimeout(1000);

                    const title = await page.title();
                    const pageInfo = await page.evaluate(() => ({
                        title: document.title,
                        url: window.location.href,
                        timestamp: new Date().toISOString()
                    }));

                    const html = await page.evaluate(() => {
                        try {
                            const clone = document.documentElement.cloneNode(true);
                            const scripts = clone.querySelectorAll('script, style, noscript, link[rel="stylesheet"]');
                            scripts.forEach(el => el.remove());
                            return clone.outerHTML || '';
                        } catch (e) {
                            return document.documentElement.outerHTML || '';
                        }
                    });

                    const screenshot = await page.screenshot({ 
                        type: 'png',
                        fullPage: false
                    });

                    global.crawleeResult = {
                        success: true,
                        url: request.url,
                        title: title,
                        pageInfo: pageInfo,
                        html: html,
                        screenshot: screenshot.toString('base64'),
                        timestamp: new Date().toISOString()
                    };

                    log.info(`Successfully processed ${request.url}: ${title}`);
                    
                } catch (error) {
                    console.error('Request handler error:', error);
                    global.crawleeResult = {
                        success: false,
                        url: request.url,
                        error: `Request handler error: ${error.message}`,
                        timestamp: new Date().toISOString()
                    };
                    throw new CriticalError(`Analysis failed: ${error.message}`);
                }
            },

            errorHandler: async ({ request, error, log }) => {
                log.error(`Error processing ${request.url}: ${error.message}`);
                global.crawleeResult = {
                    success: false,
                    url: request.url,
                    error: `Processing error: ${error.message}`,
                    timestamp: new Date().toISOString()
                };
                return false;
            },

            failedRequestHandler: async ({ request, error, log }) => {
                log.error(`Failed to process ${request.url} after retries: ${error.message}`);
                global.crawleeResult = {
                    success: false,
                    url: request.url,
                    error: `Analysis failed - ${error.message}`,
                    timestamp: new Date().toISOString()
                };
                throw new CriticalError(`Analysis failed - ${error.message}`);
            }
        });

        // Clear any previous results
        global.crawleeResult = null;

        console.log('Starting crawler...');
        
        // In container environments, validate browser can start
        if (process.env.NODE_ENV === 'production') {
            console.log('Container environment detected, pre-validating browser startup...');
            try {
                const testBrowser = await crawler.launchContext.launchOptions();
                console.log('Browser startup validation successful');
            } catch (browserError) {
                console.error('Browser startup validation failed:', browserError.message);
                throw new Error(`Browser cannot start in container: ${browserError.message}`);
            }
        }
        
        console.log(`Running crawler with URL: ${url}`);
        await crawler.run([url]);
        
        console.log('Crawler finished, checking results...');
        
        // Get some statistics for debugging
        const stats = await crawler.getData();
        console.log('Crawler statistics:', JSON.stringify(stats, null, 2));

        // Check results
        const result = global.crawleeResult;
        if (!result) {
            console.log('No results found in global.crawleeResult');
            throw new Error('No results returned from crawler');
        }

        global.crawleeResult = null;
        console.log(`Analysis completed: success=${result.success}`);
        return res.json(result);

    } catch (error) {
        console.error('Analysis error:', error);
        
        const storedResult = global.crawleeResult;
        if (storedResult && !storedResult.success) {
            global.crawleeResult = null;
            return res.json(storedResult);
        }
        
        global.crawleeResult = null;
        return res.json({
            success: false,
            url: url,
            error: `Analysis failed - ${error.message}`,
            timestamp: new Date().toISOString()
        });
    } finally {
        // Cleanup
        if (crawler) {
            try {
                console.log('Cleaning up crawler...');
                crawler.stop('Request completed');
                await Promise.race([
                    crawler.teardown(),
                    new Promise(resolve => setTimeout(resolve, 3000))
                ]);
                console.log('Crawler cleanup completed');
            } catch (cleanupError) {
                console.error('Cleanup error (non-critical):', cleanupError.message);
            }
        }
        
        if (global.crawleeResult) {
            global.crawleeResult = null;
        }
    }
});

// API documentation endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Crawlee Web Scraping API with Cron Triggers',
        version: '1.0.0',
        endpoints: {
            health: {
                method: 'GET',
                path: '/health',
                description: 'Health check endpoint (includes cron status)'
            },
            analyze: {
                method: 'POST',
                path: '/analyze',
                description: 'Get page screenshot and HTML for AI analysis (WORKING VERSION)',
                parameters: {
                    url: 'URL to analyze (required)',
                    waitForSelector: 'Wait for specific selector before analysis (optional)',
                    timeout: 'Timeout for analysis (default: 30000)'
                },
                returns: {
                    html: 'Cleaned HTML content (scripts/styles removed)',
                    screenshot: 'Base64 encoded screenshot',
                    pageInfo: 'Basic page structure information',
                    title: 'Page title',
                    url: 'Processed URL'
                }
            },
            cron: {
                '/cron/status': 'GET - Cron service status',
                '/cron/examples': 'GET - Common cron schedule patterns',
                '/cron/jobs': 'GET - List all cron jobs | POST - Create new cron job',
                '/cron/jobs/:cronId/:action': 'PATCH - Start/stop specific cron job (action: start|stop)',
                '/cron/jobs/:cronId': 'DELETE - Delete specific cron job',
                '/cron/trigger/:webhookId': 'POST - Manually trigger single webhook',
                '/cron/trigger-multiple': 'POST - Manually trigger multiple webhooks'
            }
        },
        cronManager: cronManager.getStatus()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Crawlee server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
    console.log(`Use POST /analyze with { "url": "https://example.com" }`);
}); 