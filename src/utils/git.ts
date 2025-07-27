import fs from 'fs-extra'
import path from 'node:path'
import {simpleGit, type SimpleGit} from 'simple-git'

export class GitManager {
  private git: SimpleGit

  constructor() {
    this.git = simpleGit()
  }

  async cloneRepository(url: string, targetPath: string): Promise<void> {
    try {
      // Ensure parent directory exists
      await fs.ensureDir(path.dirname(targetPath))

      // Remove existing directory if it exists
      if (await fs.pathExists(targetPath)) {
        await fs.remove(targetPath)
      }

      await this.git.clone(url, targetPath, ['--depth', '1'])
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`)
    }
  }

  async getRepositoryInfo(repoPath: string) {
    try {
      const git = simpleGit(repoPath)
      const remotes = await git.getRemotes(true)
      const status = await git.status()

      return {
        isClean: status.files.length === 0,
        remotes,
        status,
      }
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error}`)
    }
  }

  async isValidRepository(url: string): Promise<boolean> {
    try {
      await this.git.listRemote([url])
      return true
    } catch {
      return false
    }
  }

  async updateRepository(repoPath: string): Promise<void> {
    try {
      const git = simpleGit(repoPath)
      await git.pull()
    } catch (error) {
      throw new Error(`Failed to update repository: ${error}`)
    }
  }
}
