require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

// Ensure logs directory exists with correct permissions
const logDir = path.join(__dirname, '../logs');
fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
  ]
});

// Add console logging in development
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();

// Database connection
async function initializeDatabase() {
  try {
    const { connectDatabase } = require('./database');
    await connectDatabase();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

// Initialize Express middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(compression());
app.use(express.json());

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  next();
});

// Request logging
app.use((req, res, next) => {
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body
  });
  next();
});

// Health check for Docker
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    env: config.env
  });
});

// API routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

// Error logging
app.on('error', (error) => {
  logger.error('Server error:', error);
});

// Start server
async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();

    // Then start the server
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`API server running on port ${config.port} in ${config.env} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  try {
    const { disconnectDatabase } = require('./database');
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the application
startServer();

module.exports = app;
