# Jest Test Reports - Quick Reference

## 🚀 Quick Commands

### Basic Testing
```bash
npm test                          # Run all tests
npm test -- tests/combine.test.js # Run specific test file
npm test -- --watch               # Watch mode
```

### Generate Reports
```bash
npm run test:coverage             # Generate coverage report
npm run test:report               # Generate all reports
npm run test:ci                   # CI/CD mode with JUnit XML
npm run test:verbose              # Detailed output
```

### Using Scripts
```bash
# Linux/Mac
./generate-test-reports.sh

# Windows
generate-test-reports.bat
```

## 📊 Report Types & Locations

| Report Type | Location | Command |
|------------|----------|---------|
| **HTML Test Report** | `test-reports/test-report.html` | `npm run test:report` |
| **HTML Coverage** | `coverage/lcov-report/index.html` | `npm run test:coverage` |
| **LCOV** | `coverage/lcov.info` | `npm run test:coverage` |
| **JUnit XML** | `test-reports/junit.xml` | `npm run test:ci` |
| **JSON Results** | `test-reports/test-results.json` | `npm test -- --json --outputFile=...` |
| **Cobertura XML** | `coverage/cobertura-coverage.xml` | `npm test -- --coverage --coverageReporters=cobertura` |

## 🔍 View Reports

### HTML Test Report (Simple & Clean)
```bash
# Windows
start test-reports\test-report.html

# Mac
open test-reports/test-report.html

# Linux
xdg-open test-reports/test-report.html
```

### HTML Coverage Report (Detailed)
```bash
# Windows
start coverage\lcov-report\index.html

# Mac
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html
```

### Console Summary
```bash
npm test -- --coverage --coverageReporters=text-summary
```

## 📈 Coverage Metrics

```
--------------------------|---------|----------|---------|---------|
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   85.23 |    78.45 |   82.67 |   85.89 |
--------------------------|---------|----------|---------|---------|
```

- **Statements**: % of code statements executed
- **Branches**: % of conditional branches tested
- **Functions**: % of functions called
- **Lines**: % of code lines executed

## 🎯 Common Use Cases

### 1. Quick Test Check
```bash
npm test
```

### 2. Generate HTML Test Report
```bash
npm run test:report
open test-reports/test-report.html
```

### 3. Generate Coverage Report (separate)
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### 4. CI/CD Pipeline
```bash
npm run test:ci
# Generates: test-reports/junit.xml
```

### 5. Specific File Coverage
```bash
npm test -- tests/combine.test.js --coverage
```

### 6. Watch Mode Development
```bash
npm run test:watch
```

## 🔧 Configuration Files

### jest.config.js
```javascript
module.exports = {
  coverageReporters: ['html', 'text', 'lcov'],
  reporters: ['default', 'jest-junit'],
  coverageDirectory: 'coverage',
  // ... more config
};
```

### package.json Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --reporters=jest-junit"
  }
}
```

## 🐛 Troubleshooting

### No Coverage Generated?
```bash
npm test -- --coverage --collectCoverageFrom='modules/**/*.js'
```

### JUnit XML Missing?
```bash
npm install --save-dev jest-junit
npm run test:ci
```

### Low Coverage?
```bash
npm test -- --coverage --verbose
# Check uncovered lines in output
```

## 📦 Required Dependencies

```bash
npm install --save-dev jest jest-junit jest-html-reporter
```

## 🌐 CI/CD Integration

### GitHub Actions
```yaml
- run: npm run test:ci
- uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### Jenkins
```groovy
sh 'npm run test:ci'
junit 'test-reports/junit.xml'
publishHTML reportDir: 'coverage/lcov-report'
```

### Azure DevOps
```yaml
- script: npm run test:ci
- task: PublishTestResults@2
  inputs:
    testResultsFiles: 'test-reports/junit.xml'
```

## 📚 Report Formats

| Format | Use Case | Tool Integration |
|--------|----------|------------------|
| **HTML** | Human viewing | Browser |
| **LCOV** | Coverage tracking | Codecov, Coveralls |
| **JUnit XML** | CI/CD | Jenkins, Azure DevOps |
| **Cobertura XML** | Azure DevOps | Azure Pipelines |
| **JSON** | Custom processing | Scripts, APIs |
| **Text** | Console output | Terminal |

## 🎓 Best Practices

1. ✅ Run `npm run test:coverage` before commits
2. ✅ Review HTML report for uncovered code
3. ✅ Maintain >80% coverage on critical modules
4. ✅ Use CI/CD to track coverage trends
5. ✅ Archive reports for each release

## 🔗 Resources

- [HTML Test Report Guide](./HTML-TEST-REPORT-GUIDE.md) - **Simple HTML reports**
- [Full Documentation](./TEST-REPORTING.md) - Complete reporting guide
- [Testing Guide](./TESTING.md) - How to write tests
- [Jest Docs](https://jestjs.io/)
- [jest-html-reporters](https://github.com/Hazyzh/jest-html-reporters)

---

**Need Help?** Check [TEST-REPORTING.md](./TEST-REPORTING.md) for detailed documentation.

