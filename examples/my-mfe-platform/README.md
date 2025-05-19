# my-mfe-platform

A modular micro-frontend platform

## Project Structure

This project was generated with Sean's MFE Tool based on the provided specification.

### Shell Application
- Name: main-shell
- Port: 3000

### Remote MFEs
- dashboard (Port: 3001)
- profile (Port: 3002)
- settings (Port: 3003)

### APIs
- petstore-api (Port: 4001, Database: mongodb)
- settings-api (Port: 4002, Database: sqlite)

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Start development server:
   ```
   npm run dev
   ```

3. Build for production:
   ```
   npm run build
   ```

## Deployment

See the deployment configuration in the specification file.

## Metadata

- author: Team MFE
- createdAt: 2025-05-17
- organization: Example Corp
