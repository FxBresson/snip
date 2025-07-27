export interface Repository {
  alias: string
  lastUpdated: Date
  localPath: string
  url: string
}

export interface SnippetItem {
  category?: string // Required for snippets, optional for boilerplate/modules
  filePath?: string // Path to the actual file (for snippets), undefined for folder-based items
  metadata?: {
    description?: string
    example?: string
    source?: string // Optional URL to track the source of the snippet/module
    tags?: string[]
  }
  name: string
  path: string
  repository: string
  scope: string
  type: 'boilerplate' | 'module' | 'snippet'
}

export interface Config {
  cacheExpiry: number // hours
  defaultPath?: string // Format: "alias" or "alias/scope"
  repositories: Repository[]
}

export interface SearchResult {
  item: SnippetItem
  score: number
}
