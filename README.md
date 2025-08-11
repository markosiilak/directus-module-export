# Directus Module Export

<p align="left">
  <a href="https://github.com/markosiilak/directus-module-export"><img alt="GitHub Repo" src="https://img.shields.io/badge/GitHub-markosiilak%2Fdirectus--module--export-181717?logo=github" /></a>
  <a href="https://github.com/markosiilak/directus-module-export/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg" /></a>
  <a href="#"><img alt="Directus" src="https://img.shields.io/badge/Directus-11--15-263238?logo=directus&logoColor=white" /></a>
  <a href="#"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/directus-module-export"><img alt="npm" src="https://img.shields.io/npm/v/directus-module-export?color=CB3837&logo=npm" /></a>
  <a href="https://www.npmjs.com/package/directus-module-export"><img alt="Downloads" src="https://img.shields.io/npm/dm/directus-module-export?label=downloads&logo=npm" /></a>
</p>

A Directus module extension for importing collection data from another Directus instance. Simplified for latest Directus versions.

## Features ✨

- **Directus-to-Directus import 🔁**: Transfer collection data from a source Directus instance to your current project
- **Export to file 📦**: Download collection data from your Directus instance for backup or transfer
- **Preflight permission check ✅**: Test collection access before importing
- **Token validation 🛡️**: Validate admin token against the source server
- **History management 🕘**: Save and reuse domain and token inputs (localStorage)
- **Real-time status 📊**: Inline progress and concise error messages
- **Per-collection import 🧩**: Import items for a specific collection
- **File field support 🖼️**: Automatically copies single-file fields (by UUID or object) and reuses or uploads as needed
- **Folder auto-creation 📁**: Files are placed in a collection-named folder, created if missing

### At a glance

<p align="left">
  <img alt="Import" title="Import" src="https://img.shields.io/badge/Import-From%20Directus-5E81F4?style=for-the-badge&logo=download" />
  <img alt="Validate" title="Validate Token" src="https://img.shields.io/badge/Validate-Token-27AE60?style=for-the-badge&logo=vercel" />
  <img alt="Check" title="Preflight Check" src="https://img.shields.io/badge/Preflight-Check-F39C12?style=for-the-badge&logo=checkmarx" />
</p>

## Installation 📦

### From npm

```bash
npm install directus-module-export
```

## Usage ▶️

### Quick start ⚡

1. Open the module in your Directus admin interface.
2. Enter the source Directus API URL and an admin-access token for that source.
3. (Optional) Click “Validate Token” to check the token, or “Test Collections” to quickly verify collection permissions.
4. For each collection you want to import, click “Import from another Directus”.
5. Monitor the import progress and review the status/output. Any failed items will be summarized in the console.
6. (Optional) To export data from your current Directus instance, use the "Export" button available in the module interface. This will allow you to download collection data for backup or transfer.
7. (Optional) Use the "History" feature to quickly reuse previously entered domains and tokens.
8. (Optional) Use the "Clear History" option to remove stored domains and tokens for security.

Notes:
- Provide the token as plain string (no need to prefix with "Bearer ").
- The module normalizes tokens internally.

### File importing 🖼️

- Supported fields:
  - Single-file fields referencing Directus files by UUID (string) or object with `id`
  - Array/many-file relations are skipped (logged as `file_copy_skip`)
- Reuse vs copy:
  - If a target item already has a file in a field and it matches the source by checksum (preferred) or file size/type, the existing file is reused
  - When reusing, the file may be patched to set `title` (from item title, if present) and move it into the target folder
- Upload behavior:
  - Source file metadata fetched from `/files/{id}`; binary fetched from `/assets/{id}`
  - Files are uploaded to the target via `/files` with `FormData` (`file`, optional `title`, `folder`, `filename_download`)
  - Files are placed in a folder named after the collection; the folder is auto-created if missing
  - Title source: uses the item's `title` if available, otherwise first non-empty translation `title`
- Caching:
  - Per-run cache avoids re-uploading the same source file across multiple items
  - Per-item cache prevents duplicate uploads within the same item
- Update mapping (idempotent, optional):
  - If the `directus_sync_id_map` collection exists on the target, imports update existing items mapped by source `id`; otherwise new items are created
- Permissions required:
  - Source: read `/items/{collection}`, `/files/{id}`, `/assets/{id}`
  - Target: create/update `/items/{collection}`, `/files`, `/folders`, and (optionally) read/write `directus_sync_id_map`
- Error tolerance:
  - If a file copy fails, the item import continues and the field is left unchanged; details are logged as `file_copy_error`

### Configuration ⚙️

#### Domain settings 🌐
- Recent domains are stored locally for quick reuse.

#### Authentication 🔐
- **Admin token**: Required on the source Directus to READ the collections you import.
- **Token validation**: The module verifies token usability before import.

## Security considerations 🔒

- Admin tokens are stored locally in browser storage.
- Token validation ensures proper permissions.
- Clear history options are available for sensitive data.
- Secure API communication is enforced over HTTPS.
- Imported data is not sent to third-party services; all transfers are direct between your browser and the specified Directus instances.
- Only the collections and fields you select are accessed; no other data is read or modified.
- The module does not store or transmit your data outside your environment.
- For best security, use temporary admin tokens and clear history after use.

## Development 🧰

### Prerequisites

- Node.js >= 22 (already installed, do not install manually)
- Directus Extensions SDK (`@directus/extensions-sdk`)
- TypeScript
- [Directus CLI](https://docs.directus.io/cli/) (for building and linking extensions)
- npm (Node.js package manager)

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
├── index.ts              # Module definition
├── module.vue            # Main Vue component
├── utils/
│   ├── apiHandlers.ts    # API logic for import, validation, and sync
│   └── helpers.ts        # Utility/helper functions
└── shims.d.ts            # TypeScript declaration
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

## Troubleshooting 🛠️

### Common issues

1. **Token validation fails**
   - Ensure the token is valid and the API URL is reachable over HTTPS.

2. **403 Forbidden on a collection**
   - On the source Directus, grant the token’s role READ permission on that collection (and any related collections or files).

3. **History not saving**
   - Check browser storage permissions; clear cache if needed.


## License 📝

MIT License - see [LICENSE](LICENSE) file for details.

## Support 💬

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting section

## Changelog 📑

See [CHANGELOG.md](CHANGELOG.md) for version history and updates. Notable:

- 1.1.0: Reworked for Directus v11+, import from Directus-only; removed legacy API import and export flows; improved token handling and preflight checks.