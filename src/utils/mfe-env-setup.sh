#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
DEFAULT_MUI_VERSION="5.13.7"
DEFAULT_PORT="3001"

# Check for required arguments
if [ "$#" -lt 1 ]; then
    echo -e "${RED}Error: Missing required argument${NC}"
    echo "Usage: $0 <mfe-name> [mui-version] [port]"
    echo "Example: $0 mfe1 5.13.7 3001"
    exit 1
fi

MFE_NAME=$1
MUI_VERSION=${2:-$DEFAULT_MUI_VERSION}
PORT=${3:-$DEFAULT_PORT}

# Create .env file
cat > .env << EOL
MFE_NAME=${MFE_NAME}
MUI_VERSION=${MUI_VERSION}
PORT=${PORT}
NODE_ENV=development
EOL

# Create .env.production file
cat > .env.production << EOL
MFE_NAME=${MFE_NAME}
MUI_VERSION=${MUI_VERSION}
PORT=${PORT}
NODE_ENV=production
PUBLIC_URL=/mfe/${MFE_NAME}
EOL

# Create docker-compose.yml for local development
cat > docker-compose.yml << EOL
version: '3'
services:
  ${MFE_NAME}:
    build:
      context: .
      args:
        - MFE_NAME=${MFE_NAME}
        - MUI_VERSION=${MUI_VERSION}
    environment:
      - PORT=${PORT}
      - MFE_NAME=${MFE_NAME}
      - MUI_VERSION=${MUI_VERSION}
    ports:
      - "${PORT}:${PORT}"
    volumes:
      - ./src:/app/src
      - ./public:/app/public
    command: npm run start
EOL

# Create Dockerfile
cat > Dockerfile << EOL
FROM node:18-alpine

WORKDIR /app

ARG MFE_NAME
ARG MUI_VERSION

COPY package*.json ./
RUN npm install

COPY . .

ENV MFE_NAME=\${MFE_NAME}
ENV MUI_VERSION=\${MUI_VERSION}

RUN npm run build

CMD ["npm", "start"]
EOL

echo -e "${GREEN}Environment setup complete for ${MFE_NAME}!${NC}"
echo "MUI Version: ${MUI_VERSION}"
echo "Port: ${PORT}"
echo ""
echo "To start development:"
echo "1. docker-compose up"
echo "2. Access your MFE at http://localhost:${PORT}"
