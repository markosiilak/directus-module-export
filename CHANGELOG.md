## [2.0.2] - 2025-01-15

### Enhanced
- Improved operation status handling for better user feedback
- Enhanced ZIP import functionality with better error handling and status reporting

## [2.0.1] - 2025-09-02

### Fixed
- ZIP import: infer MIME types for assets to avoid "Binary Data" files
- ZIP import: skip uploading `items.json` and other `.json` files as assets
- ZIP import: avoid duplicate items by using `directus_sync_id_map` mapping
- ZIP import: avoid re-uploading images that already exist in Directus files

### Added
- ZIP export: include `translations.*` by default
- ZIP import: import `translations` via deep writes (`deep=true`)
- ZIP import: move/upload files into a collection-named folder

## [1.1.15] - 2025-01-15

### Added
- Title filter feature: Filter imports by title from the translations table
- Enhanced UI with labeled input fields for better user experience
- Real-time filter feedback showing current filter criteria

### Changed
- Improved input layout with clear labels for Server URL, Admin Token, Import Limit, and Title Filter
- Better visual organization of form controls with proper spacing and alignment

## [1.1.13] - 2025-08-13

### Changed
- README: updated features, usage, prerequisites, compatibility; removed export mention

## [1.1.14] - 2025-08-13

### Security
- Removed unused axios runtime dependency flagged by Socket; package has no runtime deps now

## [1.1.12] - 2025-08-11

### Added
- Version 1.1.12 release

## [1.1.11] - 2025-08-11

### Added
- Version 1.1.11 release

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