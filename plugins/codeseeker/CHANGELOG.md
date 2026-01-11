# CodeSeeker Changelog

## [1.0.1] - 2025-12-30

### Fixed
- **Phantom Node.js processes on Windows** - MCP server now properly exits when Claude Code disconnects
- **Unity project indexing** - Added exclusions for Library/, Temp/, Logs/, and other Unity folders that were causing 100K+ unnecessary files to be indexed

### Added
- **install_language_support MCP tool** - Dynamically detect and install Tree-sitter parsers for Python, Java, C#, Go, Rust, and more
- **Go parser** - Added regex-based parser for Go projects

### Documentation
- Rewrote README with Graph RAG focus and honest positioning
- Added detailed documentation for indexing and sync mechanisms
- Improved .gitignore with comprehensive exclusion rules

## [1.0.0] - 2025-12-29

### Initial Release
- Semantic code search with hybrid vector + text + path matching
- Knowledge graph for code relationships (imports, exports, calls, extends)
- Auto-detected coding standards (validation, error handling, logging patterns)
- Claude Code plugin with automatic sync hooks
- MCP server for Claude Desktop
- CLI for standalone usage
- Support for TypeScript, JavaScript, Python, Java, C#, Go, and more