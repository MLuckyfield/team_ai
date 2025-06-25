const cron = require('node-cron');
const axios = require('axios');

class CronManager {
    constructor(webhookBaseUrl = 'https://calculated-reviewer-less-except.trycloudflare.com') {
        this.webhookBaseUrl = webhookBaseUrl;
        this.activeCronJobs = new Map();
        this.setupGracefulShutdown();
    }

    // Function to trigger n8n webhook
    async triggerN8nWebhook(webhookId, payload = {}) {
        try {
            const webhookUrl = `${this.webhookBaseUrl}/webhook/${webhookId}`;
            console.log(`🔔 Triggering n8n webhook: ${webhookUrl}`);
            
            const response = await axios.post(webhookUrl, {
                timestamp: new Date().toISOString(),
                source: 'crawlee-cron',
                ...payload
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Crawlee-Cron-Trigger/1.0'
                }
            });

            console.log(`✅ Webhook triggered successfully: ${response.status}`);
            return {
                success: true,
                status: response.status,
                data: response.data
            };
        } catch (error) {
            console.error(`❌ Failed to trigger webhook ${webhookId}:`, error.message);
            return {
                success: false,
                error: error.message,
                webhookId: webhookId
            };
        }
    }

    // Function to trigger multiple workflows
    async triggerMultipleWebhooks(webhookIds, payload = {}) {
        const results = [];
        
        for (const webhookId of webhookIds) {
            const result = await this.triggerN8nWebhook(webhookId, payload);
            results.push({
                webhookId,
                ...result
            });
            
            // Small delay between triggers to avoid overwhelming n8n
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return results;
    }

    // Create or update a cron job
    createCronJob(cronId, schedule, webhookIds, payload = {}, description = '', timezone = 'UTC') {
        // Validate inputs
        if (!cronId || !schedule || !webhookIds.length) {
            throw new Error('cronId, schedule, and webhookIds are required');
        }

        // Validate cron expression
        if (!cron.validate(schedule)) {
            throw new Error('Invalid cron expression');
        }

        // Stop existing job if it exists
        if (this.activeCronJobs.has(cronId)) {
            this.activeCronJobs.get(cronId).task.destroy();
            console.log(`🗑️ Stopped existing cron job: ${cronId}`);
        }

        // Create new cron job
        const task = cron.schedule(schedule, async () => {
            console.log(`⏰ Executing cron job: ${cronId} at ${new Date().toISOString()}`);
            
            try {
                const results = await this.triggerMultipleWebhooks(webhookIds, {
                    cronId,
                    description,
                    ...payload
                });
                
                console.log(`📊 Cron job ${cronId} completed:`, results);
            } catch (error) {
                console.error(`❌ Cron job ${cronId} failed:`, error);
            }
        }, {
            scheduled: false,
            timezone: timezone
        });

        // Store job metadata
        this.activeCronJobs.set(cronId, {
            task,
            schedule,
            webhookIds,
            payload,
            description,
            timezone,
            created: new Date().toISOString()
        });

        // Start the job
        task.start();
        
        console.log(`✅ Created and started cron job: ${cronId} with schedule: ${schedule}`);

        return {
            success: true,
            message: `Cron job ${cronId} created and started`,
            cronId,
            schedule,
            webhookIds,
            description,
            timezone
        };
    }

    // List all cron jobs
    listCronJobs() {
        const jobs = [];
        
        for (const [cronId, jobData] of this.activeCronJobs.entries()) {
            jobs.push({
                cronId,
                schedule: jobData.schedule,
                webhookIds: jobData.webhookIds,
                description: jobData.description,
                timezone: jobData.timezone,
                created: jobData.created,
                isRunning: jobData.task.getStatus() === 'scheduled'
            });
        }

        return {
            success: true,
            jobs: jobs,
            totalJobs: jobs.length
        };
    }

    // Start or stop a specific cron job
    toggleCronJob(cronId, action) {
        if (!this.activeCronJobs.has(cronId)) {
            throw new Error(`Cron job ${cronId} not found`);
        }

        const jobData = this.activeCronJobs.get(cronId);
        
        if (action === 'start') {
            jobData.task.start();
            console.log(`▶️ Started cron job: ${cronId}`);
        } else if (action === 'stop') {
            jobData.task.stop();
            console.log(`⏸️ Stopped cron job: ${cronId}`);
        } else {
            throw new Error('Action must be "start" or "stop"');
        }

        return {
            success: true,
            message: `Cron job ${cronId} ${action}ed`,
            status: jobData.task.getStatus()
        };
    }

    // Delete a cron job
    deleteCronJob(cronId) {
        if (!this.activeCronJobs.has(cronId)) {
            throw new Error(`Cron job ${cronId} not found`);
        }

        const jobData = this.activeCronJobs.get(cronId);
        jobData.task.destroy();
        this.activeCronJobs.delete(cronId);
        
        console.log(`🗑️ Deleted cron job: ${cronId}`);

        return {
            success: true,
            message: `Cron job ${cronId} deleted`
        };
    }

    // Get status of all cron jobs
    getStatus() {
        const activeCrons = Array.from(this.activeCronJobs.keys());
        return {
            activeCronJobs: activeCrons.length,
            cronJobs: activeCrons,
            webhookBaseUrl: this.webhookBaseUrl
        };
    }

    // Setup graceful shutdown
    setupGracefulShutdown() {
        const shutdown = () => {
            console.log('🔄 Shutting down cron jobs...');
            for (const [cronId, jobData] of this.activeCronJobs.entries()) {
                jobData.task.destroy();
                console.log(`🗑️ Stopped cron job: ${cronId}`);
            }
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }

    // Static method to get common cron examples
    static getCronExamples() {
        return {
            everyMinute: '* * * * *',
            every5Minutes: '*/5 * * * *',
            every15Minutes: '*/15 * * * *',
            every30Minutes: '*/30 * * * *',
            everyHour: '0 * * * *',
            every6Hours: '0 */6 * * *',
            everyDay9AM: '0 9 * * *',
            everyDay9PM: '0 21 * * *',
            twiceDaily: '0 9,21 * * *',
            everyWeekMonday: '0 9 * * 1',
            everyMonth1st: '0 9 1 * *',
            workdaysOnly: '0 9 * * 1-5',
            weekendsOnly: '0 9 * * 0,6'
        };
    }
}

module.exports = CronManager; 