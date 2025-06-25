const axios = require('axios');

async function testCBOE() {
    const url = 'http://localhost:3001/analyze';
    const payload = {
        "url": "https://www.cboe.com/available_weeklys/",
        "waitForSelector": ".content"
    };

    console.log('Testing CBOE endpoint...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await axios.post(url, payload, {
            timeout: 60000 // 60 second timeout
        });
        
        console.log('Success!');
        console.log('Response status:', response.status);
        console.log('Response data keys:', Object.keys(response.data));
        
        if (response.data.success) {
            console.log('Title:', response.data.title);
            console.log('URL:', response.data.url);
            console.log('HTML length:', response.data.html?.length || 0);
            console.log('Screenshot length:', response.data.screenshot?.length || 0);
        } else {
            console.log('Error:', response.data.error);
        }
        
    } catch (error) {
        console.error('Request failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testCBOE(); 