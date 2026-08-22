require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const database = require('./database');

/**
 * Fail fast at boot if required production secrets are missing, rather than
 * surfacing the problem on the first authenticated request.
 */
function validateProductionConfig() {
    if (config.env !== 'production') return;
    const missing = [];
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
    if (!config.cors.origin || config.cors.origin === '*') {
        throw new Error(
            'CORS_ORIGIN must be set to an explicit origin in production (refusing to start with "*" or empty).',
        );
    }
    if (missing.length > 0) {
        throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }
}

async function startServer() {
    try {
        validateProductionConfig();

        const app = express();
        const port = process.env.PORT || 3001;

        // Initialize database first
        await database.connect();

        // Optional seeding in development
        if (process.env.NODE_ENV === 'development' && process.env.SEED_DATA === 'true') {
            // The connection is already open — run the seed set directly.
            // (seed.js is the standalone entry: it connects AND disconnects,
            // which would tear down this server's connection.)
            const seedDatabase = require('./database/seeds');
            await seedDatabase();
        }

        // Middleware
        app.use(helmet());
        // CORS is driven by config (defaults closed in production).
        app.use(cors({ origin: config.cors.origin, methods: config.cors.methods }));
        app.use(compression());
        app.use(express.json());

        // Request ID middleware
        app.use((req, res, next) => {
            req.id = require('crypto').randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });

        // Liveness/readiness — used by container and orchestrator health checks.
        app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));
        app.get('/ready', async (req, res) => {
            const ready = typeof database.isConnected === 'function' ? database.isConnected() : true;
            res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready' });
        });

        // Routes
        app.use('/api', require('./routes'));

        // Error handling
        app.use(errorHandler);

        // Start server
        const server = app.listen(port, '0.0.0.0', () => {
            logger.info(`Server running on port ${port} in ${process.env.NODE_ENV} mode`);
        });

        // Graceful shutdown on SIGTERM/SIGINT
        const shutdown = async (signal) => {
            logger.info(`${signal} received, shutting down...`);
            server.close(async () => {
                await database.disconnect();
                process.exit(0);
            });
            // Force-exit if connections do not drain in time.
            setTimeout(() => process.exit(1), 10000).unref();
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();