// NOT WORKING FOR NOW

import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import inquirer from 'inquirer'
import {type SinonStub, stub} from 'sinon'

describe('init', () => {
  let promptStub: SinonStub

  beforeEach(() => {
    // Stub the inquirer.prompt method before each test
    promptStub = stub(inquirer, 'createPromptModule')
  })

  afterEach(() => {
    // Restore the stub to its original function after each test
    promptStub.restore()
  })

  it('prompts for a name and says hello to Alice', async () => {
    promptStub.onFirstCall().resolves({aliasInput: 'my-snippets'})
    // promptStub.onFirstCall().resolves({setAsDefault: 'N'})

    // const {error, result, stdout} = await runCommand(['snip init https://github.com/username/snippets.git'])
    const {error, result, stdout} = await runCommand(['snip init'])

    const firstCallArgs = promptStub.args
    console.log('MEO', firstCallArgs)

    console.log(stdout)
    console.log(result)
    console.log(error)

    expect(stdout).to.includes('Hello, Alice!')
  })
})
