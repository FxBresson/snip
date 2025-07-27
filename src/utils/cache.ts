import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

import {Repository, SnippetItem} from '../types/index.js'

const CACHE_DIR = path.join(os.homedir(), '.snip', 'cache')

export class CacheManager {
  constructor() {
    this.ensureCacheDir()
  }

  async clearCache(repoAlias?: string): Promise<void> {
    try {
      if (repoAlias) {
        const cacheFile = this.getCacheFile(repoAlias)
        if (await fs.pathExists(cacheFile)) {
          await fs.remove(cacheFile)
        }
      } else {
        await fs.emptyDir(CACHE_DIR)
      }
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error}`)
    }
  }

  async getAllCachedItems(repositories: Repository[]): Promise<SnippetItem[]> {
    const allItems: SnippetItem[] = []

    for (const repo of repositories) {
      const items = await this.loadCache(repo.alias)
      if (items) {
        allItems.push(...items)
      }
    }

    return allItems
  }

  async loadCache(repoAlias: string): Promise<null | SnippetItem[]> {
    try {
      const cacheFile = this.getCacheFile(repoAlias)

      if (!(await fs.pathExists(cacheFile))) {
        return null
      }

      const cache = await fs.readJson(cacheFile)
      return cache.items || null
    } catch {
      // Return null for any cache loading errors
      return null
    }
  }

  async saveCache(repoAlias: string, items: SnippetItem[]): Promise<void> {
    try {
      const cacheFile = this.getCacheFile(repoAlias)
      await fs.writeJson(
        cacheFile,
        {
          items,
          timestamp: new Date().toISOString(),
        },
        {spaces: 2},
      )
    } catch (error) {
      throw new Error(`Failed to save cache for ${repoAlias}: ${error}`)
    }
  }

  private ensureCacheDir(): void {
    fs.ensureDirSync(CACHE_DIR)
  }

  private getCacheFile(repoAlias: string): string {
    return path.join(CACHE_DIR, `${repoAlias}.json`)
  }
}
