import fuzzy from 'fuzzy'

import {SearchResult, SnippetItem} from '../types/index.js'

export class SearchEngine {
  getScopeAutocomplete(items: SnippetItem[]): string[] {
    const scopes = new Set<string>()

    for (const item of items) {
      scopes.add(item.repository)
      scopes.add(`${item.repository}/${item.scope}`)
    }

    return [...scopes].sort()
  }

  search(items: SnippetItem[], query: string, scope?: string): SearchResult[] {
    // Filter by scope if provided
    let filteredItems = items
    if (scope) {
      const [repoAlias, scopeName] = scope.includes('/') ? scope.split('/') : [scope, undefined]
      filteredItems = items.filter((item) => {
        if (scopeName) {
          return item.repository === repoAlias && item.scope === scopeName
        }

        return item.repository === repoAlias || item.scope === repoAlias
      })
    }

    if (!query.trim()) {
      return filteredItems.map((item) => ({item, score: 1}))
    }

    // Create searchable strings for each item
    const searchableItems = filteredItems.map((item) => ({
      item,
      searchString: this.createSearchString(item),
    }))

    // Perform fuzzy search
    const results = fuzzy.filter(query, searchableItems, {
      extract: (item) => item.searchString,
    })

    // Convert to SearchResult format and filter by minimum score
    const searchResults = results
      .map((result) => ({
        item: result.original.item,
        score: result.score,
      }))
      .filter((result) => result.score > 0.3) // Minimum score threshold for meaningful matches
      .sort((a, b) => b.score - a.score)

    return searchResults
  }

  private createSearchString(item: SnippetItem): string {
    const parts = [
      item.name,
      item.category,
      item.scope,
      item.metadata?.description,
      ...(item.metadata?.tags || []),
    ].filter(Boolean)

    return parts.join(' ').toLowerCase()
  }
}
