import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import clipboardy from 'clipboardy'
import inquirer from 'inquirer'
import ora, {type Ora} from 'ora'

import type {Repository, SearchResult, SnippetItem} from '../types/index.js'

import {CacheManager} from '../utils/cache.js'
import {ConfigManager} from '../utils/config.js'
import {FileOperations} from '../utils/file-operations.js'
import {GitManager} from '../utils/git.js'
import {Indexer} from '../utils/indexer.js'
import {SearchEngine} from '../utils/search.js'

export class PullCommand extends Command {
  static args = {
    query: Args.string({
      description: 'Search query for snippets',
      required: false,
    }),
  }
  static description = 'Search and pull code snippets'
  static examples = [
    '<%= config.bin %> <%= command.id %> react hook',
    '<%= config.bin %> <%= command.id %> "express middleware" --scope backend',
    '<%= config.bin %> <%= command.id %> auth --target ./src/utils',
    '<%= config.bin %> <%= command.id %>',
  ]
  static flags = {
    scope: Flags.string({
      char: 's',
      description: 'Search within specific repository or scope (repo/scope)',
    }),
    target: Flags.string({
      char: 't',
      description: 'Target directory to pull files to',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(PullCommand)

    // Prompt for query if not provided
    let {query} = args
    if (!query) {
      const {searchQuery} = await inquirer.prompt([
        {
          message: 'Enter search query:',
          name: 'searchQuery',
          type: 'input',
          validate(input: string) {
            if (!input.trim()) {
              return 'Search query is required'
            }

            return true
          },
        },
      ])
      query = searchQuery.trim()
    }

    if (!query) {
      this.log(chalk.red('Search query is required'))
      this.exit(1)
    }

    const configManager = new ConfigManager()
    const gitManager = new GitManager()
    const indexer = new Indexer()
    const cacheManager = new CacheManager()
    const searchEngine = new SearchEngine()
    const fileOps = new FileOperations()

    // Check if any repositories are configured
    const repositories = configManager.getAllRepositories()
    if (repositories.length === 0) {
      this.log(chalk.red('No repositories configured. Use "snip init <git-url>" to add a repository.'))
      this.exit(1)
    }

    const spinner = ora('Loading snippets...').start()

    try {
      // Refresh cache if needed
      await this.refreshCacheIfNeeded(repositories, configManager, gitManager, indexer, cacheManager, spinner)

      // Load all cached items
      const allItems = await cacheManager.getAllCachedItems(repositories)

      if (allItems.length === 0) {
        spinner.fail('No snippets found. Try refreshing with "snip refresh".')
        this.exit(1)
      }

      spinner.succeed(`Loaded ${allItems.length} snippets`)

      // Perform search
      const searchScope = flags.scope || configManager.getDefaultPath()
      const searchResults = searchEngine.search(allItems, query, searchScope)

      if (searchResults.length === 0) {
        this.log(chalk.yellow('No snippets found matching your query.'))
        return
      }

      spinner.succeed(`Found ${searchResults.length} snippets matching your query.`)

      // Interactive selection
      const selectedItem = await this.selectSnippet(searchResults, fileOps)

      if (!selectedItem) {
        this.log('Operation cancelled.')
        return
      }

      // Handle output
      await (flags.target
        ? this.pullToDirectory(selectedItem, flags.target, fileOps)
        : this.handleOutput(selectedItem, fileOps))
    } catch (error) {
      spinner.fail(`Error: ${error}`)
      this.exit(1)
    }
  }

  private async copyToClipboard(item: SnippetItem, fileOps: FileOperations): Promise<void> {
    try {
      const content = await fileOps.getFileContents(item)
      await clipboardy.write(content)
      this.log(chalk.green(`✓ Copied ${item.name} to clipboard`))
    } catch (error) {
      this.log(chalk.red(`Failed to copy to clipboard: ${error}`))
    }
  }

  private async handleOutput(item: SnippetItem, fileOps: FileOperations): Promise<void> {
    const choices = ['Copy to clipboard', 'Pull to directory']

    // Only show clipboard option for snippets
    const availableChoices = item.type === 'snippet' ? choices : ['Pull to directory']

    const outputChoice = (await inquirer.prompt([
      {
        choices: availableChoices,
        message: 'How would you like to use this snippet?',
        name: 'output',
        type: 'list',
      },
    ])) as {output: string}

    if (outputChoice.output === 'Copy to clipboard') {
      await this.copyToClipboard(item, fileOps)
    } else {
      const targetPath = await this.promptForDirectory()
      if (targetPath) {
        await this.pullToDirectory(item, targetPath, fileOps)
      }
    }
  }

  private async promptForDirectory(): Promise<null | string> {
    const answer = (await inquirer.prompt([
      {
        default: '.',
        message: 'Enter target directory path:',
        name: 'path',
        type: 'input',
        validate(input: string) {
          if (!input.trim()) {
            return 'Please enter a valid path'
          }

          return true
        },
      },
    ])) as {path: string}

    return answer.path
  }

  private async pullToDirectory(item: SnippetItem, targetPath: string, fileOps: FileOperations): Promise<void> {
    try {
      await fileOps.copyToDirectory(item, targetPath)
      this.log(chalk.green(`✓ Pulled ${item.name} to ${targetPath}`))
    } catch (error) {
      this.log(chalk.red(`Failed to pull to directory: ${error}`))
    }
  }

  private async refreshCacheIfNeeded(
    repositories: Repository[],
    configManager: ConfigManager,
    gitManager: GitManager,
    indexer: Indexer,
    cacheManager: CacheManager,
    spinner: Ora,
  ): Promise<void> {
    for (const repo of repositories) {
      if (configManager.isCacheExpired(repo)) {
        spinner.text = `Refreshing ${repo.alias}...`

        try {
          await gitManager.updateRepository(repo.localPath)
          const items = await indexer.indexRepository(repo)
          await cacheManager.saveCache(repo.alias, items)
          configManager.updateRepositoryTimestamp(repo.alias)
        } catch (error) {
          // Continue with stale cache if refresh fails
          this.log(chalk.yellow(`Warning: Failed to refresh ${repo.alias}: ${error}`))
        }
      }
    }
  }

  private async selectSnippet(searchResults: SearchResult[], fileOps: FileOperations): Promise<null | SnippetItem> {
    // Generate choices with previews
    const choicesData = await Promise.all(
      searchResults.slice(0, 20).map(async (result) => {
        const {item} = result
        const baseName = `${chalk.bold(item.name)} (${item.type})`
        const selectedBaseName = chalk.cyan(`${chalk.bold(item.name)} (${item.type})`)

        const description = item.metadata?.description || ''
        const location = `${item.repository}/${item.scope}${item.category ? `/${item.category}` : ''}/${item.name}`

        const name = `${baseName}${description ? `: ${description}` : ''}${chalk.grey(` - [${location}]`)}`
        const selectedName = `${selectedBaseName}${chalk.cyan(
          `${description ? `: ${description}` : ''} - [${location}]`,
        )}`

        // Get preview for this item
        const preview = await fileOps.getPreview(item)

        return {
          item,
          location,
          name,
          preview,
          selectedName,
          short: baseName,
        }
      }),
    )

    const choices = choicesData.map(({item, name, short}) => ({
      name,
      short,
      value: item as null | SnippetItem,
    }))

    const choicesMap = new Map(
      choicesData.map(({location, preview, selectedName}) => [
        `${location}`,
        `${chalk.cyan('❯')} ${selectedName}\n${chalk.grey(preview)}`,
      ]),
    )

    choices.push({name: 'Cancel', short: 'Cancel', value: null})

    const answer = (await inquirer.prompt([
      {
        choices,
        message: 'Select a snippet:',
        name: 'snippet',
        pageSize: 20,
        theme: {
          style: {
            answer: (answer: string) => {
              if (answer.includes('Cancel')) {
                return chalk.red(answer)
              }

              return chalk.cyan(answer)
            },
            highlight: (choiceName: string) => {
              if (choiceName.includes('Cancel')) {
                return chalk.red(choiceName)
              }

              const location = JSON.stringify(choiceName)
                .match(/-\s\[(.*)\]/i)
                ?.at(1)
              if (location) {
                const choice = choicesMap.get(location)
                if (choice) {
                  return choice
                }
              }

              return choiceName
            },
          },
        },
        type: 'list',
      },
    ])) as {snippet: SnippetItem}

    return answer.snippet
  }
}
