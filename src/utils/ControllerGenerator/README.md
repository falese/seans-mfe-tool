# Controller Generator

A utility for generating API controllers from OpenAPI specifications with support for multiple database types.

## Structure

```
src/utils/controllerGenerator/
├── index.js                 # Main export file
├── ControllerGenerator.js   # Main orchestration class
├── adapters/               # Database adapters
│   └── DatabaseAdapter.js  # Base and specific DB adapters
├── generators/            # Generator utilities
│   ├── MethodGenerator.js        # Controller method generation
│   ├── ValidationGenerator.js    # Request validation generation
│   ├── ImplementationGenerator.js # Controller implementation generation
│   └── ResourceMapper.js         # OpenAPI resource mapping
└── README.md             # Documentation
```

## Features

- Supports multiple database types (MongoDB, SQLite)
- Generates consistent controller methods
- Handles request validation
- Includes logging and error handling
- Follows REST best practices

## Usage

```javascript
const { ControllerGenerator } = require("./utils/controllerGenerator");

await ControllerGenerator.generate("mongodb", "./controllers", openApiSpec);
```

## Generated Controller Structure

Each generated controller includes:

- Standard imports (error handling, logging, database)
- Request validation
- CRUD operations based on OpenAPI paths
- Consistent error handling
- Request/response logging
- Proper TypeScript types (if using TypeScript)

## Database Support

Currently supports:

- MongoDB (using Mongoose)
- SQLite (using Sequelize)

## Contributing

1. Add tests for new features
2. Update documentation
3. Follow existing code style
4. Create pull request

## Testing

```bash
npm test
```
