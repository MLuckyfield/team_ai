const express = require('express');
const CronManager = require('../cron');

function createCronRoutes(cronManager) {
    const router = express.Router();

    // Health check for cron service
    router.get('/status', (req, res) => {
        try {
            const status = cronManager.getStatus();
            res.json({
                success: true,
                service: 'cron-manager',
                ...status,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get cron examples
    router.get('/examples', (req, res) => {
        try {
            const examples = CronManager.getCronExamples();
            res.json({
                success: true,
                examples,
                description: 'Common cron schedule patterns'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // List all cron jobs
    router.get('/jobs', (req, res) => {
        try {
            const result = cronManager.listCronJobs();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Create a new cron job
    router.post('/jobs', (req, res) => {
        try {
            const { 
                cronId, 
                schedule, 
                webhookIds, 
                payload = {}, 
                description = '', 
                timezone = 'UTC' 
            } = req.body;

            // Validate required fields
            if (!cronId || !schedule || !webhookIds || !Array.isArray(webhookIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'cronId, schedule, and webhookIds (array) are required'
                });
            }

            const result = cronManager.createCronJob(
                cronId, 
                schedule, 
                webhookIds, 
                payload, 
                description, 
                timezone
            );

            res.status(201).json(result);
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });

    // Toggle cron job (start/stop)
    router.patch('/jobs/:cronId/:action', (req, res) => {
        try {
            const { cronId, action } = req.params;

            if (!['start', 'stop'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action must be "start" or "stop"'
                });
            }

            const result = cronManager.toggleCronJob(cronId, action);
            res.json(result);
        } catch (error) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    });

    // Delete a cron job
    router.delete('/jobs/:cronId', (req, res) => {
        try {
            const { cronId } = req.params;
            const result = cronManager.deleteCronJob(cronId);
            res.json(result);
        } catch (error) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    });

    // Manually trigger a webhook (for testing)
    router.post('/trigger/:webhookId', async (req, res) => {
        try {
            const { webhookId } = req.params;
            const payload = req.body || {};

            const result = await cronManager.triggerN8nWebhook(webhookId, {
                ...payload,
                manual_trigger: true,
                triggered_at: new Date().toISOString()
            });

            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Trigger multiple webhooks manually
    router.post('/trigger-multiple', async (req, res) => {
        try {
            const { webhookIds, payload = {} } = req.body;

            if (!webhookIds || !Array.isArray(webhookIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'webhookIds array is required'
                });
            }

            const results = await cronManager.triggerMultipleWebhooks(webhookIds, {
                ...payload,
                manual_trigger: true,
                triggered_at: new Date().toISOString()
            });

            res.json({
                success: true,
                results
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createCronRoutes; 