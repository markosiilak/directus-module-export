## [1.1.10] - 2025-08-11

### Changed
- Widened Directus compatibility: `@directus/extensions-sdk` peer range `>=11 <16` and `directus:extension.host` to `>=11.0.0 <16.0.0` to support Directus SDK v15.

## [1.1.10] - 2025-08-11

### Changed
- Widened Directus compatibility: `@directus/extensions-sdk` peer range `>=11 <16` and `directus:extension.host` to `>=11.0.0 <16.0.0` to support Directus SDK v15.

## [1.1.9] - 2025-08-11

### Added
- File importing: support for single-file fields; reuse existing by checksum/size; upload missing files to a collection-named folder (auto-created) with optional title
- Version 1.1.9 release

## [1.1.8] - 2025-08-11

### Added
- Version 1.1.8 release

## [1.1.7] - 2025-08-10

### Added
- Version 1.1.7 release

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Initial release of the Directus Module Export extension
- **Data Import/Export**: Transfer collection data between Directus instances
- **API Integration**: Import data from external APIs
- **Token Validation**: Secure authentication with admin tokens
- **History Management**: Save and reuse domain and token configurations
- **Real-time Status**: Monitor import/export operations with live feedback
- **Collection Selection**: Choose specific collections for data transfer
- **Error Handling**: Comprehensive error reporting and recovery

### Features
- User-friendly module interface for data operations
- Support for multiple domain configurations
- Secure token storage and validation
- History management for domains and tokens
- Real-time operation status monitoring
- Collection-specific import/export operations
- Comprehensive error handling and user feedback

### Technical
- Vue 3 composition API
- Directus Extensions SDK v10 compatibility
- TypeScript support with full type definitions
- Modular architecture
- Secure API communication
- Local storage for configuration persistence

### Security
- Admin token validation
- Secure storage of sensitive data
- HTTPS communication support
- Permission-based access control
- History clearing options for security 