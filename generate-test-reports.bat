@echo off
REM Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

REM Script to generate comprehensive test reports for Graphman Client (Windows)

echo ================================================
echo Graphman Client - Test Report Generation
echo ================================================
echo.

REM Create reports directory
echo Creating reports directory...
if not exist test-reports mkdir test-reports
if not exist coverage mkdir coverage

REM Run tests with coverage
echo.
echo Running tests with coverage...
call npm test -- --runInBand --coverage --coverageReporters=html --coverageReporters=text --coverageReporters=lcov --coverageReporters=json --coverageReporters=cobertura --coverageReporters=text-summary

REM Generate JUnit XML report
echo.
echo Generating JUnit XML report...
call npm test -- --runInBand --ci --reporters=jest-junit

REM Generate test summary
echo.
echo Generating test summary...
call npm test -- --runInBand --verbose --json --outputFile=test-reports/test-results.json

REM Display results
echo.
echo ================================================
echo Test Reports Generated Successfully!
echo ================================================
echo.
echo Available Reports:
echo.
echo Coverage Reports:
echo    - HTML: coverage\lcov-report\index.html
echo    - LCOV: coverage\lcov.info
echo    - JSON: coverage\coverage-final.json
echo    - Cobertura XML: coverage\cobertura-coverage.xml
echo.
echo Test Reports:
echo    - JUnit XML: test-reports\junit.xml
echo    - JSON Results: test-reports\test-results.json
echo.
echo View HTML Coverage Report:
echo    start coverage\lcov-report\index.html
echo.
echo Done!

