import chalk from 'chalk'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

import {SnippetItem} from '../types/index.js'

export class FileOperations {
  async copyToDirectory(item: SnippetItem, targetPath: string): Promise<void> {
    try {
      // Resolve target path
      const resolvedTarget = this.resolvePath(targetPath)

      // Ensure target directory exists
      await fs.ensureDir(resolvedTarget)

      if (item.type === 'snippet' && item.filePath) {
        // For snippets, copy the single file
        const fileName = path.basename(item.filePath)
        const targetFilePath = path.join(resolvedTarget, fileName)
        await fs.copy(item.filePath, targetFilePath)
      } else {
        // For boilerplate and modules, copy the entire directory
        const targetItemPath = path.join(resolvedTarget, item.name)
        await fs.copy(item.path, targetItemPath)

        // Remove meta.json from copied files if it exists
        const metaPath = path.join(targetItemPath, 'meta.json')
        if (await fs.pathExists(metaPath)) {
          await fs.remove(metaPath)
        }
      }
    } catch (error) {
      throw new Error(`Failed to copy to directory: ${error}`)
    }
  }

  async getFileContents(item: SnippetItem): Promise<string> {
    try {
      if (item.type === 'snippet' && item.filePath) {
        // For snippets, read the single file
        return await fs.readFile(item.filePath, 'utf8')
      }

      // For boilerplate and modules, get all code files
      const files = await this.getCodeFiles(item.path)

      if (files.length === 0) {
        throw new Error('No code files found')
      }

      if (files.length === 1) {
        return await fs.readFile(files[0], 'utf8')
      }

      // Multiple files - concatenate with file headers
      const filePromises = files.map(async (file) => {
        const relativePath = path.relative(item.path, file)
        const fileContent = await fs.readFile(file, 'utf8')
        return `// ${relativePath}\n${fileContent}\n\n`
      })

      const fileContents = await Promise.all(filePromises)
      const content = fileContents.join('')

      return content.trim()
    } catch (error) {
      throw new Error(`Failed to read file contents: ${error}`)
    }
  }

  async getPreview(item: SnippetItem): Promise<string> {
    let preview = ''
    try {
      if (item.metadata?.tags?.length) {
        preview += `    ${chalk.bold('Tags:')} ${item.metadata.tags.join(', ')}\n`
      }

      if (item.metadata?.example) {
        preview += `    ${chalk.bold('Example:')} ${item.metadata.example}\n`
      }

      if (preview !== '') {
        preview += '    ----------------------------------------\n'
      }

      if (item.type === 'snippet' && item.filePath) {
        // For snippets, show file content preview
        const content = await fs.readFile(item.filePath, 'utf8')
        const allLines = content.split('\n')
        const lines = allLines.slice(0, 10) // Show max 10 lines

        preview += '    '
        preview += lines.join('\n    ')

        if (allLines.length > 10) {
          preview += '\n    ...\n'
        }
      } else {
        // For boilerplate and modules, show file structure
        const files = await this.getCodeFiles(item.path)

        if (files.length === 0) {
          preview += '\n    No code files found'
        } else {
          // Show file structure with relative paths
          const fileStructure = files.map((file) => {
            const relativePath = path.relative(item.path, file)
            return `  ${relativePath}`
          })

          // Limit to first 8 files for readability
          const displayFiles = fileStructure.slice(0, 8)
          preview += '\n    ' + displayFiles.join('\n    ')

          if (files.length > 8) {
            preview += `\n    ... and ${files.length - 8} more files`
          }
        }
      }

      return preview
    } catch (error) {
      return `Error generating preview: ${error}`
    }
  }

  private async getCodeFiles(dirPath: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dirPath, {withFileTypes: true})

      const entryPromises = entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isFile() && entry.name !== 'meta.json') {
          return [fullPath]
        }

        if (entry.isDirectory()) {
          return this.getCodeFiles(fullPath)
        }

        return []
      })

      const entryResults = await Promise.all(entryPromises)
      for (const entryFiles of entryResults) {
        files.push(...entryFiles)
      }
    } catch {
      // Ignore errors and return empty array
    }

    return files.sort()
  }

  private resolvePath(targetPath: string): string {
    if (targetPath.startsWith('~')) {
      return path.join(os.homedir(), targetPath.slice(1))
    }

    if (!path.isAbsolute(targetPath)) {
      return path.resolve(process.cwd(), targetPath)
    }

    return targetPath
  }
}
