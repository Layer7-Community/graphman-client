#!/bin/bash
# Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

# Script to generate comprehensive test reports for Graphman Client

set -e

echo "================================================"
echo "Graphman Client - Test Report Generation"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create reports directory
echo -e "${BLUE}Creating reports directory...${NC}"
mkdir -p test-reports
mkdir -p coverage

# Run tests with coverage
echo ""
echo -e "${BLUE}Running tests with coverage...${NC}"
npm test -- --coverage \
  --coverageReporters=html \
  --coverageReporters=text \
  --coverageReporters=lcov \
  --coverageReporters=json \
  --coverageReporters=cobertura \
  --coverageReporters=text-summary

# Generate JUnit XML report
echo ""
echo -e "${BLUE}Generating JUnit XML report...${NC}"
npm test -- --ci --reporters=jest-junit || true

# Generate test summary
echo ""
echo -e "${BLUE}Generating test summary...${NC}"
npm test -- --verbose --json --outputFile=test-reports/test-results.json || true

# Display results
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Test Reports Generated Successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${YELLOW}Available Reports:${NC}"
echo ""
echo "📊 Coverage Reports:"
echo "   - HTML: coverage/lcov-report/index.html"
echo "   - LCOV: coverage/lcov.info"
echo "   - JSON: coverage/coverage-final.json"
echo "   - Cobertura XML: coverage/cobertura-coverage.xml"
echo ""
echo "📋 Test Reports:"
echo "   - JUnit XML: test-reports/junit.xml"
echo "   - JSON Results: test-reports/test-results.json"
echo ""
echo -e "${YELLOW}View HTML Coverage Report:${NC}"
echo "   Mac:     open coverage/lcov-report/index.html"
echo "   Linux:   xdg-open coverage/lcov-report/index.html"
echo "   Windows: start coverage/lcov-report/index.html"
echo ""
echo -e "${GREEN}Done!${NC}"

