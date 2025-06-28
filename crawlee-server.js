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

// YouTube anti-detection utilities
const getRandomUserAgent = () => {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const getRandomDelay = (min = 2000, max = 5000) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

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
        
        // Add detailed logging for debugging
        console.log('Container environment:', process.env.NODE_ENV === 'production')
        
        console.log(`Running crawler with URL: ${url}`);
        
        // Add debugging before crawler run
        console.log('About to start crawler.run()...');
        const startTime = Date.now();
        
        await crawler.run([url]);
        
        const endTime = Date.now();
        console.log(`Crawler finished after ${endTime - startTime}ms, checking results...`);
        
        // Get some statistics for debugging
        const stats = await crawler.getData();
        console.log('Crawler statistics:', JSON.stringify(stats, null, 2));
        
        // Check crawler state
        console.log('Crawler stats summary:');
        console.log('- Total requests:', stats.requestsFinished + stats.requestsFailed + stats.requestsFailedPerMinute);
        console.log('- Requests finished:', stats.requestsFinished);
        console.log('- Requests failed:', stats.requestsFailed);
        console.log('- Retry histogram:', JSON.stringify(stats.retryHistogram));

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

// YouTube Channel Transcript Scraper with Anti-Detection
app.post('/youtube-transcripts', async (req, res) => {
    const { 
        channelId,
        channelHandle,
        maxVideos = 100,
        timeout = 60000,
        includeShorts = false
    } = req.body;

    console.log(`\n=== YouTube Transcript Scraper Request ===`);
    console.log(`Channel ID: ${channelId}`);
    console.log(`Channel Handle: ${channelHandle}`);
    console.log(`Max Videos: ${maxVideos}`);
    console.log(`Include Shorts: ${includeShorts}`);

    if (!channelId && !channelHandle) {
        return res.status(400).json({ 
            success: false, 
            error: 'Either channelId or channelHandle is required'
        });
    }

    let crawler = null;
    const results = {
        success: false,
        channelInfo: null,
        videos: [],
        errors: [],
        totalProcessed: 0
    };

    try {
        const isContainer = process.env.NODE_ENV === 'production';
        
        crawler = new PlaywrightCrawler({
            headless: true,
            maxConcurrency: 1,
            useSessionPool: false,
            requestHandlerTimeoutSecs: Math.ceil(timeout / 1000) + 30,
            navigationTimeoutSecs: Math.ceil(timeout / 1000),
            
            launchContext: {
                launchOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-features=VizDisplayCompositor',
                        '--disable-web-security',
                        '--disable-features=TranslateUI',
                        '--disable-ipc-flooding-protection',
                        '--no-first-run',
                        '--no-default-browser-check',
                        '--disable-default-apps',
                        '--disable-popup-blocking',
                        '--disable-prompt-on-repost',
                        '--disable-hang-monitor',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-background-timer-throttling',
                        '--force-color-profile=srgb',
                        '--metrics-recording-only',
                        '--disable-background-networking',
                        `--user-agent=${getRandomUserAgent()}`,
                        ...(isContainer ? [
                            '--disable-gpu',
                            '--no-zygote',
                            '--single-process'
                        ] : [])
                    ]
                }
            },

            preNavigationHooks: [
                async ({ page, request }) => {
                    try {
                        // Set random user agent - use correct Playwright API
                        const userAgent = getRandomUserAgent();
                        await page.context().addInitScript(`
                            Object.defineProperty(navigator, 'userAgent', {
                                get: () => '${userAgent}',
                            });
                        `);
                        
                        // Set viewport to common resolution
                        await page.setViewportSize({ 
                            width: 1920 + Math.floor(Math.random() * 100), 
                            height: 1080 + Math.floor(Math.random() * 100) 
                        });

                        // Override webdriver detection
                        await page.addInitScript(() => {
                            Object.defineProperty(navigator, 'webdriver', {
                                get: () => undefined,
                            });
                            
                            // Remove automation indicators
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
                            
                            // Override plugins
                            Object.defineProperty(navigator, 'plugins', {
                                get: () => [1, 2, 3, 4, 5],
                            });
                            
                            // Override languages
                            Object.defineProperty(navigator, 'languages', {
                                get: () => ['en-US', 'en'],
                            });
                            
                            // Override permissions
                            const originalQuery = window.navigator.permissions.query;
                            window.navigator.permissions.query = (parameters) => (
                                parameters.name === 'notifications' ?
                                    Promise.resolve({ state: Notification.permission }) :
                                    originalQuery(parameters)
                            );
                        });

                        // Set extra headers to look more like a real browser
                        await page.setExtraHTTPHeaders({
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'DNT': '1',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
                            'User-Agent': userAgent
                        });
                    } catch (error) {
                        console.log('Pre-navigation hook error (non-critical):', error.message);
                    }
                }
            ],
            
            requestHandler: async ({ page, request, log }) => {
                try {
                    console.log(`Processing: ${request.url}`);
                    
                    // Add random delay before processing
                    await page.waitForTimeout(getRandomDelay(1000, 3000));

                    if (request.url.includes('/videos')) {
                        // Channel videos page
                        await handleChannelVideosPage(page, request, log, maxVideos, includeShorts, results);
                    } else if (request.url.includes('/watch?v=')) {
                        // Individual video page
                        await handleVideoPage(page, request, log, results);
                    } else {
                        // Channel main page - redirect to videos
                        const channelUrl = buildChannelUrl(channelId, channelHandle);
                        await page.goto(`${channelUrl}/videos`, { 
                            waitUntil: 'networkidle',
                            timeout: timeout 
                        });
                        await handleChannelVideosPage(page, request, log, maxVideos, includeShorts, results);
                    }

                } catch (error) {
                    console.error('Request handler error:', error);
                    log.error(`Request handler error: ${error.message}`);
                    results.errors.push(`Error processing ${request.url}: ${error.message}`);
                    // Don't throw, just continue with errors logged
                }
            },

            errorHandler: async ({ request, error, log }) => {
                log.error(`Error processing ${request.url}: ${error.message}`);
                results.errors.push(`Processing error for ${request.url}: ${error.message}`);
                return false;
            }
        });

        // Build initial URL
        const channelUrl = buildChannelUrl(channelId, channelHandle);
        console.log(`Starting crawl of: ${channelUrl}`);

        // Start crawling
        await crawler.run([`${channelUrl}/videos`]);

        results.success = true;
        results.totalProcessed = results.videos.length;
        
        console.log(`YouTube scraping completed. Found ${results.videos.length} videos with transcripts.`);
        return res.json(results);

    } catch (error) {
        console.error('YouTube scraping error:', error);
        results.errors.push(`Main error: ${error.message}`);
        return res.json(results);
    } finally {
        if (crawler) {
            try {
                await crawler.teardown();
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
            }
        }
    }
});

// Helper function to build channel URL
function buildChannelUrl(channelId, channelHandle) {
    if (channelId) {
        return `https://www.youtube.com/channel/${channelId}`;
    } else if (channelHandle) {
        // Handle both @username and username formats
        const handle = channelHandle.startsWith('@') ? channelHandle : `@${channelHandle}`;
        return `https://www.youtube.com/${handle}`;
    }
    throw new Error('No valid channel identifier provided');
}

// Handle channel videos page
async function handleChannelVideosPage(page, request, log, maxVideos, includeShorts, results) {
    try {
        console.log('Processing channel videos page...');
        
        // Wait for page to load
        await page.waitForSelector('#contents', { timeout: 30000 });
        await page.waitForTimeout(getRandomDelay(2000, 4000));

        // Get channel info
        try {
            const channelInfo = await page.evaluate(() => {
                const channelName = document.querySelector('#channel-name #text')?.textContent?.trim() ||
                                 document.querySelector('#owner-name a')?.textContent?.trim() ||
                                 document.querySelector('yt-formatted-string.ytd-channel-name')?.textContent?.trim();
                
                const subscriberCount = document.querySelector('#owner-sub-count')?.textContent?.trim() ||
                                      document.querySelector('.yt-subscription-button-subscriber-count-branded-horizontal')?.textContent?.trim();

                return {
                    name: channelName,
                    subscribers: subscriberCount,
                    url: window.location.href
                };
            });
            results.channelInfo = channelInfo;
            console.log('Channel info:', channelInfo);
        } catch (e) {
            console.log('Could not extract channel info:', e.message);
        }

        // Scroll to load more videos
        let videoLinks = new Set();
        let scrollAttempts = 0;
        const maxScrollAttempts = 10;

        while (videoLinks.size < maxVideos && scrollAttempts < maxScrollAttempts) {
            // Extract video links
            const newLinks = await page.evaluate((includeShorts) => {
                const links = [];
                const videoElements = document.querySelectorAll('a[href*="/watch?v="]');
                
                videoElements.forEach(element => {
                    const href = element.href;
                    
                    // Try multiple selectors for video title
                    let title = element.querySelector('#video-title')?.textContent?.trim() ||
                               element.querySelector('#video-title-link')?.textContent?.trim() ||
                               element.querySelector('h3')?.textContent?.trim() ||
                               element.querySelector('.ytd-rich-grid-media #video-title')?.textContent?.trim() ||
                               element.getAttribute('title') ||
                               element.getAttribute('aria-label');
                    
                    // Clean up title - remove duration and other metadata
                    if (title) {
                        // Remove duration patterns like "45:07", "1:23:45", etc.
                        title = title.replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, '').trim();
                        // Remove "Now playing" text
                        title = title.replace(/Now playing\s*/i, '').trim();
                        // Remove extra whitespace
                        title = title.replace(/\s+/g, ' ').trim();
                    }
                    
                    // Check if it's a short video
                    const isShort = element.closest('[is-short]') || 
                                  element.closest('.ytd-rich-grid-slim-media') ||
                                  element.closest('#shorts-container') ||
                                  href.includes('/shorts/');
                    
                    // Only include if we have a meaningful title (not just duration)
                    if (href && title && title.length > 3 && (includeShorts || !isShort)) {
                        links.push({
                            url: href.split('&')[0], // Clean URL
                            title: title,
                            isShort: isShort
                        });
                    }
                });
                
                return links;
            }, includeShorts);

            newLinks.forEach(link => {
                if (videoLinks.size < maxVideos) {
                    videoLinks.add(JSON.stringify(link));
                }
            });

            console.log(`Found ${videoLinks.size} videos so far...`);

            if (videoLinks.size >= maxVideos) break;

            // Scroll down to load more videos
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });

            await page.waitForTimeout(getRandomDelay(2000, 4000));
            scrollAttempts++;
        }

        // Convert back to objects and add to crawler queue
        const videoList = Array.from(videoLinks).map(link => JSON.parse(link)).slice(0, maxVideos);
        console.log(`Collected ${videoList.length} videos to process`);

        // Process each video for transcripts
        for (const video of videoList) {
            try {
                console.log(`Processing video: ${video.title}`);
                
                // Navigate with shorter timeout and better error handling
                await page.goto(video.url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 20000 
                });
                
                // Wait for page to stabilize
                await page.waitForTimeout(getRandomDelay(1000, 2000));

                // Extract transcript with timeout protection
                const transcriptPromise = extractTranscript(page);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transcript extraction timeout')), 30000)
                );
                
                const transcript = await Promise.race([transcriptPromise, timeoutPromise])
                    .catch(error => {
                        console.log(`Transcript extraction failed for ${video.title}: ${error.message}`);
                        return null;
                    });
                
                results.videos.push({
                    title: video.title,
                    url: video.url,
                    isShort: video.isShort,
                    transcript: transcript,
                    hasTranscript: !!transcript
                });

                console.log(`✅ Completed ${video.title} - transcript: ${transcript ? 'found' : 'not found'}`);

                // Random delay between videos to avoid detection
                await page.waitForTimeout(getRandomDelay(2000, 4000));

            } catch (videoError) {
                console.error(`Error processing video ${video.title}:`, videoError.message);
                results.errors.push(`Video ${video.title}: ${videoError.message}`);
                
                results.videos.push({
                    title: video.title,
                    url: video.url,
                    isShort: video.isShort,
                    transcript: null,
                    hasTranscript: false,
                    error: videoError.message
                });
            }
        }

    } catch (error) {
        console.error('Error in handleChannelVideosPage:', error);
        throw error;
    }
}

// Extract transcript from video page
async function extractTranscript(page) {
    try {
        console.log('Starting transcript extraction...');
        
        // Wait for page basic elements, not the video itself
        await page.waitForSelector('#movie_player, #player-container, #player', { timeout: 10000 });
        console.log('Player container found');
        
        // Wait a bit for page to stabilize
        await page.waitForTimeout(2000);
        
        // Try multiple approaches to find and open transcript
        let transcriptOpened = false;
        
        // Method 1: Look for direct transcript button
        const transcriptSelectors = [
            'button[aria-label*="transcript" i]',
            'button[aria-label*="Transcript" i]',
            'yt-button-renderer[aria-label*="transcript" i]',
            '[data-tooltip-text*="transcript" i]'
        ];

        for (const selector of transcriptSelectors) {
            try {
                const button = await page.$(selector);
                if (button) {
                    console.log(`Found transcript button with selector: ${selector}`);
                    await button.click();
                    await page.waitForTimeout(2000);
                    transcriptOpened = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Method 2: Try the three-dot menu approach
        if (!transcriptOpened) {
            try {
                console.log('Trying three-dot menu approach...');
                const moreButton = await page.$('button[aria-label*="More actions"], button[aria-label*="more actions"], yt-icon-button[aria-label*="More actions"]');
                if (moreButton) {
                    await moreButton.click();
                    await page.waitForTimeout(1000);
                    
                    // Look for "Show transcript" or "Open transcript" option
                    const transcriptMenuItems = [
                        'text="Show transcript"',
                        'text="Open transcript"', 
                        '[role="menuitem"]:has-text("transcript")',
                        'yt-formatted-string:has-text("transcript")'
                    ];
                    
                    for (const menuItem of transcriptMenuItems) {
                        try {
                            const item = await page.$(menuItem);
                            if (item) {
                                console.log(`Found transcript menu item: ${menuItem}`);
                                await item.click();
                                await page.waitForTimeout(2000);
                                transcriptOpened = true;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }
            } catch (e) {
                console.log('Three-dot menu approach failed:', e.message);
            }
        }

        // Method 3: Check if transcript panel is already visible
        if (!transcriptOpened) {
            console.log('Checking if transcript panel is already visible...');
            const existingTranscript = await page.$('#transcript, .ytd-transcript-renderer, [role="region"][aria-label*="transcript"]');
            if (existingTranscript) {
                console.log('Transcript panel already visible');
                transcriptOpened = true;
            }
        }

        if (!transcriptOpened) {
            console.log('Could not open transcript panel');
            return null;
        }

        // Wait for transcript content to load
        await page.waitForTimeout(3000);

        // Extract transcript text with multiple fallback strategies
        const transcript = await page.evaluate(() => {
            console.log('Evaluating transcript extraction...');
            
            // Strategy 1: Look for transcript container
            const transcriptContainers = [
                '#transcript',
                '.ytd-transcript-renderer',
                '[role="region"][aria-label*="transcript"]',
                '.ytd-transcript-segment-list-renderer',
                '[data-testid="transcript"]'
            ];

            for (const containerSelector of transcriptContainers) {
                const container = document.querySelector(containerSelector);
                if (container) {
                    console.log(`Found transcript container: ${containerSelector}`);
                    
                    // Look for individual segments
                    const segmentSelectors = [
                        '.ytd-transcript-segment-renderer',
                        '[role="button"].segment',
                        '.transcript-segment',
                        'div[data-start-time]'
                    ];
                    
                    for (const segmentSelector of segmentSelectors) {
                        const segments = container.querySelectorAll(segmentSelector);
                        if (segments.length > 0) {
                            console.log(`Found ${segments.length} transcript segments`);
                            return Array.from(segments).map(segment => {
                                // Try to extract timestamp
                                const timeElement = segment.querySelector('.ytd-transcript-segment-renderer [role="button"] div:first-child, .timestamp, [data-start-time]');
                                const time = timeElement ? timeElement.textContent?.trim() || timeElement.getAttribute('data-start-time') : '';
                                
                                // Extract text content
                                const textElement = segment.querySelector('.ytd-transcript-segment-renderer [role="button"] div:last-child, .text');
                                let text = textElement ? textElement.textContent?.trim() : segment.textContent?.trim();
                                
                                // Clean up text by removing timestamp if it's included
                                if (time && text) {
                                    text = text.replace(time, '').trim();
                                }
                                
                                return { time: time || '', text: text || '' };
                            }).filter(item => item.text && item.text.length > 0);
                        }
                    }
                    
                    // Fallback: get all text from container
                    const allText = container.textContent?.trim();
                    if (allText && allText.length > 50) {
                        console.log('Using fallback text extraction');
                        return allText;
                    }
                }
            }

            console.log('No transcript content found');
            return null;
        });

        if (transcript && transcript.length > 0) {
            console.log(`Successfully extracted transcript with ${Array.isArray(transcript) ? transcript.length : 'text'} segments`);
        } else {
            console.log('No transcript content extracted');
        }

        return transcript;

    } catch (error) {
        console.log('Transcript extraction error:', error.message);
        return null;
    }
}

// Handle individual video page (if needed)
async function handleVideoPage(page, request, log, results) {
    try {
        const transcript = await extractTranscript(page);
        
        const videoInfo = await page.evaluate(() => {
            const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() ||
                         document.querySelector('#title h1')?.textContent?.trim();
            return {
                title: title,
                url: window.location.href
            };
        });

        results.videos.push({
            ...videoInfo,
            transcript: transcript,
            hasTranscript: !!transcript
        });

    } catch (error) {
        console.error('Error in handleVideoPage:', error);
        throw error;
    }
}

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
            youtubeTranscripts: {
                method: 'POST',
                path: '/youtube-transcripts',
                description: 'Extract transcripts from YouTube channel videos with anti-detection measures',
                parameters: {
                    channelId: 'YouTube channel ID (e.g., UCxxxxxx) - required if channelHandle not provided',
                    channelHandle: 'YouTube channel handle (e.g., @username) - required if channelId not provided',
                    maxVideos: 'Maximum number of videos to process (default: 100)',
                    timeout: 'Timeout per request in milliseconds (default: 60000)',
                    includeShorts: 'Include YouTube Shorts videos (default: false)'
                },
                returns: {
                    success: 'Boolean indicating overall success',
                    channelInfo: 'Channel name, subscriber count, and URL',
                    videos: 'Array of video objects with title, URL, transcript data',
                    errors: 'Array of any errors encountered',
                    totalProcessed: 'Number of videos successfully processed'
                },
                antiDetection: [
                    'Random user agent rotation',
                    'Viewport randomization',
                    'WebDriver detection removal',
                    'Random delays between requests',
                    'Browser fingerprint masking',
                    'Realistic HTTP headers'
                ]
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