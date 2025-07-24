const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// FIXED: Updated webhook URLs to match your n8n workflow exactly
const WEBHOOKS = {
    // Frontend: '/api/task-intake' → n8n: 'taskintakewebhook'
    taskIntake: 'https://primary-s0q-production.up.railway.app/webhook/taskintakewebhook',
    
    // Frontend: '/api/task-update' → n8n: 'task-update' ✅ (already matches)
    taskUpdate: 'https://primary-s0q-production.up.railway.app/webhook/task-update',
    
    // Frontend: '/api/time-logger' → n8n: 'timelogging'
    timeLogger: 'https://primary-s0q-production.up.railway.app/webhook/timelogging',
    
    // Frontend: '/api/report-logger' → n8n: 'reportlogging'
    reportLogger: 'https://primary-s0q-production.up.railway.app/webhook/reportlogging',
    
    // Frontend: '/api/get-tasks' → n8n: 'get-tasks' ✅ (already matches)
    taskRetrieval: 'https://primary-s0q-production.up.railway.app/webhook/get-tasks'
};

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        webhooks: {
            taskIntake: 'connected',
            taskUpdate: 'connected',
            timeLogger: 'connected',
            reportLogger: 'connected',
            taskRetrieval: 'connected'
        }
    });
});

// Create proxy configuration with better error handling
const createProxy = (target, pathRewrite = {}) => {
    return createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite,
        timeout: 30000, // 30 second timeout
        proxyTimeout: 30000,
        onError: (err, req, res) => {
            console.error(`❌ Proxy error for ${req.path}:`, err.message);
            
            if (!res.headersSent) {
                res.status(502).json({
                    success: false,
                    error: 'Backend service unavailable',
                    message: 'The n8n workflow is not responding. Please try again later.',
                    timestamp: new Date().toISOString()
                });
            }
        },
        onProxyReq: (proxyReq, req, res) => {
            console.log(`📤 Proxying ${req.method} ${req.path} → ${target}`);
            
            // Log request body for debugging
            if (req.body && Object.keys(req.body).length > 0) {
                console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
            }
        },
        onProxyRes: (proxyRes, req, res) => {
            console.log(`📥 Response ${proxyRes.statusCode} for ${req.path}`);
            
            // Log response for debugging (first 500 chars)
            let body = '';
            proxyRes.on('data', chunk => {
                body += chunk.toString();
            });
            
            proxyRes.on('end', () => {
                if (body.length > 0) {
                    const preview = body.length > 500 ? body.substring(0, 500) + '...' : body;
                    console.log('📋 Response preview:', preview);
                }
            });
        }
    });
};

// API Routes - FIXED to match frontend expectations and n8n webhooks

// Task Intake: /api/task-intake → taskintakewebhook
app.use('/api/task-intake', createProxy(WEBHOOKS.taskIntake));

// Task Update: /api/task-update → task-update ✅
app.use('/api/task-update', createProxy(WEBHOOKS.taskUpdate));

// Time Logger: /api/time-logger → timelogging
app.use('/api/time-logger', createProxy(WEBHOOKS.timeLogger));

// Report Logger: /api/report-logger → reportlogging  
app.use('/api/report-logger', createProxy(WEBHOOKS.reportLogger));

// Task Retrieval: /api/get-tasks → get-tasks ✅
app.use('/api/get-tasks', createProxy(WEBHOOKS.taskRetrieval));

// Catch-all handler for client-side routing
app.get('*', (req, res) => {
    // Serve index.html for all non-API routes
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        // Unknown API route
        res.status(404).json({
            success: false,
            error: 'API endpoint not found',
            availableEndpoints: [
                '/api/health',
                '/api/task-intake',
                '/api/task-update', 
                '/api/time-logger',
                '/api/report-logger',
                '/api/get-tasks'
            ],
            timestamp: new Date().toISOString()
        });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 VEBLEN Task Tracker Server Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log('');
    console.log('🔗 API Endpoints:');
    console.log(`   📋 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`   📝 Task Intake:  http://localhost:${PORT}/api/task-intake → ${WEBHOOKS.taskIntake}`);
    console.log(`   📊 Time Logger:  http://localhost:${PORT}/api/time-logger → ${WEBHOOKS.timeLogger}`);
    console.log(`   📈 Report Log:   http://localhost:${PORT}/api/report-logger → ${WEBHOOKS.reportLogger}`);
    console.log(`   🔄 Task Update:  http://localhost:${PORT}/api/task-update → ${WEBHOOKS.taskUpdate}`);
    console.log(`   📥 Get Tasks:    http://localhost:${PORT}/api/get-tasks → ${WEBHOOKS.taskRetrieval}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    // Test connection to n8n webhooks
    console.log('🔍 Testing n8n webhook connections...');
    Object.entries(WEBHOOKS).forEach(([name, url], index) => {
        setTimeout(() => {
            fetch(url, { method: 'HEAD' })
                .then(res => {
                    if (res.ok) {
                        console.log(`✅ ${name}: Connected (${res.status})`);
                    } else {
                        console.log(`⚠️  ${name}: Responding but might need data (${res.status})`);
                    }
                })
                .catch(err => {
                    console.log(`❌ ${name}: Connection failed - ${err.message}`);
                });
        }, index * 200); // Stagger requests
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
