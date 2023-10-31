#!/usr/bin/env node
import fs from 'node:fs'
import * as lbq from './index.js'

const arg1 = process.argv[2]
if (['--version', '-v'].includes(arg1)) {
  const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  console.log(`${pkg.name}, ${pkg.version}`)
  process.exit()
}

if (['--help', '-h'].includes(arg1)) {
  console.log(`
  Description
    Simple command line task runner written in Node.js.

  Usage
    $ lbq ...args
`)
  process.exit()
}

const { path, created } = lbq.init()
if (created) {
  console.log(`Created ${path}, edit it to register commands.`)
}

const result = await lbq.parse(process.argv.slice(2))
if (result !== undefined)
  console.log('=>', result)
