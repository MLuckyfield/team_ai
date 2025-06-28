const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001';

// Test function for YouTube transcript scraping
async function testYouTubeTranscripts() {
    console.log('=== Testing YouTube Transcript Scraper ===\n');

    // Test cases - you can modify these
    const testCases = [
        {
            name: 'Channel Handle Test',
            payload: {
                channelHandle: '@veritasium', // Popular science channel
                maxVideos: 5,
                includeShorts: false,
                timeout: 60000
            }
        },
        {
            name: 'Channel ID Test', 
            payload: {
                channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA', // Veritasium channel ID
                maxVideos: 3,
                includeShorts: true,
                timeout: 45000
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n--- ${testCase.name} ---`);
        console.log('Request payload:', JSON.stringify(testCase.payload, null, 2));
        
        try {
            const startTime = Date.now();
            
            const response = await axios.post(`${API_BASE_URL}/youtube-transcripts`, testCase.payload, {
                timeout: 300000, // 5 minute timeout for the HTTP request
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            console.log(`\n✅ Success! Completed in ${duration.toFixed(2)} seconds`);
            console.log('\n📊 Results Summary:');
            console.log(`- Success: ${response.data.success}`);
            console.log(`- Total videos processed: ${response.data.totalProcessed}`);
            console.log(`- Errors encountered: ${response.data.errors?.length || 0}`);
            
            if (response.data.channelInfo) {
                console.log(`\n📺 Channel Info:`);
                console.log(`- Name: ${response.data.channelInfo.name}`);
                console.log(`- Subscribers: ${response.data.channelInfo.subscribers}`);
                console.log(`- URL: ${response.data.channelInfo.url}`);
            }

            if (response.data.videos && response.data.videos.length > 0) {
                console.log(`\n🎥 Videos with transcripts:`);
                response.data.videos.forEach((video, index) => {
                    console.log(`\n${index + 1}. ${video.title}`);
                    console.log(`   URL: ${video.url}`);
                    console.log(`   Has transcript: ${video.hasTranscript ? '✅' : '❌'}`);
                    console.log(`   Is Short: ${video.isShort ? '✅' : '❌'}`);
                    
                    if (video.transcript && Array.isArray(video.transcript)) {
                        console.log(`   Transcript segments: ${video.transcript.length}`);
                        // Show first few lines of transcript
                        const preview = video.transcript.slice(0, 3).map(segment => 
                            `${segment.time}: ${segment.text}`
                        ).join('\n   ');
                        console.log(`   Preview:\n   ${preview}${video.transcript.length > 3 ? '\n   ...' : ''}`);
                    } else if (video.transcript) {
                        console.log(`   Transcript length: ${video.transcript.length} characters`);
                        console.log(`   Preview: ${video.transcript.substring(0, 100)}...`);
                    }
                    
                    if (video.error) {
                        console.log(`   Error: ${video.error}`);
                    }
                });
            }

            if (response.data.errors && response.data.errors.length > 0) {
                console.log(`\n⚠️ Errors encountered:`);
                response.data.errors.forEach((error, index) => {
                    console.log(`${index + 1}. ${error}`);
                });
            }

        } catch (error) {
            console.error(`\n❌ Error in ${testCase.name}:`);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Response:', JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                console.error('No response received:', error.message);
            } else {
                console.error('Request setup error:', error.message);
            }
        }

        console.log('\n' + '='.repeat(60));
    }
}

// Health check function
async function checkHealth() {
    try {
        const response = await axios.get(`${API_BASE_URL}/health`);
        console.log('✅ Server is healthy');
        console.log('Status:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Server health check failed:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    console.log('YouTube Transcript Scraper Test\n');
    
    // Check if server is running
    console.log('Checking server health...');
    const isHealthy = await checkHealth();
    
    if (!isHealthy) {
        console.log('\n❌ Server is not running. Please start the server first:');
        console.log('npm start');
        return;
    }

    // Run tests
    await testYouTubeTranscripts();
    
    console.log('\n🎉 Test completed!');
    console.log('\n💡 Usage Tips:');
    console.log('- Use channelHandle for @username format channels');
    console.log('- Use channelId for channel/UCxxxxxx format channels');
    console.log('- Set includeShorts: true to include YouTube Shorts');
    console.log('- Adjust maxVideos to control how many videos to process');
    console.log('- Increase timeout for channels with many videos');
    console.log('- The scraper includes anti-detection measures to avoid blocks');
}

// Handle script execution
if (require.main === module) {
    main().catch(error => {
        console.error('Script error:', error);
        process.exit(1);
    });
}

module.exports = { testYouTubeTranscripts, checkHealth }; 