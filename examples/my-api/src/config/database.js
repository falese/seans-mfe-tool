const { MongoMemoryServer } = require('mongodb-memory-server');
let mongod = null;

const config = {
  development: {
    useMemoryServer: true,
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
      useUnifiedTopology: true
    }
  }
};

module.exports = config;
