# Route Generator Utility

A utility for generating Express.js routes from OpenAPI specifications.

## Structure

```
routeGenerator/
├── index.js               # Main export
├── RouteGenerator.js      # Main orchestration
└── generators/           # Individual generators
    ├── NameGenerator.js   # Name conversions
    ├── PathGenerator.js   # Path processing
    ├── SchemaGenerator.js # Schema processing
    └── ValidationGenerator.js # Validation generation
```

## Usage

```javascript
const { generateRoutes } = require('../utils/routeGenerator');

// Generate routes from OpenAPI spec
await generateRoutes('./src/routes', openApiSpec);
```

## Generators

### NameGenerator
Handles conversion between different naming conventions (camelCase, kebab-case).

### PathGenerator
Processes API paths and generates Express route definitions.

### SchemaGenerator
Converts OpenAPI schemas to Joi validation schemas.

### ValidationGenerator
Generates specific Joi validations for different data types.

## Output

The generator creates:
- Individual route files for each API resource
- Route index file for mounting all routes
- Validation schemas for request bodies
- Controller imports and middleware setup

## Example Output

For an OpenAPI path `/phase-metrics`:

```javascript
const express = require('express');
const { getPhaseMetrics, getPhaseMetricsById } = require('../controllers/phaseMetrics.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

// ... validation schemas

router.get('/', getPhaseMetrics);
router.get('/:id', getPhaseMetricsById);

module.exports = router;
```
