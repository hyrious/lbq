import { chmodSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

const cliFile = './dist/cli.js'
const content = ['#!/usr/bin/env node', readFileSync(cliFile, 'utf-8')].join('\n')
writeFileSync(cliFile, content)
chmodSync(cliFile, '755')

unlinkSync('./dist/cli.d.ts')
unlinkSync('./dist/index.test.d.ts')
unlinkSync('./dist/index.test.js')
