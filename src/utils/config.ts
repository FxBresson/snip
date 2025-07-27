import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

import {Config, Repository} from '../types/index.js'

const CONFIG_DIR = path.join(os.homedir(), '.snip')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const REPOS_DIR = path.join(CONFIG_DIR, 'repos')

export class ConfigManager {
  private config: Config

  constructor() {
    this.ensureConfigDir()
    this.config = this.loadConfig()
  }

  addRepository(repo: Repository): void {
    const existingIndex = this.config.repositories.findIndex((r) => r.alias === repo.alias || r.url === repo.url)

    if (existingIndex === -1) {
      this.config.repositories.push(repo)
    } else {
      this.config.repositories[existingIndex] = repo
    }

    this.saveConfig(this.config)
  }

  clearDefaultPath(): void {
    this.config.defaultPath = undefined
    this.saveConfig(this.config)
  }

  getAllRepositories(): Repository[] {
    return [...this.config.repositories]
  }

  getConfig(): Config {
    return {...this.config}
  }

  getDefaultPath(): string | undefined {
    return this.config.defaultPath
  }

  getDefaultRepository(): Repository | undefined {
    if (!this.config.defaultPath) return undefined

    const [alias] = this.config.defaultPath.split('/')
    return this.config.repositories.find((r) => r.alias === alias)
  }

  getReposDir(): string {
    return REPOS_DIR
  }

  getRepository(alias: string): Repository | undefined {
    return this.config.repositories.find((r) => r.alias === alias)
  }

  isCacheExpired(repo: Repository): boolean {
    const now = new Date()
    const diff = now.getTime() - new Date(repo.lastUpdated).getTime()
    const hoursDiff = diff / (1000 * 60 * 60)
    return hoursDiff > this.config.cacheExpiry
  }

  removeRepository(alias: string): boolean {
    const initialLength = this.config.repositories.length
    this.config.repositories = this.config.repositories.filter((r) => r.alias !== alias)

    if (this.config.repositories.length < initialLength) {
      this.saveConfig(this.config)
      return true
    }

    return false
  }

  setDefaultPath(path: string): boolean {
    const [alias] = path.split('/')
    const repo = this.config.repositories.find((r) => r.alias === alias)
    if (repo) {
      this.config.defaultPath = path
      this.saveConfig(this.config)
      return true
    }

    return false
  }

  updateRepositoryTimestamp(alias: string): void {
    const repo = this.config.repositories.find((r) => r.alias === alias)
    if (repo) {
      repo.lastUpdated = new Date()
      this.saveConfig(this.config)
    }
  }

  private ensureConfigDir(): void {
    fs.ensureDirSync(CONFIG_DIR)
    fs.ensureDirSync(REPOS_DIR)
  }

  private loadConfig(): Config {
    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultConfig: Config = {
        cacheExpiry: 2, // 2 hours
        defaultPath: undefined,
        repositories: [],
      }
      this.saveConfig(defaultConfig)
      return defaultConfig
    }

    try {
      return fs.readJsonSync(CONFIG_FILE)
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`)
    }
  }

  private saveConfig(config: Config): void {
    try {
      fs.writeJsonSync(CONFIG_FILE, config, {spaces: 2})
      this.config = config
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`)
    }
  }
}
