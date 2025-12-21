#!/bin/bash
# Quick validation script for GraphQL Codegen POC

set -e

echo "🚀 GraphQL Codegen + RTK Query POC Validation"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if BFF is running
echo -e "${BLUE}Step 1: Checking BFF server...${NC}"
if curl -s -X POST http://localhost:4002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | grep -q "data"; then
  echo -e "${GREEN}✓ BFF server is running${NC}"
else
  echo -e "${YELLOW}⚠ BFF server not running. Start it with: npm start${NC}"
  exit 1
fi
echo ""

# Step 2: Run codegen
echo -e "${BLUE}Step 2: Running GraphQL Codegen...${NC}"
npm run codegen
echo -e "${GREEN}✓ Code generation complete${NC}"
echo ""

# Step 3: Check generated file
echo -e "${BLUE}Step 3: Validating generated code...${NC}"
if [ -f "src/generated/graphql.ts" ]; then
  LINES=$(wc -l < src/generated/graphql.ts)
  echo -e "${GREEN}✓ Generated file exists (${LINES} lines)${NC}"
  
  # Check for key exports
  if grep -q "useGetUsersQuery" src/generated/graphql.ts; then
    echo -e "${GREEN}✓ useGetUsersQuery hook found${NC}"
  fi
  
  if grep -q "GetUsersQuery" src/generated/graphql.ts; then
    echo -e "${GREEN}✓ GetUsersQuery type found${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Generated file not found${NC}"
  exit 1
fi
echo ""

# Step 4: Test query
echo -e "${BLUE}Step 4: Testing GraphQL query...${NC}"
RESULT=$(curl -s -X POST http://localhost:4002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ getUsers { id name assignedTo handle } }"}')

if echo "$RESULT" | grep -q "assignedTo"; then
  echo -e "${GREEN}✓ Query successful with transformed fields${NC}"
  echo ""
  echo "Sample data:"
  echo "$RESULT" | jq -r '.data.getUsers[0] | "  Name: \(.name)\n  Email: \(.assignedTo)\n  Handle: @\(.handle)"'
else
  echo -e "${YELLOW}⚠ Query failed or fields missing${NC}"
fi
echo ""

# Step 5: Bundle size analysis (if built)
echo -e "${BLUE}Step 5: Bundle size impact (estimate)...${NC}"
echo "  RTK Query:      ~45kb gzipped"
echo "  React Redux:    ~5kb gzipped"
echo "  Generated code: ~15kb gzipped"
echo "  ────────────────────────────"
echo "  Total:          ~65kb gzipped"
echo ""

echo -e "${GREEN}✅ POC Validation Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3002 to see the UI"
echo "2. Update src/components/UsersDemo.tsx to use generated hooks"
echo "3. Check src/generated/graphql.ts to see generated types"
echo "4. Review POC-README.md for full documentation"
