# HTML Test Report Guide

This guide explains how to generate and view the standard HTML test report for the Graphman Client using `jest-html-reporters`.

## 🎯 Quick Start

### Generate HTML Test Report

**Option 1: Using npm script (recommended)**
```bash
npm run test:report
```

This generates the HTML test report with navigation, filters, and logs.

**Option 2: Using the generation script**
```bash
# Windows
generate-test-reports.bat

# Linux/Mac
./generate-test-reports.sh
```

**Option 3: Direct Jest command**
```bash
npm test -- --reporters=jest-html-reporters
```

### View the Report

The HTML report will be generated at: `test-reports/test-report.html`

**Open it:**
```bash
# Windows
start test-reports\test-report.html

# Mac
open test-reports/test-report.html

# Linux
xdg-open test-reports/test-report.html
```

## 📊 What's Included

The standard HTML report shows:

### Summary Section
- ✅ **Total Tests** - Number of tests executed
- ✅ **Passed Tests** - Tests that succeeded
- ❌ **Failed Tests** - Tests that failed
- ⏱️ **Duration** - Total execution time
- 📅 **Timestamp** - When tests were run

### Navigation Menu
- Quick links to all test suites
- Color-coded by status
- Smooth scrolling to sections

### Filter & Search
- **Filter buttons**: Show All / Passed / Failed tests
- **Search box**: Find tests by name
- Real-time filtering

### Test Suites
- Organized by test file
- Color-coded status (green = passed, red = failed)
- Individual test results with duration
- Error messages for failed tests
- Console logs (collapsible)
- Stack traces (collapsible)

### Interactive Features
- **Collapsible logs**: Click headers to expand/collapse
- **Back to top button**: Appears when scrolling
- **Smooth scrolling**: Navigate smoothly between sections

### Features
- **Standard Format** - Industry-standard Jest HTML report
- **Clean Design** - Professional, easy-to-read layout
- **Test Suites** - Organized by test files
- **Console Logs** - View test output and console messages
- **Error Details** - Full error messages and stack traces
- **Color Coding** - Visual status indicators (pass/fail)
- **Expandable Sections** - Click to expand/collapse test details
- **Statistics** - Summary of passed/failed/total tests
- **Responsive** - Works on desktop and mobile
- **Self-Contained** - Single HTML file with inline styles
- **Fast Loading** - No external dependencies

## 🎨 Customization

The report uses inline styles for a standard appearance. The `jest-html-reporters` package provides:

- **Standard Colors**: Green for passed, red for failed
- **Clean Layout**: Professional table-based design
- **Expandable Sections**: Click test suites to expand/collapse
- **Inline Styles**: Self-contained, no external CSS needed

To customize further, you can modify the `jest.config.js` options or use the package's built-in themes.

## 🔧 Configuration

The HTML reporter is configured in `jest.config.js`:

```javascript
reporters: [
  'default',
  [
    'jest-html-reporters',
    {
      publicPath: './test-reports',
      filename: 'test-report.html',
      pageTitle: 'Graphman Client - Test Report',
      expand: false,
      includeConsoleLog: true,
      includeFailureMsg: true,
      inlineSource: true
    }
  ]
]
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `publicPath` | Directory for the report | `./test-reports` |
| `filename` | Report filename | `test-report.html` |
| `pageTitle` | Title of the HTML page | `Test Report` |
| `expand` | Expand all test suites by default | `false` |
| `includeConsoleLog` | Include console output | `true` ✓ |
| `includeFailureMsg` | Show error messages | `true` ✓ |
| `inlineSource` | Inline CSS/JS (self-contained) | `true` ✓ |
| `openReport` | Auto-open report in browser | `false` |
| `hideIcon` | Hide the report icon | `false` |
| `dateFmt` | Date format | `yyyy-mm-dd HH:MM:ss` |

## 📋 Test Report vs Coverage Report

### HTML Test Report (`test-reports/test-report.html`)
- **Purpose**: Shows which tests passed/failed
- **Content**: Test results, execution times, errors, logs
- **Command**: `npm run test:report`
- **Use Case**: Quick overview of test status and debugging

### HTML Coverage Report (`coverage/lcov-report/index.html`)
- **Purpose**: Shows code coverage metrics
- **Content**: Line coverage, branch coverage, uncovered code
- **Command**: `npm run test:coverage`
- **Use Case**: Identify untested code

**These are separate!** 
- Use `npm run test:report` for test results with navigation and logs
- Use `npm run test:coverage` for code coverage analysis

## 🚀 CI/CD Integration

### Generate Report in CI/CD

```bash
npm test -- --ci --reporters=jest-html-reporter
```

### Archive the Report

**GitHub Actions:**
```yaml
- name: Upload Test Report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: test-report
    path: test-reports/test-report.html
```

**Jenkins:**
```groovy
publishHTML([
    reportDir: 'test-reports',
    reportFiles: 'test-report.html',
    reportName: 'Test Report'
])
```

**Azure DevOps:**
```yaml
- task: PublishBuildArtifacts@1
  inputs:
    pathToPublish: 'test-reports/test-report.html'
    artifactName: 'test-report'
```

## 💡 Tips

### 1. Use Navigation Menu

Click any test suite name in the navigation menu to jump directly to it. Perfect for large test suites!

### 2. Filter Failed Tests

Click the "Failed" button to see only failing tests. Great for debugging!

### 3. Search for Specific Tests

Use the search box to find tests by name. Supports partial matching.

### 4. View Console Logs

Console logs are included! Click the header to expand/collapse them.

### 5. Generate Report After Every Test Run

Add to your workflow:
```bash
npm test && open test-reports/test-report.html
```

### 2. Compare Reports Over Time

Save reports with timestamps:
```bash
npm test -- --reporters=jest-html-reporter
cp test-reports/test-report.html test-reports/test-report-$(date +%Y%m%d-%H%M%S).html
```

### 3. Share Reports

The HTML file is self-contained - you can:
- Email it
- Upload to shared drive
- Attach to tickets
- Archive in documentation

### 4. Quick Status Check

Just open the file in browser - no server needed!

## 🐛 Troubleshooting

### Report Not Generated?

**Check if jest-html-reporters is installed:**
```bash
npm list jest-html-reporters
```

**Install if missing:**
```bash
npm install --save-dev jest-html-reporters
```

### Report is Empty?

**Run tests first:**
```bash
npm test
```

### Report Not Opening?

**Check the file path:**
```bash
ls test-reports/test-report.html
```

**Verify Jest completed successfully:**
```bash
npm test
```

### Report Shows Old Results?

**Delete old report and regenerate:**
```bash
rm test-reports/test-report.html
npm test
```

## 📚 Examples

### Example 1: Quick Test Run
```bash
npm test
open test-reports/test-report.html
```

### Example 2: Full Report with Coverage
```bash
npm run test:report
open test-reports/test-report.html
open coverage/lcov-report/index.html
```

### Example 3: Specific Test File
```bash
npm test -- tests/combine.test.js --reporters=jest-html-reporter
open test-reports/test-report.html
```

### Example 4: Watch Mode with Reports
```bash
# Terminal 1: Run tests in watch mode
npm run test:watch

# Terminal 2: Regenerate report when needed
npm test -- --reporters=jest-html-reporters
```

## 🎓 Best Practices

1. ✅ **Generate reports before commits** - Catch failures early
2. ✅ **Review failed tests** - Click through to see error details
3. ✅ **Archive reports** - Keep history for comparison
4. ✅ **Share with team** - Easy to email or upload
5. ✅ **Use in CI/CD** - Automatic report generation

## 🔗 Related Documentation

- [Complete Test Reporting Guide](./TEST-REPORTING.md)
- [Quick Reference](./TEST-REPORTS-QUICK-REFERENCE.md)
- [Testing Guide](./TESTING.md)
- [jest-html-reporters](https://github.com/Hazyzh/jest-html-reporters)

---

**Need more features?** Check out the full [TEST-REPORTING.md](./TEST-REPORTING.md) guide for advanced options.

