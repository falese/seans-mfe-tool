const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const logger = require('../utils/logger');

let mongod = null;
let dbConnection = null;

const database = {
    connect: async function() {
        try {
            // Idempotent: seed.js (and SEED_DATA=true) may call connect()
            // from a process that is already connected.
            if (mongoose.connection.readyState === 1) {
                return dbConnection;
            }

            if (process.env.NODE_ENV !== 'production' && !process.env.MONGODB_URI) {
                logger.info('Development mode: Using MongoDB Memory Server');
                mongod = await MongoMemoryServer.create();
                process.env.MONGODB_URI = mongod.getUri();
                logger.info('MongoDB Memory Server started at:', process.env.MONGODB_URI);
            }

            // mongoose.connect resolves once the connection is ready;
            // waiting for a 'connected' event afterwards would hang — the
            // event fires before a late listener attaches.
            dbConnection = await mongoose.connect(process.env.MONGODB_URI || mongod.getUri(), {
                serverSelectionTimeoutMS: 30000,
                family: 4,
                bufferCommands: false
            });

            logger.info('MongoDB connected successfully');
            return dbConnection;
        } catch (error) {
            if (!mongod && error.name === 'MongooseServerSelectionError') {
                logger.warn('Failed to connect to MongoDB, falling back to Memory Server');
                try {
                    mongod = await MongoMemoryServer.create();
                    process.env.MONGODB_URI = mongod.getUri();
                    
                    dbConnection = await mongoose.connect(mongod.getUri(), {
                        family: 4,
                        bufferCommands: false
                    });
                    
                    logger.info('Successfully connected to MongoDB Memory Server');
                    return dbConnection;
                } catch (fallbackError) {
                    logger.error('Failed to start Memory Server:', fallbackError);
                    throw fallbackError;
                }
            }
            throw error;
        }
    },

    disconnect: async function() {
        try {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
                logger.info('Disconnected from MongoDB');
            }
            
            if (mongod) {
                await mongod.stop();
                logger.info('Stopped MongoDB Memory Server');
            }
        } catch (error) {
            logger.error('Error disconnecting from database:', error);
            throw error;
        }
    }
};

// Handle cleanup
process.on('SIGINT', async () => {
    await database.disconnect();
    process.exit(0);
});

module.exports = database;