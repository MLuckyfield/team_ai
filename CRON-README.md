# Cron Triggers for n8n Workflows

This feature adds robust cron-based scheduling to trigger n8n workflows via webhooks, solving the Schedule Trigger settings panel issue in n8n 1.99.1+.

## 🚀 Features

- **Reliable Scheduling**: Uses `node-cron` for robust cron job management
- **Multiple Webhook Support**: Trigger multiple n8n workflows with a single cron job
- **RESTful API**: Complete CRUD operations for cron job management
- **Timezone Support**: Schedule jobs in any timezone
- **Graceful Shutdown**: Properly cleans up cron jobs on server shutdown
- **Error Handling**: Comprehensive error handling and logging
- **Manual Triggers**: Test webhooks manually without waiting for schedule

## 📋 Prerequisites

- Node.js 16+
- Running n8n instance with webhook triggers configured
- Your Crawlee server running on port 3001

## 🛠️ Installation

The cron functionality is now integrated into the main server. Dependencies are automatically installed:

```bash
npm install
```

## 🎯 Quick Start

### 1. Start the Server
```bash
npm start
```

### 2. Check Cron Status
```bash
curl http://localhost:3001/cron/status
```

### 3. Create Your First Cron Job

**Create a daily report trigger:**
```bash
curl -X POST http://localhost:3001/cron/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "cronId": "daily-report",
    "schedule": "0 9 * * *",
    "webhookIds": ["YOUR_N8N_WEBHOOK_ID"],
    "description": "Daily report generation at 9 AM",
    "payload": {
      "reportType": "daily",
      "timestamp": "auto"
    }
  }'
```

### 4. Test the Integration
```bash
npm run test-cron
```

## 📚 API Reference

### Base URL
```
http://localhost:3001/cron
```

### Endpoints

#### 📊 Status & Information

**GET /status**
- Get cron service status and active jobs count

**GET /examples**
- Get common cron schedule patterns

**GET /jobs**
- List all configured cron jobs

#### 🔧 Job Management

**POST /jobs**
- Create a new cron job

Request body:
```json
{
  "cronId": "unique-job-id",
  "schedule": "0 9 * * *",
  "webhookIds": ["webhook-id-1", "webhook-id-2"],
  "description": "Job description",
  "payload": {
    "key": "value"
  },
  "timezone": "UTC"
}
```

**PATCH /jobs/:cronId/:action**
- Start or stop a specific cron job
- Actions: `start`, `stop`

**DELETE /jobs/:cronId**
- Delete a cron job permanently

#### 🔔 Manual Triggers

**POST /trigger/:webhookId**
- Manually trigger a single webhook for testing

**POST /trigger-multiple**
- Manually trigger multiple webhooks

Request body:
```json
{
  "webhookIds": ["webhook-1", "webhook-2"],
  "payload": {
    "test": true
  }
}
```

## ⏰ Cron Schedule Examples

| Schedule | Description |
|----------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 9 * * *` | Daily at 9 AM |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `0 0 1 * *` | Monthly on 1st at midnight |
| `*/15 9-17 * * 1-5` | Every 15 min, 9-5, Mon-Fri |

## 🔗 n8n Integration Setup

### 1. Create Webhook Trigger in n8n

1. Add a **Webhook** node to your n8n workflow
2. Set the webhook path (e.g., `daily-report`)
3. Note the full webhook URL: `https://your-n8n.com/webhook/daily-report`
4. Use `daily-report` as the `webhookId` in your cron job

### 2. Configure Base URL

The default webhook base URL is configured in `cron.js`:
```javascript
const cronManager = new CronManager('https://calculated-reviewer-less-except.trycloudflare.com');
```

Update this to match your n8n instance URL.

### 3. Payload Structure

Your n8n webhook will receive:
```json
{
  "timestamp": "2024-01-15T09:00:00.000Z",
  "source": "crawlee-cron",
  "cronId": "daily-report",
  "description": "Daily report generation",
  "your_custom_data": "here"
}
```

## 🧪 Testing

### Run Comprehensive Tests
```bash
npm run test-cron
```

### Clean Up Test Jobs
```bash
npm run cleanup-cron
```

### Manual Testing Examples

**Test a specific webhook:**
```bash
curl -X POST http://localhost:3001/cron/trigger/your-webhook-id \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Create a test job (every 2 minutes):**
```bash
curl -X POST http://localhost:3001/cron/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "cronId": "test-job",
    "schedule": "*/2 * * * *",
    "webhookIds": ["your-webhook-id"],
    "description": "Test job"
  }'
```

## 🚨 Troubleshooting

### Common Issues

**1. Webhook not triggered**
- Check n8n is running and accessible
- Verify webhook URL in browser
- Check server logs for error messages
- Test manual trigger first

**2. Invalid cron expression**
- Use [crontab.guru](https://crontab.guru/) to validate
- Get examples: `GET /cron/examples`

**3. Jobs not starting**
- Check cron status: `GET /cron/status`
- Verify job exists: `GET /cron/jobs`
- Restart job: `PATCH /cron/jobs/job-id/start`

### Debugging Tips

**Enable detailed logging:**
- Check server console output
- Look for webhook response status codes
- Verify payload structure in n8n webhook logs

**Test connectivity:**
```bash
# Test webhook directly
curl -X POST https://your-n8n.com/webhook/your-webhook-id \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 📁 File Structure

```
├── cron.js                 # CronManager class
├── routes/
│   └── cronRoutes.js      # API routes for cron management
├── cron-examples.json     # Example configurations
├── test-cron.js          # Test script
└── crawlee-server.js     # Main server with cron integration
```

## 🔄 Migration from n8n Schedule Trigger

If you're migrating from broken n8n Schedule Triggers:

1. **Identify existing schedules** in your n8n workflows
2. **Replace Schedule Trigger** with Webhook Trigger
3. **Create equivalent cron jobs** using this API
4. **Test thoroughly** before removing old triggers

## 🎛️ Production Considerations

### Environment Variables
Consider making webhook base URL configurable:
```bash
export N8N_WEBHOOK_BASE_URL="https://your-production-n8n.com"
```

### Monitoring
- Monitor cron job execution logs
- Set up alerts for failed webhook triggers
- Use `/cron/status` endpoint for health checks

### Backup
- Document your cron job configurations
- Export job configs for disaster recovery
- Consider database persistence for production

## 📝 Example Use Cases

### 1. Daily Reports
```json
{
  "cronId": "daily-sales-report",
  "schedule": "0 8 * * 1-5",
  "webhookIds": ["sales-report"],
  "description": "Daily sales report, weekdays at 8 AM",
  "payload": {
    "reportType": "sales",
    "period": "daily"
  }
}
```

### 2. System Monitoring
```json
{
  "cronId": "system-health-check",
  "schedule": "*/15 * * * *",
  "webhookIds": ["health-check", "metrics-collection"],
  "description": "System health check every 15 minutes"
}
```

### 3. Data Synchronization
```json
{
  "cronId": "crm-sync",
  "schedule": "0 */4 * * *",
  "webhookIds": ["crm-import", "data-validation"],
  "description": "CRM sync every 4 hours",
  "payload": {
    "syncType": "incremental",
    "source": "salesforce"
  }
}
```

## 🤝 Contributing

When adding new features:
1. Update both `cron.js` and `routes/cronRoutes.js`
2. Add corresponding tests to `test-cron.js`
3. Update this README
4. Test thoroughly with actual n8n webhooks

---

**🎉 Enjoy reliable, cron-based n8n workflow triggering!** 