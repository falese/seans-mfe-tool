const { RspackServer } = require('./implementations/RspackServer');
const { NodemonServer } = require('./implementations/NodemonServer');
const { BaseServer } = require('./BaseServer');
const chalk = require('chalk');

class ServerRegistry {
  constructor() {
    this.templates = new Map();
    
    // Register default server implementations
    this.register('rspack', RspackServer);
    this.register('nodemon', NodemonServer);

    if (process.env.DEBUG) {
      console.log(chalk.gray('Registered server types:'), Array.from(this.templates.keys()).join(', '));
    }
  }

  register(name, ServerClass) {
    if (process.env.DEBUG) {
      console.log(chalk.gray(`Registering server template: ${name}`));
    }
    this.templates.set(name, ServerClass);
  }

  get(name) {
    if (process.env.DEBUG) {
      console.log(chalk.gray(`Looking for server type: ${name}`));
      console.log(chalk.gray(`Available types: ${Array.from(this.templates.keys()).join(', ')}`));
    }
    const ServerClass = this.templates.get(name);
    if (!ServerClass) {
      throw new Error(`No server template registered for type: ${name}`);
    }
    return ServerClass;
  }
}

module.exports = {
  BaseServer,
  ServerRegistry,
  RspackServer,
  NodemonServer
};