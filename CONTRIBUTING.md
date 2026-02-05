# Contributing to @inovvia/japa-reporter-report-portal

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to make this project better.

## Getting Started

### Prerequisites

- Node.js >= 18.16.0
- npm or yarn

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/japa-reporter-report-portal.git
   cd japa-reporter-report-portal
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development

### Project Structure

```
src/
├── constants/       # Constants and enums
├── models/          # TypeScript interfaces and types
├── types/           # Type declarations
├── reporter.ts      # Main reporter implementation
├── utils.ts         # Utility functions
└── index.ts         # Package exports
tests/
└── reporter.spec.ts # Test file
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the project |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Fix linting issues |
| `npm run typecheck` | Type check without emitting |

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

## Making Changes

### Coding Standards

- Use TypeScript for all source files
- Follow the existing code style
- Run `npm run lint` before committing
- Add JSDoc comments for public APIs
- Update tests for new functionality

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add support for custom attributes`
- `fix: handle undefined test names`
- `docs: update configuration options`
- `refactor: simplify status mapping logic`
- `test: add tests for error handling`

### Pull Request Process

1. Update documentation if you're changing behavior
2. Add or update tests as needed
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Update the README.md if adding new features
6. Submit your pull request with a clear description

## Testing with Report Portal

To test changes against a real Report Portal instance:

1. Set up a local Report Portal instance (Docker recommended)
2. Create a `.env` file with your configuration:
   ```env
   RP_ENDPOINT=http://localhost:8080/api/v2
   RP_PROJECT=your-project
   RP_LAUNCH=Test Launch
   RP_API_KEY=your-api-key
   ```
3. Run the integration tests

## Reporting Issues

When reporting issues, please include:

- Node.js version
- Package version
- Report Portal version
- Minimal reproduction steps
- Expected vs actual behavior
- Error messages and stack traces

## Feature Requests

Feature requests are welcome! Please open an issue describing:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Questions?

Feel free to open an issue for questions or discussions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
