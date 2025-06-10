const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Main route - serve our landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Unified Platform is running!' });
});

// Future routes for n8n and crawl4ai
app.get('/n8n*', (req, res) => {
    res.json({ message: 'n8n service will be available here', status: 'coming soon' });
});

app.get('/crawl4ai*', (req, res) => {
    res.json({ message: 'Crawl4AI service will be available here', status: 'coming soon' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Unified Platform running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 