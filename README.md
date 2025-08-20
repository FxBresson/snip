# Snip CLI

A powerful CLI tool for managing and sharing code snippets, boilerplates, and modules across projects and teams. Snip allows developers to organize reusable code in Git repositories and quickly access them from anywhere.

## Features

- 🔍 **Fuzzy Search**: Quickly find snippets using intelligent search across names, descriptions, and tags
- 📋 **Multiple Output Options**: Copy to clipboard or pull directly to your project directory
- 🔄 **Git Integration**: Seamlessly sync with Git repositories for team collaboration
- 🏷️ **Rich Metadata**: Support for descriptions, tags, and usage examples
- 📁 **Organized Structure**: Hierarchical organization by language/scope, type, and categories
- 💾 **Local Caching**: Fast access with automatic cache refresh
- 🎯 **Scoped Search**: Search within specific repositories or scopes
- 🔧 **Interactive Configuration**: Easy repository management and configuration

## Installation

### npm (Recommended)

```bash
# Install globally
npm install -g snip-cli

# Or use with npx (no installation required)
npx snip-cli --help
```

### Homebrew (macOS/Linux)

```bash
# Add the tap (coming soon)
brew tap yourusername/snip
brew install snip
```

## Quick Start

1. **Initialize a repository**:

   ```bash
   snip init https://github.com/username/my-snippets.git
   ```

2. **Search and pull snippets**:

   ```bash
   snip pull "react hook"
   snip pull "express middleware" --scope backend
   ```

3. **Refresh repositories**:
   ```bash
   snip refresh
   ```

## Repository Structure

Organize your snippet repository using this standardized structure:

```
your-snippets-repo/
├── javascript/                      # Language or scope
│   ├── snippet/
│   │   ├── hooks/                   # Category (mandatory for snippets)
│   │   │   ├── use-fetch.js         # Snippet file
│   │   │   ├── use-fetch.meta.json  # Metadata alongside file
│   │   │   ├── use-auth.ts
│   │   │   └── use-auth.meta.json
│   │   └── utilities/               # Another category
│   │       └── debounce.js
│   ├── boilerplate/
│   │   ├── express-api/             # Folder-based (with meta.json inside)
│   │   │   ├── server.js
│   │   │   ├── package.json
│   │   │   └── meta.json
│   │   └── react-component/
│   │       ├── Component.tsx
│   │       ├── Component.test.tsx
│   │       └── meta.json
│   └── module/
│       └── auth-utils/              # Folder-based (with meta.json inside)
│           ├── index.js
│           ├── types.ts
│           └── meta.json
├── python/
│   ├── snippet/
│   │   └── decorators/
│   │       ├── cache.py
│   │       └── cache.meta.json
│   └── boilerplate/
│       └── flask-api/
│           ├── app.py
│           ├── requirements.txt
│           └── meta.json
└── css/
    └── snippet/
        └── animations/
            ├── fade-in.css
            └── fade-in.meta.json
```

### Metadata Format

Each snippet can optionally include a metadata file with additional information:

**For snippets**: Create a `.meta.json` file alongside your snippet file (optional):

```
use-fetch.js
use-fetch.meta.json  # Optional
```

**For boilerplate and modules**: Create a `meta.json` file inside the folder (optional):

```
express-api/
├── server.js
├── package.json
└── meta.json  # Optional
```

Metadata format (all fields are optional):

```json
{
  "description": "A custom React hook for fetching data with loading and error states",
  "tags": ["react", "hooks", "fetch", "api"],
  "example": "const { data, loading, error } = useFetch('/api/users');"
}
```

## Commands

### `snip init <git-url> [options]`

Initialize a new snippet repository.

```bash
# Basic initialization
snip init https://github.com/username/snippets.git

# With custom alias
snip init https://github.com/username/snippets.git --alias my-snippets

# Set as default repository
snip init https://github.com/username/snippets.git --default

# Set as default with specific scope
snip init https://github.com/username/snippets.git --default javascript
```

**Options:**

- `--alias, -a <name>`: Custom alias for the repository
- `--default, -d [scope]`: Set as default repository, optionally with default scope

### `snip pull <query> [options]`

Search and pull code snippets.

```bash
# Basic search
snip pull "react hook"

# Search within specific scope
snip pull "middleware" --scope backend
snip pull "animation" --scope frontend/css

# Pull directly to directory
snip pull "express server" --target ./src/server

# Search with multiple terms
snip pull "auth jwt token"
```

**Options:**

- `--scope, -s <scope>`: Search within specific repository or scope (format: `repo` or `repo/scope`)
- `--target, -t <path>`: Target directory to pull files to

**Interactive Features:**

- Fuzzy search with intelligent matching
- Preview snippets before pulling
- Choose between copying to clipboard or pulling to directory
- Autocomplete for scope parameter

### `snip refresh [repo-alias]`

Refresh repository cache.

```bash
# Refresh all repositories
snip refresh

# Refresh specific repository
snip refresh my-snippets
```

Cache is automatically refreshed when:

- Cache is older than 2 hours (configurable)
- Running `snip pull` command
- Manually using `snip refresh`

### `snip config`

Interactive configuration management.

```bash
snip config
```

Features:

- View repository details
- Set default repository
- Remove repositories
- Clear cache
- View local storage status

## Configuration

Snip stores all configuration and cache in `~/.snip/`:

```
~/.snip/
├── config.json          # Repository configuration
├── cache/              # Cached snippet indexes
│   ├── repo1.json
│   └── repo2.json
└── repos/              # Local repository clones
    ├── repo1/
    └── repo2/
```

### Authentication for Private Repositories

For private repositories, ensure your Git credentials are properly configured:

```bash
# Using SSH (recommended)
snip init git@github.com:username/private-snippets.git

# Using HTTPS with token
git config --global credential.helper store
# Then enter your credentials when prompted
```

## Best Practices

### Repository Organization

1. **Use clear scope names**: `javascript`, `python`, `frontend`, `backend`, `devops`
2. **Mandatory categories for snippets**: Group related snippets in categories (e.g., `hooks`, `utilities`, `decorators`)
3. **Descriptive names**: Use kebab-case for snippet names
4. **Include metadata**: Add metadata files with descriptions and tags (optional but recommended)
5. **File-based snippets**: Snippets are individual files, not folders
6. **Folder-based boilerplates/modules**: Boilerplates and modules remain folder-based for multi-file structures

### Snippet Creation

1. **Keep it focused**: Each snippet should solve one specific problem
2. **Add examples**: Include usage examples in metadata
3. **Use comments**: Add helpful comments in your code
4. **Test before committing**: Ensure snippets work as expected

### Team Collaboration

1. **Establish conventions**: Agree on naming and organization standards
2. **Regular updates**: Keep repositories updated with new snippets
3. **Review process**: Use pull requests for quality control
4. **Documentation**: Maintain a README in your snippet repository

## Privacy and Security

Snip is designed with privacy in mind:

- **Local-first**: All data is stored locally on your machine
- **No telemetry**: No usage data is collected or transmitted
- **Git-based**: Uses standard Git protocols for repository access
- **Offline capable**: Works offline with cached data

## Troubleshooting

### Common Issues

**Repository not found**:

```bash
# Check if repository is accessible
git clone <repository-url> /tmp/test-repo
```

**Cache issues**:

```bash
# Clear cache and refresh
snip config  # Select "Clear all cache"
snip refresh
```

**Permission errors**:

```bash
# Check directory permissions
ls -la ~/.snip/
```

**Network issues**:

```bash
# Test connectivity
ping github.com
```

### Debug Mode

Enable verbose logging by setting the environment variable:

```bash
DEBUG=snip* snip pull "my query"
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

PolyForm Noncommercial 1.0.0 License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/yourusername/snip-cli/wiki)
- 🐛 [Report Issues](https://github.com/yourusername/snip-cli/issues)
- 💬 [Discussions](https://github.com/yourusername/snip-cli/discussions)

---

**Made with ❤️ for developers who love to share and reuse code efficiently.**
