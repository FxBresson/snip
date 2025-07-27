import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import inquirer from 'inquirer'
import path from 'node:path'
import ora from 'ora'

import {CacheManager} from '../utils/cache.js'
import {ConfigManager} from '../utils/config.js'
import {GitManager} from '../utils/git.js'
import {Indexer} from '../utils/indexer.js'

export class InitCommand extends Command {
  static args = {
    'git-url': Args.string({
      description: 'Git repository URL',
      required: false,
    }),
  }
  static description = 'Initialize a new snippet repository'
  static examples = [
    '<%= config.bin %> <%= command.id %> https://github.com/username/snippets.git',
    '<%= config.bin %> <%= command.id %> https://github.com/username/snippets.git --alias my-snippets',
    '<%= config.bin %> <%= command.id %> https://github.com/username/snippets.git --default',
    '<%= config.bin %> <%= command.id %> https://github.com/username/snippets.git --default javascript',
    '<%= config.bin %> <%= command.id %>',
  ]
  static flags = {
    alias: Flags.string({
      char: 'a',
      description: 'Alias name for the repository',
    }),
    default: Flags.string({
      allowNo: false,
      char: 'd',
      description: 'Set as default repository, optionally with default scope',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(InitCommand)

    // Prompt for git URL if not provided
    let gitUrl = args['git-url']
    if (!gitUrl) {
      const {url} = await inquirer.prompt([
        {
          message: 'Enter the Git repository URL:',
          name: 'url',
          type: 'input',
          validate(input: string) {
            if (!input.trim()) {
              return 'Git repository URL is required'
            }

            return true
          },
        },
      ])
      gitUrl = url.trim()
    }

    if (!gitUrl) {
      this.log(chalk.red('Git repository URL is required'))
      this.exit(1)
    }

    const configManager = new ConfigManager()
    const gitManager = new GitManager()
    const indexer = new Indexer()
    const cacheManager = new CacheManager()

    // Generate default alias from git URL
    const defaultAlias = this.generateAlias(gitUrl)

    // Prompt for alias if not provided
    let {alias} = flags
    if (!alias) {
      const {aliasInput} = await inquirer.prompt([
        {
          default: defaultAlias,
          message: 'Enter an alias for the repository:',
          name: 'aliasInput',
          type: 'input',
          validate(input: string) {
            if (!input.trim()) {
              return 'Alias is required'
            }

            return true
          },
        },
      ])
      alias = aliasInput.trim()
    }

    if (!alias) {
      this.log(chalk.red('Alias is required'))
      this.exit(1)
    }

    // Prompt for default setting if not provided
    let defaultScope = flags.default
    if (defaultScope === undefined) {
      const {scope, setAsDefault} = await inquirer.prompt([
        {
          default: false,
          message: 'Set this repository as default?',
          name: 'setAsDefault',
          type: 'confirm',
        },
        {
          default: '',
          message: 'Enter default scope (optional):',
          name: 'scope',
          type: 'input',
          when(answers) {
            return answers.setAsDefault
          },
        },
      ])

      if (setAsDefault) {
        defaultScope = scope.trim() || true
      }
    }

    // Check if repository already exists
    const existingRepo = configManager.getRepository(alias)
    if (existingRepo) {
      this.log(chalk.yellow(`Repository with alias '${alias}' already exists. Updating...`))
    }

    const spinner = ora('Validating repository...').start()

    try {
      // Validate repository
      const isValid = await gitManager.isValidRepository(gitUrl)
      if (!isValid) {
        spinner.fail('Invalid repository URL')
        this.exit(1)
      }

      spinner.text = 'Cloning repository...'
      const localPath = path.join(configManager.getReposDir(), alias)
      await gitManager.cloneRepository(gitUrl, localPath)

      spinner.text = 'Indexing snippets...'
      const repository = {
        alias,
        lastUpdated: new Date(),
        localPath,
        url: gitUrl,
      }

      const items = await indexer.indexRepository(repository)
      await cacheManager.saveCache(alias, items)

      // Save repository configuration
      configManager.addRepository(repository)

      // Set as default if requested
      if (defaultScope !== undefined) {
        const defaultPath = typeof defaultScope === 'string' ? `${alias}/${defaultScope}` : alias
        configManager.setDefaultPath(defaultPath)
      }

      spinner.succeed(`Repository initialized successfully! Found ${items.length} items.`)

      this.log(chalk.green(`✓ Repository: ${gitUrl}`))
      this.log(chalk.green(`✓ Alias: ${alias}`))
      if (defaultScope !== undefined) {
        this.log(chalk.green(`✓ Set as default repository`))
        if (typeof defaultScope === 'string') {
          this.log(chalk.green(`✓ Default scope: ${defaultScope}`))
        }
      }

      this.log(chalk.green(`✓ Indexed ${items.length} snippets`))
    } catch (error) {
      spinner.fail(`Failed to initialize repository: ${error}`)
      this.exit(1)
    }
  }

  private generateAlias(gitUrl: string): string {
    // Extract repository name from URL
    const match = gitUrl.match(/\/([^/]+?)(?:\.git)?$/)
    return match ? match[1] : 'snippets'
  }
}
