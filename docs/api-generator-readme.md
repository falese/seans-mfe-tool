# MFE API Generator

Generate complete, production-ready APIs from OpenAPI specifications with a single command.

## Features

### Database Integration
- Automatic MongoDB model generation with proper schemas
- Smart type conversion from OpenAPI to Mongoose types
- Built-in validation based on schema definitions
- Support for both singular and plural model references
- Automatic relationship handling with x-ref support

### API Structure
- Clean MVC architecture
- Standardized controller generation
- Middleware integration for validation
- Error handling and logging
- Request/Response transformation
- Proper routing with parameter handling

### Validation & Security
- OpenAPI schema-based validation
- Custom validators for email, URLs, and relationships
- Built-in error handling middleware
- Request validation middleware
- Proper error response formatting

### Developer Experience
- Single command generation
- Consistent naming conventions
- Auto-generated documentation
- Built-in logging system
- Easy to extend and customize

## Usage

```bash
seans-mfe-tool api my-api --spec api.yaml --database mongodb
```

## Project Structure

```
generated-api/
├── src/
│   ├── controllers/
│   │   └── [resource]Controller.js
│   ├── models/
│   │   ├── index.js
│   │   └── [Resource].model.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validator.js
│   ├── routes/
│   │   └── [resource].routes.js
│   └── utils/
│       └── logger.js
├── package.json
└── README.md
```

## Best Practices
- Models support both singular and plural forms for flexibility
- Consistent error handling across all endpoints
- Proper separation of concerns
- Built-in logging for debugging and monitoring
- Standardized response formats

## Next Steps
Potential enhancements could include:
1. Additional database support (SQLite, PostgreSQL)
2. Authentication/Authorization generation
3. Auto-generated tests
4. OpenAPI documentation UI integration
5. Rate limiting and security middleware
6. Docker deployment configurations
7. Monitoring and metrics integration

