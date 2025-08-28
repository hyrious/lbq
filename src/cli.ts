import fs from 'node:fs'
import path from 'node:path'
import pkg from '../package.json' with { type: 'json'}
import { configFile, defineConfig } from './index.js'

const args = process.argv.slice(2)

let help = false, version = false, edit = false, location = false, list = false
if (args.length === 0) {
  help = true
} else if (args.length === 1) {
  if (args[0] === '-h' || args[0] === '--help') help = true
  if (args[0].toLowerCase() === '-v' || args[0] === '--version') version = true
  if (args[0] === '--edit') edit = true
  if (args[0] === '--location') location = true
  if (args[0] === '-l' || args[0] === '--list') list = true
}

if (help) {
  const helpText = `
Usage: ${pkg.name} [--edit|--location|--list] command...

  ${pkg.name} --edit       Open the configuration file in the default editor
  ${pkg.name} --location   Print the path to the configuration file
  ${pkg.name} --list       List all available actions
  ${pkg.name} command...   Run the action that matches the input arguments
`.trimStart()
  console.log(helpText)
}

if (version) {
  console.log(`${pkg.name}, ${pkg.version}`)
}

if (edit) {
  const { default: launch } = await import('launch-editor')
  const file = configFile()
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const configFileText = `
type RegisterFunction = {
\t(pattern: string | RegExp, run: (arg: RegExpMatchArray) => unknown, description?: string): void;
\t(pattern: string | RegExp, pattern2: string | RegExp, run: (arg: RegExpMatchArray, arg2: RegExpMatchArray) => unknown, description?: string): void;
\t(pattern: string | RegExp, pattern2: string | RegExp, pattern3: string | RegExp, run: (arg: RegExpMatchArray, arg2: RegExpMatchArray, arg3: RegExpMatchArray) => unknown, description?: string): void;
}

export default function install(register: RegisterFunction) {
\tregister(/^\\.r(\\d+)$/, a => console.log(Math.floor(Math.random() * +a[1])))
}
`.trimStart()
    fs.writeFileSync(file, configFileText)
  }
  launch(path.dirname(file))
}

if (location) {
  console.log(configFile())
}

if (help || version || edit || location) {
  process.exit(0)
}

const { createJiti } = await import('jiti')
const jiti = createJiti(import.meta.url)
const mod = await jiti.import<any>(configFile()).catch(() => null)
if (!mod || !mod.default || typeof mod.default !== 'function') {
  console.error(`Error: No valid configuration found in ${configFile()}`)
  process.exit(1)
}

const lbq = await defineConfig(mod.default)
if (list) {
  console.log('Available actions:')
  for (const line of lbq.list()) {
    console.log('  ' + line)
  }
  process.exit(0)
}

const actionAndArgs = lbq.find(args)
if (!actionAndArgs) {
  console.error('No matching action found for the given arguments. Use --list to list all actions.')
  process.exit(1)
}

const [action, matches, restArgs] = actionAndArgs
try {
  await action.run(...matches, ...restArgs)
} catch (err) {
  await logErrorAndExit(err)
}

async function logErrorAndExit(err: any) {
  if (err && typeof err === 'object' && typeof err.stack === 'string') {
    const { default: cleanStack } = await import('clean-stack')
    console.error(cleanStack(err.stack))
  } else if (err && typeof err === 'object' && typeof err.message === 'string') {
    console.error(err.message)
  } else {
    console.error(err)
  }
  process.exitCode = 1
}
