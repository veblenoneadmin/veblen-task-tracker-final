const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Your working webhook URLs - ENHANCED WITH ALL ENDPOINTS
const WEBHOOKS = {
    // Working webhooks from your n8n workflow
    taskIntake: 'https://primary-s0q-production.up.railway.app/webhook/taskintakewebhook',
    taskUpdate: 'https://primary-s0q-production.up.railway.app/webhook/task-update',
    timeLogger: 'https://primary-s0q-production.up.railway.app/webhook/timelogging',
    reportLogger: 'https://primary-s0q-production.up.railway.app/webhook/reportlogging',
    taskRetrieval: 'https://primary-s0q-production.up.railway.app/webhook/get-tasks'
};

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '32mb' })); // ImgBB free tier limit
app.use(express.urlencoded({ extended: true, limit: '32mb' }));
app.use(express.static(__dirname));

// Helper function to call n8n webhooks
async function callN8nWebhook(webhookUrl, data, method = 'POST') {
    try {
        console.log(`🔗 Calling webhook: ${webhookUrl.split('/').pop()}`, method);
        console.log('📊 Data:', JSON.stringify(data, null, 2));
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'VEBLEN-Task-Tracker/1.0'
            },
            timeout: 30000 // 30 second timeout
        };
        
        if (method === 'POST' && data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(webhookUrl, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Webhook failed: ${response.status} - ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        let result;
        try {
            const responseText = await response.text();
            result = responseText ? JSON.parse(responseText) : { success: true, message: 'Action completed successfully' };
        } catch (jsonError) {
            console.log('⚠️ Non-JSON response received, treating as success');
            result = { success: true, message: 'Action completed successfully' };
        }
        
        console.log('✅ Webhook response:', result);
        return result;
    } catch (error) {
        console.error('❌ Webhook call failed:', error.message);
        throw error;
    }
}

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============= ENHANCED API ROUTES TO MATCH SCRIPT.JS =============

// TASK ACTION API - This is what script.js calls for all task-related actions
app.post('/api/task-action', async (req, res) => {
    try {
        const action = req.body.action || req.body['WHAT ARE YOU DOING?'];
        console.log(`📝 Task action request: ${action}`);
        
        let webhookUrl;
        let responseData;
        
        // Route to appropriate webhook based on action
        if (action && (action.includes('WORK') || action.includes('BREAK') || action.includes('clock'))) {
            // Time-related actions go to time logger
            webhookUrl = WEBHOOKS.timeLogger;
            responseData = await callN8nWebhook(webhookUrl, req.body);
        } else if (action === 'daily_report' || req.body['Photo for report']) {
            // Daily report actions
            webhookUrl = WEBHOOKS.reportLogger;
            responseData = await callN8nWebhook(webhookUrl, req.body);
        } else {
            // Default to task intake for new tasks
            webhookUrl = WEBHOOKS.taskIntake;
            responseData = await callN8nWebhook(webhookUrl, req.body);
        }
        
        res.json({
            success: true,
            message: 'Action processed successfully',
            data: responseData,
            webhook_used: webhookUrl.split('/').pop()
        });
        
    } catch (error) {
        console.error('Task action error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process action'
        });
    }
});

// TASK UPDATE API - Direct routing for task updates
app.post('/api/task-update', async (req, res) => {
    try {
        console.log('✏️ Task update request received:', req.body);
        
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

// TASK RETRIEVAL API - Get tasks assigned to employee
app.get('/api/tasks/:employee', async (req, res) => {
    try {
        const { employee } = req.params;
        const { company } = req.query;
        
        console.log(`📋 Task retrieval request for: ${employee}${company ? ` (${company})` : ''}`);
        
        const requestData = {
            action: 'get_assigned_tasks',
            employee: employee,
            company: company || null
        };
        
        const result = await callN8nWebhook(WEBHOOKS.taskRetrieval, requestData, 'POST');
        
        // Ensure consistent response structure
        if (result && result.success) {
            res.json(result);
        } else {
            // Handle different response structures from n8n
            res.json({
                success: true,
                message: `Retrieved tasks for ${employee}`,
                data: {
                    employee: employee,
                    company: company,
                    tasks: result.data?.tasks || result.tasks || [],
                    count: result.data?.count || result.count || 0
                }
            });
        }
        
    } catch (error) {
        console.error('Task retrieval error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve tasks',
            data: {
                employee: req.params.employee,
                tasks: [],
                count: 0
            }
        });
    }
});

// LEGACY API ROUTES (for backward compatibility)
app.post('/api/task-intake', async (req, res) => {
    try {
        console.log('📝 Legacy task intake request:', req.body);
        const result = await callN8nWebhook(WEBHOOKS.taskIntake, req.body);
        res.json({ success: true, message: 'Task created successfully', data: result });
    } catch (error) {
        console.error('Task intake error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create task' });
    }
});

app.post('/api/time-logger', async (req, res) => {
    try {
        console.log('⏰ Legacy time logger request:', req.body);
        const result = await callN8nWebhook(WEBHOOKS.timeLogger, req.body);
        res.json({ success: true, message: 'Time logged successfully', data: result });
    } catch (error) {
        console.error('Time logger error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to log time' });
    }
});

app.post('/api/report-logger', async (req, res) => {
    try {
        console.log('📊 Legacy report logger request:', req.body);
        const result = await callN8nWebhook(WEBHOOKS.reportLogger, req.body);
        res.json({ success: true, message: 'Report submitted successfully', data: result });
    } catch (error) {
        console.error('Report logger error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to submit report' });
    }
});

// ============= FUTURE ENHANCEMENT ENDPOINTS =============

// Get specific task details by ID (placeholder for future enhancement)
app.get('/api/task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { company } = req.query;
        
        console.log(`🔍 Task detail request for: ${taskId}`);
        
        // TODO: When you create task detail retrieval in n8n, replace this
        res.json({
            success: true,
            data: {
                task_id: taskId,
                task_name: 'Sample Task',
                description: 'Sample Description',
                status: 'Current Project',
                progress: 50,
                company: company || 'VEBLEN (Internal)',
                due_date: '2025-02-01',
                assigned_to: ['Tony Herrera'],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            message: 'Task details retrieved (placeholder - will be replaced with real retrieval)'
        });
        
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Analytics endpoint (placeholder for future KPI features)
app.get('/api/analytics/:employee', async (req, res) => {
    try {
        const { employee } = req.params;
        const { timeframe } = req.query; // daily, weekly, monthly
        
        console.log(`📈 Analytics request for: ${employee} (${timeframe || 'daily'})`);
        
        // TODO: Implement real analytics when ready
        res.json({
            success: true,
            data: {
                employee: employee,
                timeframe: timeframe || 'daily',
                metrics: {
                    tasks_completed: 0,
                    hours_worked: 0,
                    productivity_score: 0
                }
            },
            message: 'Analytics placeholder - will be enhanced with real KPI data'
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============= HEALTH CHECK & MONITORING =============

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'VEBLEN Task Tracker',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        webhooks: {
            taskIntake: 'connected to n8n',
            taskUpdate: 'connected to n8n',
            timeLogger: 'connected to n8n',
            reportLogger: 'connected to n8n',
            taskRetrieval: 'connected to n8n'
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
            taskRetrieval: '✅ Connected to n8n workflow',
            taskDetails: '⏳ Ready for future enhancement',
            analytics: '⏳ Ready for future enhancement'
        },
        endpoints: {
            'POST /api/task-action': 'Main action handler (time, reports, tasks)',
            'POST /api/task-update': 'Task progress and status updates',
            'GET /api/tasks/:employee': 'Retrieve assigned tasks',
            'GET /api/task/:taskId': 'Get specific task details (future)',
            'GET /api/analytics/:employee': 'KPI and analytics (future)'
        }
    });
});

// ============= MIDDLEWARE & ERROR HANDLING =============

// Handle OPTIONS requests for CORS
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

// Serve static files (catch-all for frontend routing)
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
            error: 'API endpoint not found',
            available_endpoints: [
                'POST /api/task-action',
                'POST /api/task-update', 
                'GET /api/tasks/:employee',
                'GET /api/health'
            ]
        });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Server Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 VEBLEN Task Tracker running on port ${PORT}`);
    console.log(`📱 Access at: http://localhost:${PORT}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n🔗 Connected Webhooks:`);
    console.log(`   📝 Task Intake: ${WEBHOOKS.taskIntake}`);
    console.log(`   ✏️ Task Update: ${WEBHOOKS.taskUpdate}`);
    console.log(`   ⏰ Time Logger: ${WEBHOOKS.timeLogger}`);
    console.log(`   📊 Report Logger: ${WEBHOOKS.reportLogger}`);
    console.log(`   📋 Task Retrieval: ${WEBHOOKS.taskRetrieval}`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`   POST /api/task-action - Main action handler`);
    console.log(`   POST /api/task-update - Task updates`);
    console.log(`   GET  /api/tasks/:employee - Retrieve tasks`);
    console.log(`   GET  /api/health - Health check`);
    console.log(`\n✅ All systems ready!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});

module.exports = app;
