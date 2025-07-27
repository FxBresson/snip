import {Command} from '@oclif/core'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'

import type {Repository} from '../types/index.js'

import {ConfigManager} from '../utils/config.js'

export class ConfigCommand extends Command {
  static description = 'Manage repository configuration'
  static examples = ['<%= config.bin %> <%= command.id %>']

  async run(): Promise<void> {
    const configManager = new ConfigManager()

    while (true) {
      const repositories = configManager.getAllRepositories()

      this.log('\n' + chalk.cyan('Repository Configuration'))
      this.log(chalk.gray('========================'))

      if (repositories.length === 0) {
        this.log(chalk.yellow('No repositories configured.'))
      } else {
        const defaultPath = configManager.getDefaultPath()
        for (const [index, repo] of repositories.entries()) {
          const isDefault = defaultPath?.startsWith(repo.alias)
          const defaultFlag = isDefault ? chalk.green(' (default)') : ''
          this.log(`${index + 1}. ${chalk.cyan(repo.alias)}${defaultFlag}`)
          this.log(`   ${chalk.gray(repo.url)}`)
          this.log(`   ${chalk.gray(`Last updated: ${repo.lastUpdated}`)}`)
        }

        if (defaultPath) {
          this.log(`\nDefault path: ${chalk.cyan(defaultPath)}`)
        }
      }

      const choices = ['View details', 'Set default path', 'Remove repository', 'Clear all cache', 'Exit']

      const action = (await inquirer.prompt([
        {
          choices,
          message: 'What would you like to do?',
          name: 'action',
          type: 'list',
        },
      ])) as {action: string}

      try {
        switch (action.action) {
          case 'Clear all cache': {
            await this.clearCache()
            break
          }

          case 'Exit': {
            return
          }

          case 'Remove repository': {
            await this.removeRepository(repositories, configManager)
            break
          }

          case 'Set default path': {
            await this.setDefaultPath(repositories, configManager)
            break
          }

          case 'View details': {
            await this.viewDetails(repositories)
            break
          }
        }
      } catch (error) {
        this.log(chalk.red(`Error: ${error}`))
      }
    }
  }

  private async clearCache(): Promise<void> {
    const confirm = (await inquirer.prompt([
      {
        default: false,
        message: 'Are you sure you want to clear all cache?',
        name: 'confirm',
        type: 'confirm',
      },
    ])) as {confirm: boolean}

    if (confirm.confirm) {
      const {CacheManager} = await import('../utils/cache.js')
      const cacheManager = new CacheManager()
      await cacheManager.clearCache()
      this.log(chalk.green('✓ Cache cleared'))
    }
  }

  private async removeRepository(repositories: Repository[], configManager: ConfigManager): Promise<void> {
    if (repositories.length === 0) {
      this.log(chalk.yellow('No repositories to remove.'))
      return
    }

    const choices = repositories.map((repo) => ({
      name: `${repo.alias} (${repo.url})`,
      value: repo.alias,
    }))

    const selection = (await inquirer.prompt([
      {
        choices,
        message: 'Select repository to remove:',
        name: 'alias',
        type: 'list',
      },
    ])) as {alias: string}

    const confirm = (await inquirer.prompt([
      {
        default: false,
        message: `Are you sure you want to remove '${selection.alias}'?`,
        name: 'confirm',
        type: 'confirm',
      },
    ])) as {confirm: boolean}

    if (confirm.confirm) {
      const success = configManager.removeRepository(selection.alias)
      if (success) {
        // Clear default path if it references this repository
        const defaultPath = configManager.getDefaultPath()
        if (defaultPath?.startsWith(selection.alias)) {
          configManager.clearDefaultPath()
        }

        // Also remove local repository and cache
        const repo = repositories.find((r) => r.alias === selection.alias)
        if (repo) {
          try {
            await fs.remove(repo.localPath)
            this.log(chalk.green(`✓ Removed repository '${selection.alias}'`))
          } catch (error) {
            this.log(chalk.yellow(`Repository config removed, but failed to delete local files: ${error}`))
          }
        }
      } else {
        this.log(chalk.red('Failed to remove repository'))
      }
    }
  }

  private async setDefaultPath(repositories: Repository[], configManager: ConfigManager): Promise<void> {
    if (repositories.length === 0) {
      this.log(chalk.yellow('No repositories configured.'))
      return
    }

    // Get all available scopes
    const {CacheManager} = await import('../utils/cache.js')
    const cacheManager = new CacheManager()
    const allItems = await cacheManager.getAllCachedItems(repositories)

    const scopeSet = new Set<string>()
    for (const repo of repositories) scopeSet.add(repo.alias)
    for (const item of allItems) scopeSet.add(`${item.repository}/${item.scope}`)

    const choices = [...scopeSet].sort().map((path) => ({
      name: path,
      value: path,
    }))

    choices.push({name: chalk.gray('Clear default'), value: 'CLEAR'})

    const selection = (await inquirer.prompt([
      {
        choices,
        message: 'Select default path:',
        name: 'path',
        type: 'list',
      },
    ])) as {path: string}

    if (selection.path === 'CLEAR') {
      configManager.clearDefaultPath()
      this.log(chalk.green('✓ Cleared default path'))
    } else {
      const [alias] = selection.path.split('/')
      const repo = repositories.find((r) => r.alias === alias)

      if (repo) {
        const success = configManager.setDefaultPath(selection.path)
        if (success) {
          this.log(chalk.green(`✓ Set default path to ${selection.path}`))
        } else {
          this.log(chalk.red('Failed to set default path'))
        }
      } else {
        this.log(chalk.red('Invalid repository'))
      }
    }
  }

  private async viewDetails(repositories: Repository[]): Promise<void> {
    if (repositories.length === 0) {
      this.log(chalk.yellow('No repositories to view.'))
      return
    }

    const choices = repositories.map((repo, index) => ({
      name: `${repo.alias} (${repo.url})`,
      value: index,
    }))

    const selection = (await inquirer.prompt([
      {
        choices,
        message: 'Select repository to view:',
        name: 'repo',
        type: 'list',
      },
    ])) as {repo: number}

    const repo = repositories[selection.repo]

    this.log('\n' + chalk.cyan(`Repository: ${repo.alias}`))
    this.log(chalk.gray('='.repeat(20 + repo.alias.length)))
    this.log(`URL: ${repo.url}`)
    this.log(`Local Path: ${repo.localPath}`)
    this.log(`Last Updated: ${repo.lastUpdated}`)

    // Check if local path exists
    const exists = await fs.pathExists(repo.localPath)
    this.log(`Local Repository: ${exists ? chalk.green('✓ Exists') : chalk.red('✗ Missing')}`)
  }
}
