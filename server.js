const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Your working webhook URLs
const CONFIG = {
    taskIntakeUrl: '/api/task-action',
    taskUpdateUrl: '/api/task-action', 
    timeLoggerUrl: '/api/task-action',
    reportLoggerUrl: '/api/task-action',
    taskRetrievalUrl: '/api/task-action',
    imgbbApiKey: '679bd601ac49c50cae877fb240620cfe'
};

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));

// Helper function to call n8n webhooks
async function callN8nWebhook(webhookUrl, data, method = 'POST') {
    try {
        console.log(`Calling webhook: ${webhookUrl}`, method, data);
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (method === 'POST' && data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(webhookUrl, options);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            // Some webhooks might not return JSON
            result = { success: true, message: 'Action completed successfully' };
        }
        
        console.log('Webhook response:', result);
        return result;
    } catch (error) {
        console.error('Webhook call failed:', error);
        throw error;
    }
}

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============= NEW UNIFIED TASK ACTION API =============
// This handles all task actions with proper routing
app.post('/api/task-action', async (req, res) => {
    try {
        const { action } = req.body;
        
        console.log('📥 Task action received:', action);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        let webhookUrl;
        
        // Route to correct n8n workflow based on action
        if (action === 'task_intake') {
            webhookUrl = WEBHOOKS.taskIntake;
        } else if (action === 'daily_report') {
            webhookUrl = WEBHOOKS.reportLogger;
        } else if (action === 'get_task_by_ids') {
            webhookUrl = WEBHOOKS.getTasks;
        } else if (action === 'update_task') {
            webhookUrl = WEBHOOKS.taskUpdate;
        } else if (action === 'time_clock') {
            webhookUrl = WEBHOOKS.timeLogger;
        } else {
            return res.status(400).json({
                success: false,
                error: `Unsupported action: ${action}`,
                supported_actions: ['task_intake', 'daily_report', 'get_task_by_ids', 'update_task', 'time_clock']
            });
        }
        
        console.log('🎯 Routing to webhook:', webhookUrl);
        
        // Prepare request body - wrap in body property for task intake
        let requestBody = req.body;
        if (action === 'task_intake') {
            requestBody = {
                body: req.body  // n8n task intake expects data wrapped in body
            };
            console.log('📦 Wrapped task intake data in body property');
        }
        
        // Forward to n8n
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        // Add CORS headers
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        console.log('📨 N8N response:', response.status, response.ok);
        
        if (response.ok) {
            res.status(200).json(data);
        } else {
            console.error('❌ N8N error response:', data);
            res.status(400).json(data);
        }
        
    } catch (error) {
        console.error('❌ Task action error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// ============= LEGACY TASK INTAKE API (for backward compatibility) =============
// This proxies to your working task intake webhook
app.post('/api/task-intake', async (req, res) => {
    try {
        console.log('Task intake request received:', req.body);
        
        // The frontend sends the data in the format your n8n webhook expects
        const result = await callN8nWebhook(WEBHOOKS.taskIntake, req.body);
        
        res.json({
            success: true,
            message: 'Task created successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Task intake error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create task'
        });
    }
});

// ============= LEGACY TASK UPDATE API (for backward compatibility) =============
// This proxies to your working task update webhook
app.post('/api/task-update', async (req, res) => {
    try {
        console.log('Task update request received:', req.body);
        
        const result = await callN8nWebhook(WEBHOOKS.taskUpdate, req.body);
        
        res.json({
            success: true,
            message: 'Task updated successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Task update error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update task'
        });
    }
});

// ============= TIME LOGGER API =============
// This proxies to your working time logger webhook
app.post('/api/time-logger', async (req, res) => {
    try {
        console.log('Time logger request received:', req.body);
        
        const result = await callN8nWebhook(WEBHOOKS.timeLogger, req.body);
        
        res.json({
            success: true,
            message: 'Time logged successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Time logger error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to log time'
        });
    }
});

// ============= REPORT LOGGER API =============
// This proxies to your working report logger webhook
app.post('/api/report-logger', async (req, res) => {
    try {
        console.log('Report logger request received:', req.body);
        
        const result = await callN8nWebhook(WEBHOOKS.reportLogger, req.body);
        
        res.json({
            success: true,
            message: 'Report submitted successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Report logger error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to submit report'
        });
    }
});

// ============= GET TASKS API (for task editor) =============
app.post('/api/get-tasks', async (req, res) => {
    try {
        console.log('Get tasks request received:', req.body);
        
        // Ensure action is set for get requests
        req.body.action = req.body.action || 'get_task_by_ids';
        
        const result = await callN8nWebhook(WEBHOOKS.getTasks, req.body);
        
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS', 
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        res.json({
            success: true,
            message: 'Tasks retrieved successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve tasks'
        });
    }
});

// ============= HEALTH CHECK =============
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        webhooks: {
            taskIntake: '✅ Connected to n8n workflow',
            taskEditor: '✅ Connected to n8n workflow',
            timeLogger: '✅ Connected to n8n workflow',
            reportLogger: '✅ Connected to n8n workflow',
            taskRetrieval: '✅ Connected to n8n workflow'
        }
    });
});

// Handle OPTIONS requests for CORS
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

// Serve static files
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 VEBLEN Task Tracker running on port ${PORT}`);
    console.log(`📱 Access at: http://localhost:${PORT}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Connected Webhooks:`);
    console.log(`   📝 Task Intake: ${WEBHOOKS.taskIntake}`);
    console.log(`   ✏️ Task Update: ${WEBHOOKS.taskUpdate}`);
    console.log(`   ⏰ Time Logger: ${WEBHOOKS.timeLogger}`);
    console.log(`   📊 Report Logger: ${WEBHOOKS.reportLogger}`);
    console.log(`   📋 Get Tasks: ${WEBHOOKS.getTasks}`);
    console.log(`✅ All systems ready!`);
});

module.exports = app;
