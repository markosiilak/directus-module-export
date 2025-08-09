# Directus Module Export

<p align="left">
  <a href="https://github.com/markosiilak/directus-module-export"><img alt="GitHub Repo" src="https://img.shields.io/badge/GitHub-markosiilak%2Fdirectus--module--export-181717?logo=github" /></a>
  <a href="https://github.com/markosiilak/directus-module-export/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg" /></a>
  <a href="#"><img alt="Directus" src="https://img.shields.io/badge/Directus-11%2B-263238?logo=directus&logoColor=white" /></a>
  <a href="#"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/directus-module-export"><img alt="npm" src="https://img.shields.io/npm/v/directus-module-export?color=CB3837&logo=npm" /></a>
</p>

A Directus module extension for importing collection data from another Directus instance. Simplified for latest Directus versions.

## Features

- **Directus-to-Directus import**: Transfer collection data from a source Directus
- **Preflight permission check**: Test collection access before importing
- **Token validation**: Validate admin token against the source server
- **History management**: Save and reuse domain and token inputs (localStorage)
- **Real-time status**: Inline progress and concise error messages
- **Per-collection import**: Import items for a specific collection

### At a glance

<p align="left">
  <img alt="Import" title="Import" src="https://img.shields.io/badge/Import-From%20Directus-5E81F4?style=for-the-badge&logo=download" />
  <img alt="Validate" title="Validate Token" src="https://img.shields.io/badge/Validate-Token-27AE60?style=for-the-badge&logo=vercel" />
  <img alt="Check" title="Preflight Check" src="https://img.shields.io/badge/Preflight-Check-F39C12?style=for-the-badge&logo=checkmarx" />
</p>

## Installation

### From npm

```bash
npm install directus-module-export
```

## Usage

### Quick start

1. Open the module in your Directus admin.
2. Enter the source Directus API URL and an admin-access token for that source.
3. Click “Validate Token” (optional: “Test Collections” for quick permission checks).
4. For each collection, click “Import from another Directus”.
5. Review status/output. Failed items are summarized in the console.

Notes:
- Provide the token as plain string (no need to prefix with "Bearer ").
- The module normalizes tokens internally.

### Configuration

#### Domain settings
- Recent domains are stored locally for quick reuse.

#### Authentication
- **Admin token**: Required on the source Directus to READ the collections you import.
- **Token validation**: The module verifies token usability before import.

## Security considerations

- Admin tokens are stored locally in browser storage
- Token validation ensures proper permissions
- Clear history options for sensitive data
- Secure API communication over HTTPS

## Development

### Prerequisites

- Node.js >= 16.0.0
- Directus Extensions SDK
- TypeScript

### Setup

```bash
# Install dependencies
npm install

# Build for development
npm run build

# Watch for changes
npm run dev

# Link to Directus instance
npm run link
```

### Project Structure

```
src/
├── index.ts          # Module definition
├── module.vue        # Main Vue component
└── shims.d.ts        # TypeScript declarations
```

### Building

```bash
# Production build
npm run build

# Development build with watch
npm run dev
```

## Configuration

No environment variables are required. Install and enable the module in your Directus instance per normal extension flow.

## Troubleshooting

### Common issues

1. **Token validation fails**
   - Ensure the token is valid and the API URL is reachable over HTTPS.

2. **403 Forbidden on a collection**
   - On the source Directus, grant the token’s role READ permission on that collection (and any related collections or files).

3. **History not saving**
   - Check browser storage permissions; clear cache if needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting section

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates. Notable:

- 1.1.0: Reworked for Directus v11+, import from Directus-only; removed legacy API import and export flows; improved token handling and preflight checks.