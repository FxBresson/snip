import fs from 'fs-extra'
import path from 'node:path'

import {Repository, SnippetItem} from '../types/index.js'

export class Indexer {
  async indexRepository(repo: Repository): Promise<SnippetItem[]> {
    const items: SnippetItem[] = []

    if (!(await fs.pathExists(repo.localPath))) {
      throw new Error(`Repository path does not exist: ${repo.localPath}`)
    }

    try {
      // Get all language/scope directories
      const scopeDirs = await this.getScopeDirectories(repo.localPath)

      const scopePromises = scopeDirs.map(async (scopeDir) => {
        const scopeName = path.basename(scopeDir)
        return this.indexScope(scopeDir, repo.alias, scopeName)
      })

      const scopeResults = await Promise.all(scopePromises)
      for (const scopeItems of scopeResults) {
        items.push(...scopeItems)
      }
    } catch (error) {
      throw new Error(`Failed to index repository ${repo.alias}: ${error}`)
    }

    return items
  }

  private async getScopeDirectories(repoPath: string): Promise<string[]> {
    const scopeDirs: string[] = []

    try {
      const entries = await fs.readdir(repoPath, {withFileTypes: true})

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scopeDirs.push(path.join(repoPath, entry.name))
        }
      }
    } catch (error) {
      throw new Error(`Failed to read scope directories: ${error}`)
    }

    return scopeDirs
  }

  private async indexDirectItems(
    typePath: string,
    items: SnippetItem[],
    repoAlias: string,
    scopeName: string,
    type: 'boilerplate' | 'module',
  ): Promise<void> {
    const entries = await fs.readdir(typePath, {withFileTypes: true})

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const itemPath = path.join(typePath, entry.name)
        const metadata = await this.loadMetadata(itemPath)

        items.push({
          metadata,
          name: entry.name,
          path: itemPath,
          repository: repoAlias,
          scope: scopeName,
          type,
        })
      }
    }
  }

  private async indexScope(scopePath: string, repoAlias: string, scopeName: string): Promise<SnippetItem[]> {
    const items: SnippetItem[] = []

    try {
      const typeDirs = ['snippet', 'boilerplate', 'module']

      const typePromises = typeDirs.map(async (typeDir) => {
        const typePath = path.join(scopePath, typeDir)
        const exists = await fs.pathExists(typePath)
        return exists
          ? this.indexType(typePath, repoAlias, scopeName, typeDir as 'boilerplate' | 'module' | 'snippet')
          : []
      })

      const typeResults = await Promise.all(typePromises)
      for (const typeItems of typeResults) {
        items.push(...typeItems)
      }
    } catch (error) {
      throw new Error(`Failed to index scope ${scopeName}: ${error}`)
    }

    return items
  }

  private async indexSnippets(
    snippetsPath: string,
    items: SnippetItem[],
    repoAlias: string,
    scopeName: string,
  ): Promise<void> {
    const entries = await fs.readdir(snippetsPath, {withFileTypes: true})

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // This is a category directory
        const categoryName = entry.name
        const categoryPath = path.join(snippetsPath, entry.name)

        // Get all files in the category directory
        const categoryEntries = await fs.readdir(categoryPath, {withFileTypes: true})

        for (const fileEntry of categoryEntries) {
          if (fileEntry.isFile() && !fileEntry.name.endsWith('.meta.json')) {
            // This is a snippet file
            const snippetName = fileEntry.name
            const snippetPath = path.join(categoryPath, snippetName)
            const metadata = await this.loadSnippetMetadata(snippetPath)

            const item: SnippetItem = {
              category: categoryName,
              filePath: snippetPath,
              metadata,
              name: path.parse(snippetName).name, // Remove extension for display
              path: categoryPath, // Keep the category path for compatibility
              repository: repoAlias,
              scope: scopeName,
              type: 'snippet',
            }

            items.push(item)
          }
        }
      }
    }
  }

  private async indexType(
    typePath: string,
    repoAlias: string,
    scopeName: string,
    type: 'boilerplate' | 'module' | 'snippet',
  ): Promise<SnippetItem[]> {
    const items: SnippetItem[] = []

    try {
      if (type === 'snippet') {
        // Snippets are files organized in category folders
        await this.indexSnippets(typePath, items, repoAlias, scopeName)
      } else {
        // Boilerplate and modules are folder-based
        await this.indexDirectItems(typePath, items, repoAlias, scopeName, type)
      }
    } catch (error) {
      throw new Error(`Failed to index type ${type}: ${error}`)
    }

    return items
  }

  private async loadMetadata(itemPath: string): Promise<SnippetItem['metadata']> {
    const metaPath = path.join(itemPath, 'meta.json')

    if (await fs.pathExists(metaPath)) {
      try {
        return await fs.readJson(metaPath)
      } catch {
        // Ignore invalid JSON
        return undefined
      }
    }

    return undefined
  }

  private async loadSnippetMetadata(snippetPath: string): Promise<SnippetItem['metadata']> {
    // Remove file extension to get base name, then add .meta.json
    const baseName = path.parse(snippetPath).name
    const dirName = path.dirname(snippetPath)
    const metaPath = path.join(dirName, `${baseName}.meta.json`)

    if (await fs.pathExists(metaPath)) {
      try {
        return await fs.readJson(metaPath)
      } catch {
        // Ignore invalid JSON
        return undefined
      }
    }

    return undefined
  }
}
