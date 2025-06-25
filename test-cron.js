const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testCronAPI() {
    console.log('🧪 Testing Cron API functionality...\n');

    try {
        // 1. Check server health and cron status
        console.log('1️⃣ Checking server health and cron status...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check:', healthResponse.data);
        console.log();

        // 2. Get cron examples
        console.log('2️⃣ Getting cron schedule examples...');
        const examplesResponse = await axios.get(`${BASE_URL}/cron/examples`);
        console.log('✅ Available schedule patterns:', Object.keys(examplesResponse.data.examples));
        console.log();

        // 3. Check current cron status
        console.log('3️⃣ Checking cron service status...');
        const statusResponse = await axios.get(`${BASE_URL}/cron/status`);
        console.log('✅ Cron status:', statusResponse.data);
        console.log();

        // 4. Create a test cron job (every minute for demo)
        console.log('4️⃣ Creating a test cron job...');
        const createJobResponse = await axios.post(`${BASE_URL}/cron/jobs`, {
            cronId: 'test-job',
            schedule: '*/2 * * * *', // Every 2 minutes
            webhookIds: ['test-webhook-id'],
            description: 'Test job for demonstration',
            payload: {
                testData: 'Hello from cron!',
                environment: 'development'
            }
        });
        console.log('✅ Created cron job:', createJobResponse.data);
        console.log();

        // 5. List all cron jobs
        console.log('5️⃣ Listing all cron jobs...');
        const listJobsResponse = await axios.get(`${BASE_URL}/cron/jobs`);
        console.log('✅ Current cron jobs:', listJobsResponse.data);
        console.log();

        // 6. Test manual webhook trigger
        console.log('6️⃣ Testing manual webhook trigger...');
        const triggerResponse = await axios.post(`${BASE_URL}/cron/trigger/test-webhook-id`, {
            manualTest: true,
            timestamp: new Date().toISOString()
        });
        console.log('✅ Manual trigger result:', triggerResponse.data);
        console.log();

        // 7. Stop the test job
        console.log('7️⃣ Stopping the test cron job...');
        const stopResponse = await axios.patch(`${BASE_URL}/cron/jobs/test-job/stop`);
        console.log('✅ Stop job result:', stopResponse.data);
        console.log();

        // 8. Wait a bit, then restart
        console.log('8️⃣ Waiting 3 seconds, then restarting job...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const startResponse = await axios.patch(`${BASE_URL}/cron/jobs/test-job/start`);
        console.log('✅ Start job result:', startResponse.data);
        console.log();

        // 9. Final status check
        console.log('9️⃣ Final status check...');
        const finalStatusResponse = await axios.get(`${BASE_URL}/cron/status`);
        console.log('✅ Final cron status:', finalStatusResponse.data);
        console.log();

        console.log('🎉 All tests completed successfully!');
        console.log('\n📝 To clean up, you can delete the test job:');
        console.log(`   DELETE ${BASE_URL}/cron/jobs/test-job`);
        console.log('\n⚠️  Note: The test job will continue running every 2 minutes until you delete it.');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Helper function to clean up test job
async function cleanupTestJob() {
    try {
        console.log('🧹 Cleaning up test job...');
        const deleteResponse = await axios.delete(`${BASE_URL}/cron/jobs/test-job`);
        console.log('✅ Cleanup result:', deleteResponse.data);
    } catch (error) {
        console.error('❌ Cleanup failed:', error.response?.data || error.message);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'cleanup') {
        cleanupTestJob();
    } else {
        testCronAPI();
    }
}

module.exports = { testCronAPI, cleanupTestJob }; 