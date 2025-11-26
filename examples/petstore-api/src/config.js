require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  logDir: process.env.LOG_DIR || '/app/logs',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  // Base configuration that will be extended by database-specific configs
  database: {
    mongodb: {
      development: {
        useMemoryServer: !process.env.MONGODB_URI,
        url: process.env.MONGODB_URI,
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true
        }
      },
      test: {
        useMemoryServer: true,
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true
        }
      },
      production: {
        url: process.env.MONGODB_URI,
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000
        }
      }
    },
    sqlite: {
      development: {
        dialect: 'sqlite',
        storage: process.env.SQLITE_PATH || 'src/data/database.sqlite',
        logging: console.log,
        define: {
          timestamps: true,
          underscored: true
        }
      },
      test: {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
        define: {
          timestamps: true,
          underscored: true
        }
      },
      production: {
        dialect: 'sqlite',
        storage: process.env.SQLITE_PATH || 'src/data/database.sqlite',
        logging: false,
        define: {
          timestamps: true,
          underscored: true
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    }
  }
};

module.exports = config;
