// src/templates/api/sqlite/src/config/database.js

const path = require('path');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../data/database.sqlite'),
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
    storage: process.env.SQLITE_PATH || path.join(__dirname, '../../data/database.sqlite'),
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
};
