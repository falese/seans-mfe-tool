# API Generator Quick Start Guide

Generate REST APIs from OpenAPI specifications using our MFE development tool.

## Prerequisites
- Node.js 18+
- npm/yarn/pnpm
- OpenAPI specification (YAML or JSON)

## Installation
```bash
npm install -g seans-mfe-tool
```

## Generate an API
```bash
mfe api my-api --spec ./openapi.yaml --port 3000
```

## Supported Features
- Full REST API generation from OpenAPI 3.0+ specs
- Auto-generated routes and controllers
- Mongoose model generation from schemas
- Built-in authentication (JWT)
- Error handling and validation
- Request logging
- Docker support
- Testing setup (Jest)

## Example Usage

1. **From Local Spec**
```bash
mfe api user-service --spec ./user-service.yaml
```

2. **From Remote Spec**
```bash
mfe api pet-store --spec https://petstore3.swagger.io/api/v3/openapi.json
```

3. **With Custom Port**
```bash
mfe api auth-service --spec ./auth.yaml --port 4000
```

## Project Structure
```
my-api/
├── src/
│   ├── routes/        # Generated API routes
│   ├── controllers/   # Generated controllers
│   ├── models/        # Generated Mongoose models
│   ├── middleware/    # Auth, validation, error handling
│   └── utils/         # Logging, helpers
├── tests/
├── Dockerfile
└── docker-compose.yml
```

## Development
```bash
cd my-api
npm install
npm run dev
```

## Testing
```bash
npm test
```

## Docker Deployment
```bash
docker-compose up -d
```

## Environment Variables
Create `.env` file from `.env.example`:
```
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret
DATABASE_URL=mongodb://localhost/my-api
```
