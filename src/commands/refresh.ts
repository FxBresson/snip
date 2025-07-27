import {Args, Command} from '@oclif/core'
import chalk from 'chalk'
import ora from 'ora'

import {CacheManager} from '../utils/cache.js'
import {ConfigManager} from '../utils/config.js'
import {GitManager} from '../utils/git.js'
import {Indexer} from '../utils/indexer.js'

export class RefreshCommand extends Command {
  static args = {
    'repo-alias': Args.string({
      description: 'Repository alias to refresh (refreshes all if not specified)',
      required: false,
    }),
  }
  static description = 'Refresh repository cache'
  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> my-snippets']

  async run(): Promise<void> {
    const {args} = await this.parse(RefreshCommand)
    const repoAlias = args['repo-alias']

    const configManager = new ConfigManager()
    const gitManager = new GitManager()
    const indexer = new Indexer()
    const cacheManager = new CacheManager()

    const repositories = repoAlias
      ? [configManager.getRepository(repoAlias)].filter(Boolean)
      : configManager.getAllRepositories()

    if (repositories.length === 0) {
      if (repoAlias) {
        this.log(chalk.red(`Repository '${repoAlias}' not found.`))
      } else {
        this.log(chalk.red('No repositories configured. Use "snip init <git-url>" to add a repository.'))
      }

      this.exit(1)
    }

    const spinner = ora('Refreshing repositories...').start()
    let totalItems = 0
    let refreshedCount = 0

    try {
      for (const repo of repositories) {
        if (!repo) {
          continue
        }

        spinner.text = `Refreshing ${repo.alias}...`

        try {
          // Update repository
          await gitManager.updateRepository(repo.localPath)

          // Re-index
          const items = await indexer.indexRepository(repo)

          // Update cache
          await cacheManager.saveCache(repo.alias, items)

          // Update timestamp
          configManager.updateRepositoryTimestamp(repo.alias)

          totalItems += items.length
          refreshedCount++

          this.log(chalk.green(`✓ ${repo.alias}: ${items.length} items`))
        } catch (error) {
          this.log(chalk.red(`✗ ${repo.alias}: ${error}`))
        }
      }

      if (refreshedCount > 0) {
        spinner.succeed(`Refreshed ${refreshedCount} repositories with ${totalItems} total items`)
      } else {
        spinner.fail('Failed to refresh any repositories')
        this.exit(1)
      }
    } catch (error) {
      spinner.fail(`Refresh failed: ${error}`)
      this.exit(1)
    }
  }
}
