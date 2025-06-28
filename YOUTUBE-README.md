# YouTube Channel Transcript Scraper

A robust YouTube channel transcript scraper built with Crawlee and Playwright, featuring comprehensive anti-detection measures to avoid being blocked by YouTube.

## Features

### 🚀 Core Functionality
- **Channel Support**: Works with both channel IDs (`UCxxxxxx`) and channel handles (`@username`)
- **Bulk Processing**: Extract transcripts from multiple videos in a single request
- **Transcript Extraction**: Automatically finds and extracts video transcripts when available
- **Flexible Filtering**: Option to include/exclude YouTube Shorts
- **Detailed Metadata**: Returns video titles, URLs, channel info, and transcript data

### 🛡️ Anti-Detection Measures
- **User Agent Rotation**: Randomly rotates between realistic browser user agents
- **Viewport Randomization**: Uses varied screen resolutions to avoid fingerprinting
- **WebDriver Detection Removal**: Removes automation indicators that YouTube detects
- **Random Delays**: Implements human-like delays between requests (2-6 seconds)
- **Browser Fingerprint Masking**: Overrides navigator properties and plugins
- **Realistic HTTP Headers**: Sets authentic browser headers
- **Stealth Mode**: Disables automation-related Chrome features

## API Endpoint

### POST `/youtube-transcripts`

Extract transcripts from all videos in a YouTube channel.

#### Request Parameters

```json
{
  "channelId": "UCxxxxxx",           // YouTube channel ID (optional if channelHandle provided)
  "channelHandle": "@username",      // YouTube channel handle (optional if channelId provided)
  "maxVideos": 50,                   // Maximum videos to process (default: 50)
  "timeout": 60000,                  // Timeout per request in ms (default: 60000)
  "includeShorts": false             // Include YouTube Shorts (default: false)
}
```

#### Response Format

```json
{
  "success": true,
  "channelInfo": {
    "name": "Channel Name",
    "subscribers": "1.2M subscribers",
    "url": "https://www.youtube.com/@username"
  },
  "videos": [
    {
      "title": "Video Title",
      "url": "https://www.youtube.com/watch?v=xxxxxxx",
      "isShort": false,
      "hasTranscript": true,
      "transcript": [
        {
          "time": "0:00",
          "text": "Welcome to this video..."
        },
        {
          "time": "0:05", 
          "text": "Today we're going to discuss..."
        }
      ]
    }
  ],
  "errors": [],
  "totalProcessed": 25
}
```

## Usage Examples

### 1. Using Channel Handle

```bash
curl -X POST http://localhost:3001/youtube-transcripts \
  -H "Content-Type: application/json" \
  -d '{
    "channelHandle": "@veritasium",
    "maxVideos": 10,
    "includeShorts": false
  }'
```

### 2. Using Channel ID

```bash
curl -X POST http://localhost:3001/youtube-transcripts \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "UCHnyfMqiRRG1u-2MsSQLbXA",
    "maxVideos": 5,
    "includeShorts": true,
    "timeout": 90000
  }'
```

### 3. JavaScript/Node.js Example

```javascript
const axios = require('axios');

async function getChannelTranscripts() {
  try {
    const response = await axios.post('http://localhost:3001/youtube-transcripts', {
      channelHandle: '@kurzgesagt',
      maxVideos: 20,
      includeShorts: false,
      timeout: 120000
    });

    console.log(`Found ${response.data.totalProcessed} videos`);
    
    response.data.videos.forEach(video => {
      if (video.hasTranscript) {
        console.log(`\n${video.title}`);
        console.log(`Transcript segments: ${video.transcript.length}`);
      }
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
```

## Testing

Run the included test script to verify functionality:

```bash
# Start the server
npm start

# In another terminal, run the test
npm run test-youtube
```

The test script will:
- Check server health
- Test both channel handle and channel ID formats
- Display detailed results and transcript previews
- Show performance metrics

## Finding Channel IDs and Handles

### Channel Handles
- Modern format: `@username` (e.g., `@veritasium`)
- Found in the channel URL: `youtube.com/@username`

### Channel IDs  
- Legacy format: `UCxxxxxx` (e.g., `UCHnyfMqiRRG1u-2MsSQLbXA`)
- Found in channel URL: `youtube.com/channel/UCxxxxxx`
- Can be found by viewing page source and searching for `"channelId"`

## Best Practices

### 1. Rate Limiting
- Keep `maxVideos` reasonable (10-50 for testing)
- Use longer timeouts for channels with many videos
- Add delays between API calls if making multiple requests

### 2. Error Handling
- Always check the `success` field in the response
- Review the `errors` array for specific issues
- Some videos may not have transcripts available

### 3. Performance Optimization
- Use `includeShorts: false` for faster processing (Shorts rarely have transcripts)
- Increase `timeout` for channels with slow-loading videos
- Process channels in smaller batches for better reliability

### 4. Avoiding Detection
- Don't make rapid successive requests to the same channel
- Vary your request patterns (different channels, times)
- Monitor the `errors` array for signs of blocking

## Troubleshooting

### Common Issues

1. **"No transcript available"**
   - Not all videos have transcripts
   - Auto-generated transcripts may not be accessible
   - Try different videos from the same channel

2. **Timeout Errors**
   - Increase the `timeout` parameter
   - Reduce `maxVideos` for initial testing
   - Check your internet connection

3. **Channel Not Found**
   - Verify the channel handle includes `@` symbol
   - Ensure channel ID is correct format (`UCxxxxxx`)
   - Check if the channel exists and is public

4. **Rate Limiting/Blocking**
   - Reduce request frequency
   - Try different channels
   - Restart the server to reset browser state

### Debug Mode

Enable detailed logging by setting environment variables:

```bash
DEBUG=crawlee* npm start
```

## Technical Details

### Anti-Detection Implementation

The scraper implements multiple layers of protection:

1. **Browser Configuration**
   ```javascript
   args: [
     '--disable-blink-features=AutomationControlled',
     '--disable-web-security',
     '--no-first-run',
     '--disable-default-apps'
   ]
   ```

2. **Navigator Overrides**
   ```javascript
   Object.defineProperty(navigator, 'webdriver', {
     get: () => undefined,
   });
   ```

3. **Random User Agents**
   - Rotates between 5 realistic Chrome user agents
   - Includes Windows, macOS, and Linux variants

4. **Human-like Behavior**
   - Random delays between actions (2-6 seconds)
   - Realistic scrolling patterns
   - Proper wait conditions

### Performance Considerations

- **Memory Usage**: ~100-200MB per concurrent browser instance
- **Processing Time**: ~5-10 seconds per video (including transcript extraction)
- **Success Rate**: ~80-90% for channels with transcript-enabled videos

## License

MIT License - see the main project LICENSE file.

## Contributing

1. Test with various channel types before submitting PRs
2. Ensure anti-detection measures remain effective
3. Add error handling for new edge cases
4. Update documentation for new features 