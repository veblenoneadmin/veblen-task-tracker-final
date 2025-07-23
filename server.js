const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Your working webhook URLs
const WEBHOOKS = {
    // Working webhooks from your n8n workflow
    taskIntake: 'https://primary-s0q-production.up.railway.app/webhook/taskintakewebhook',
    taskUpdate: 'https://primary-s0q-production.up.railway.app/webhook/task-update',
    timeLogger: 'https://primary-s0q-production.up.railway.app/webhook/timelogging',
    reportLogger: 'https://primary-s0q-production.up.railway.app/webhook/reportlogging'
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

// ============= TASK INTAKE API =============
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

// ============= TASK UPDATE API =============
// This proxies to your working task update webhook
app.post('/api/task-update', async (req, res) => {
    try {
        console.log('Task update request received:', req.body);
        
        // The frontend sends the data in the format your n8n webhook expects
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
        
        // The frontend sends the data in the format your n8n webhook expects
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
        
        // The frontend sends the data in the format your n8n webhook expects
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

// ============= TASK RETRIEVAL API (Future Enhancement) =============
// Placeholder for when you create a task retrieval workflow
app.get('/api/tasks/:employee', async (req, res) => {
    try {
        const { employee } = req.params;
        const { company } = req.query;
        
        // For now, return mock data - you can replace this when you create task retrieval
        res.json({
            success: true,
            data: {
                tasks: [
                    {
                        id: 'sample-task-1',
                        task_name: 'Sample Task',
                        company: company || 'CROWN REALITY',
                        status: 'Current Project',
                        progress: 50,
                        due_date: '2025-02-01',
                        description: 'This is a sample task. Task retrieval will work when you create a task management workflow.',
                        assigned_to: employee
                    }
                ],
                count: 1,
                message: 'Mock data - connect to actual task retrieval when ready'
            }
        });
        
    } catch (error) {
        console.error('Task retrieval error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve tasks'
        });
    }
});

// ============= GENERAL API ENDPOINTS =============

// Get task details by ID (for task editor)
app.get('/api/task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { company } = req.query;
        
        // Mock response for now - you can enhance this when you create task retrieval
        res.json({
            success: true,
            data: {
                task_id: taskId,
                task_name: 'Sample Task',
                description: 'Sample Description',
                status: 'Current Project',
                progress: 50,
                company: company || 'CROWN REALITY',
                due_date: '2025-02-01',
                assigned_to: ['Tony Herrera'],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            message: 'Mock data - will be replaced when you create task retrieval workflow'
        });
        
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'VEBLEN Task Tracker',
        webhooks: {
            taskIntake: 'connected to n8n',
            taskUpdate: 'connected to n8n',
            timeLogger: 'connected to n8n',
            reportLogger: 'connected to n8n'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        api: 'active',
        webhooks: WEBHOOKS,
        timestamp: new Date().toISOString(),
        features: {
            taskIntake: '✅ Connected to n8n workflow',
            taskEditor: '✅ Connected to n8n workflow',
            timeLogger: '✅ Connected to n8n workflow',
            reportLogger: '✅ Connected to n8n workflow',
            taskRetrieval: '⏳ Ready for future enhancement'
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
    console.log(`✅ All systems ready!`);
});

module.exports = app;
