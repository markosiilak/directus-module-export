# Directus Module Export

A Directus module extension for importing and exporting collection data between different Directus instances or external APIs.

## Features

- **Data Import/Export**: Transfer collection data between Directus instances
- **API Integration**: Import data from external APIs
- **Token Validation**: Secure authentication with admin tokens
- **History Management**: Save and reuse domain and token configurations
- **Real-time Status**: Monitor import/export operations with live feedback
- **Collection Selection**: Choose specific collections for data transfer
- **Error Handling**: Comprehensive error reporting and recovery

## Installation

### From npm

```bash
npm install directus-module-export
```

### Manual Installation

1. Clone this repository or download the extension files
2. Place them in your Directus extensions folder
3. Build the extension using `npm run build`
4. Restart your Directus instance

## Usage

### Module Interface

The module provides a user-friendly interface for:

1. **Server Configuration**:
   - Enter target server API URL
   - Provide admin authentication token
   - Validate connection and permissions

2. **Data Operations**:
   - Import data from external APIs
   - Import data from other Directus instances
   - Export data to other servers

3. **History Management**:
   - Save frequently used domains and tokens
   - Quick selection from history
   - Clear history for security

### Configuration

#### Domain Settings
- Enter domains using the provided input field. Recent domains are automatically saved to your browser's local storage for quick access.
You can also add custom domains through the interface.

#### Authentication

- **Admin Token**: Required for read/write operations
- **Token Validation**: Automatic validation of permissions
- **Secure Storage**: Tokens are stored locally for convenience

### API Integration

The module supports importing data from:
- Directus REST API endpoints
- Custom API endpoints
- JSON data sources

### Data Transfer Modes

1. **Import from API**: Fetch data from external API endpoints
2. **Import from Directus**: Transfer data between Directus instances
3. **Export to Directus**: Send data to other Directus servers

## Security Considerations

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

### Environment Variables

No environment variables are required for basic functionality.

### Directus Configuration

The module integrates seamlessly with Directus and requires no additional configuration beyond standard module installation.

## Troubleshooting

### Common Issues

1. **Token Validation Fails**:
   - Ensure the admin token has proper permissions
   - Check if the target server is accessible
   - Verify the API URL is correct

2. **Import/Export Fails**:
   - Check network connectivity
   - Verify collection permissions
   - Ensure data format compatibility

3. **History Not Saving**:
   - Check browser storage permissions
   - Clear browser cache if needed

### Error Messages

- **"Invalid token"**: Token validation failed
- **"Server not accessible"**: Network or server issues
- **"Permission denied"**: Insufficient token permissions
- **"Collection not found"**: Target collection doesn't exist

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

See [CHANGELOG.md](CHANGELOG.md) for version history and updates. 