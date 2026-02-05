# @inovvia/japa-reporter-report-portal

[![npm version](https://img.shields.io/npm/v/@inovvia/japa-reporter-report-portal.svg)](https://www.npmjs.com/package/@inovvia/japa-reporter-report-portal)
[![npm downloads](https://img.shields.io/npm/dm/@inovvia/japa-reporter-report-portal.svg)](https://www.npmjs.com/package/@inovvia/japa-reporter-report-portal)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js->=18.16.0-green.svg)](https://nodejs.org/)

> Report Portal reporter for the [Japa](https://japa.dev) test framework. Send your test results to [Report Portal](https://reportportal.io/) for centralized test reporting and analytics.

<p align="center">
  <img src="https://japa.dev/logo.svg" alt="Japa" width="80" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <span style="font-size: 48px;">→</span>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://reportportal.io/static/media/logo-big.a1a2dc2a.svg" alt="Report Portal" width="200" />
</p>

---

## Features

- **Seamless Integration** - Works directly with Japa's reporter system
- **Full Test Hierarchy** - Preserves suites, groups, and tests structure in Report Portal
- **Detailed Error Reporting** - Automatically logs errors and stack traces
- **Flexible Authentication** - Supports both API key and OAuth authentication
- **TypeScript First** - Full type definitions included
- **Configurable** - Extensive options for customization
- **Launch Merging** - Support for parallel test runs with launch merge

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Required Options](#required-options)
  - [Optional Options](#optional-options)
  - [OAuth Authentication](#oauth-authentication)
- [Advanced Usage](#advanced-usage)
  - [Launch Attributes](#launch-attributes)
  - [Debug Mode](#debug-mode)
  - [Conditional Activation](#conditional-activation)
  - [Launch Modes](#launch-modes)
- [Environment Variables](#environment-variables)
- [TypeScript Support](#typescript-support)
- [Test Structure Mapping](#test-structure-mapping)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @inovvia/japa-reporter-report-portal
```

### Peer Dependencies

This package requires `@japa/runner` version 5.0.0 or higher:

```bash
npm install @japa/runner
```

## Quick Start

### 1. Configure Japa

In your test configuration file (e.g., `bin/test.js` or `bin/test.ts`):

```javascript
import { configure, processCLIArgs, run } from '@japa/runner'
import { RPReporter } from '@inovvia/japa-reporter-report-portal'

processCLIArgs(process.argv.splice(2))

configure({
  files: ['tests/**/*.spec.js'],
  
  reporters: {
    activated: ['spec', 'report-portal'],
    list: [
      spec(),
      {
        name: 'report-portal',
        handler: (runner, emitter) => {
          const reporter = new RPReporter({
            endpoint: 'http://your-rp-server:8080/api/v2',
            project: 'your-project',
            launch: 'Your Launch Name',
            apiKey: 'your-api-key',
          })
          reporter.boot(runner, emitter)
        },
      },
    ],
  },
})

run()
```

### 2. Using Environment Variables (Recommended)

For better security, use environment variables for sensitive configuration:

```javascript
import 'dotenv/config' // optional, for loading .env files
import { configure, processCLIArgs, run } from '@japa/runner'
import { RPReporter } from '@inovvia/japa-reporter-report-portal'

const rpConfig = {
  endpoint: process.env.RP_ENDPOINT,
  project: process.env.RP_PROJECT,
  launch: process.env.RP_LAUNCH || 'Japa Tests',
  apiKey: process.env.RP_API_KEY,
}

configure({
  files: ['tests/**/*.spec.js'],
  
  reporters: {
    activated: ['spec', 'report-portal'],
    list: [
      spec(),
      {
        name: 'report-portal',
        handler: (runner, emitter) => new RPReporter(rpConfig).boot(runner, emitter),
      },
    ],
  },
})

run()
```

Create a `.env` file in your project root:

```env
RP_ENDPOINT=http://your-rp-server:8080/api/v2
RP_PROJECT=your-project
RP_LAUNCH=Japa Tests
RP_API_KEY=your-api-key
```

## Configuration

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `endpoint` | `string` | Report Portal API endpoint URL (e.g., `http://localhost:8080/api/v2`) |
| `project` | `string` | Report Portal project name |
| `launch` | `string` | Name of the launch in Report Portal |
| `apiKey` | `string` | Report Portal API key (found in User Profile > API Keys) |

### Optional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `description` | `string` | - | Description for the launch |
| `attributes` | `Attribute[]` | - | Array of attributes to attach to the launch |
| `mode` | `LAUNCH_MODES` | `'DEFAULT'` | Launch mode: `'DEFAULT'` or `'DEBUG'` |
| `debug` | `boolean` | `false` | Enable debug logging |
| `launchId` | `string` | - | Existing launch ID to use (for merge launches) |
| `rerun` | `boolean` | `false` | Mark as rerun |
| `rerunOf` | `string` | - | UUID of the launch to rerun |
| `skippedIssue` | `boolean` | `true` | Report skipped tests as issues |
| `extendTestDescriptionWithLastError` | `boolean` | `true` | Add error message to test description |
| `isLaunchMergeRequired` | `boolean` | `false` | Enable launch merge mode |
| `headers` | `Record<string, string>` | - | Custom HTTP headers |
| `restClientConfig` | `AxiosRequestConfig` | - | Custom Axios configuration |

### OAuth Authentication

Instead of `apiKey`, you can use OAuth authentication:

```javascript
const rpConfig = {
  endpoint: 'http://your-rp-server:8080/api/v2',
  project: 'your-project',
  launch: 'Your Launch Name',
  oauth: {
    tokenEndpoint: 'http://your-auth-server/oauth/token',
    username: 'your-username',
    password: 'your-password',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret', // optional
    scope: 'your-scope', // optional
  },
}
```

## Advanced Usage

### Launch Attributes

Add metadata to your launches for better filtering and organization:

```javascript
const rpConfig = {
  endpoint: process.env.RP_ENDPOINT,
  project: process.env.RP_PROJECT,
  launch: process.env.RP_LAUNCH,
  apiKey: process.env.RP_API_KEY,
  description: 'Automated test run for feature X',
  attributes: [
    { key: 'environment', value: 'staging' },
    { key: 'browser', value: 'chrome' },
    { key: 'version', value: '1.2.3' },
    { value: 'smoke-test' }, // key is optional
  ],
}
```

### Debug Mode

Enable debug mode to see detailed logs of what's being sent to Report Portal:

```javascript
const rpConfig = {
  // ... other options
  debug: true,
}
```

Or via environment variable:

```bash
RP_DEBUG=true npm test
```

### Conditional Activation

Only enable Report Portal when properly configured:

```javascript
const rpConfig = {
  endpoint: process.env.RP_ENDPOINT,
  project: process.env.RP_PROJECT,
  launch: process.env.RP_LAUNCH,
  apiKey: process.env.RP_API_KEY,
}

const isRPConfigured = rpConfig.apiKey && rpConfig.endpoint

configure({
  files: ['tests/**/*.spec.js'],
  
  reporters: {
    activated: isRPConfigured ? ['spec', 'report-portal'] : ['spec'],
    list: [
      spec(),
      ...(isRPConfigured ? [{
        name: 'report-portal',
        handler: (runner, emitter) => new RPReporter(rpConfig).boot(runner, emitter),
      }] : []),
    ],
  },
})
```

### Launch Modes

| Mode | Description |
|------|-------------|
| `DEFAULT` | Normal launch mode (visible in Report Portal UI) |
| `DEBUG` | Debug mode (launches are hidden by default in UI) |

```javascript
import { RPReporter, LAUNCH_MODES } from '@inovvia/japa-reporter-report-portal'

const rpConfig = {
  // ... other options
  mode: LAUNCH_MODES.DEBUG,
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RP_ENDPOINT` | Report Portal API endpoint |
| `RP_PROJECT` | Report Portal project name |
| `RP_LAUNCH` | Launch name |
| `RP_API_KEY` | API key for authentication |
| `RP_LAUNCH_ID` | Existing launch ID (for merge mode) |
| `RP_DEBUG` | Enable debug logging (`true` or `1`) |

## TypeScript Support

This package includes TypeScript type definitions. Import types as needed:

```typescript
import { 
  RPReporter, 
  ReportPortalConfig, 
  Attribute,
  STATUSES,
  LAUNCH_MODES,
} from '@inovvia/japa-reporter-report-portal'

const config: ReportPortalConfig = {
  endpoint: 'http://localhost:8080/api/v2',
  project: 'my-project',
  launch: 'My Tests',
  apiKey: 'my-api-key',
}

const reporter = new RPReporter(config)
```

## Test Structure Mapping

The reporter maps Japa's test structure to Report Portal:

| Japa | Report Portal |
|------|---------------|
| Suite | Suite |
| Group (`test.group()`) | Suite |
| Test (`test()`) | Step |

### Test Status Mapping

| Japa Status | Report Portal Status |
|-------------|---------------------|
| Passed | `PASSED` |
| Failed | `FAILED` |
| Skipped | `SKIPPED` |
| Todo | `SKIPPED` (with `todo` attribute) |

## Troubleshooting

<details>
<summary><strong>Connection Errors</strong></summary>

If you see `ECONNREFUSED` errors:

1. Verify your `endpoint` URL is correct and accessible
2. Check if Report Portal server is running
3. Ensure there are no firewall/proxy issues
4. Try accessing the endpoint in a browser

</details>

<details>
<summary><strong>Missing Test Data</strong></summary>

If tests appear in Report Portal but without details:

1. Enable debug mode (`debug: true`) to see what's being sent
2. Check the Report Portal server logs for errors
3. Verify your API key has write permissions

</details>

<details>
<summary><strong>Authentication Errors</strong></summary>

If you receive 401/403 errors:

1. Verify your API key is correct
2. Check if the API key has expired
3. Ensure the API key has access to the specified project

</details>

## Related Projects

- [Japa](https://japa.dev) - A simple yet powerful testing framework for Node.js
- [Report Portal](https://reportportal.io/) - AI-powered Test Automation Dashboard
- [@reportportal/client-javascript](https://www.npmjs.com/package/@reportportal/client-javascript) - Official Report Portal JavaScript client

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

[MIT](LICENSE) - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/inovvia">Inovvia</a>
</p>
