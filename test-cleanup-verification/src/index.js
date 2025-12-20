require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const database = require('./database');

async function startServer() {
    try {
        const app = express();
        const port = process.env.PORT || 3001;

        // Initialize database first
        await database.connect();

        // Optional seeding in development
        if (process.env.NODE_ENV === 'development' && process.env.SEED_DATA === 'true') {
            const seed = require('./database/seed');
            await seed();
        }

        // Middleware
        app.use(helmet());
        app.use(cors());
        app.use(compression());
        app.use(express.json());

        // Request ID middleware
        app.use((req, res, next) => {
            req.id = require('crypto').randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });

        // Routes
        app.use('/api', require('./routes'));

        // Error handling
        app.use(errorHandler);

        // Start server
        app.listen(port, '0.0.0.0', () => {
            logger.info(`Server running on port ${port} in ${process.env.NODE_ENV} mode`);
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('SIGTERM received, shutting down...');
            await database.disconnect();
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();