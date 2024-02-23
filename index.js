import fs from 'node:fs'
import path from 'node:path'
import tildify from 'tildify'
import envPaths from 'env-paths'

const { config } = envPaths('lbq')

/**
 * Create or find the config file.
 * @returns {{ path: string, created: boolean }} The config file path and whether it was newly created.
 */
export function init() {
  if (fs.existsSync(config)) {
    return { path: tildify(config), created: false }
  }

  fs.mkdirSync(config, { recursive: true })
  fs.writeFileSync(path.join(config, 'package.json'), '{"type":"module"}\n')
  fs.writeFileSync(path.join(config, 'index.js'), `// The default export will be used to register commands.
export default function install(R) {
  // R(...prefix, callback)
  R('hello', () => console.log('Hello, world!'))

  // prefix can be a static string or a RegExp.
  // The matched data will be passed to the callback in order.
  R('hello', /.+/, (_, m) => console.log('Hello, ' + m[0] + '!'))

  // Variadic arguments are passed to the end of the callback args.
  R('hello', (...args) => console.log('Hello, ' + args.join(' ') + '!'))

  // If multiple commands match, the longest (having most arguments) one is called.
}
`)

  return { path: tildify(config), created: true }
}

/**
 * Install and execute the command from config file.
 * @param {string[]} args The command line arguments.
 * @param {{ lazy?: boolean }} options Set 'lazy' to return the command function instead of executing it.
 */
export async function parse(args, options = {}) {
  // 1. Find and install config file.
  const file = path.join(config, 'index.js')
  if (!fs.existsSync(file))
    throw new Error(tildify(file) + ' not found.')

  const mod = await import(file)
  /** @type {{ [seq: string]: [seq: any[], cb: (...a: any[]) => any] }} */
  const commands = Object.create(null)

  if (typeof mod.default !== 'function')
    throw new Error('No default export found in ' + tildify(file))

  function inspect(/** @type{any[]} */seq) {
    let out = ''
    for (const e of seq) {
      if (out) out += ', '
      if (typeof e === 'string' || isRegExp(e)) out += e
      else throw new Error('Unexpected seq, expected string or regexp. ' + e)
    }
    return out
  }

  function register(/** @type {any[]} */...data) {
    const callback = data.pop()
    if (typeof callback !== 'function')
      throw new Error('Unexpected callback, expected function. ' + callback)

    const key = inspect(data)
    if (key in commands) {
      console.warn(`Override: ${key}, previous: ${commands[key][1].toString()}`)
    }

    commands[key] = [data, callback]
  }

  register.commands = commands
  mod.default(register)

  // 2. Parse arguments.
  /** @type {((...args: any[]) => any) | null} */
  let command = null
  /** @type {(RegExpMatchArray | string | null)[] | null} */
  let matches = null
  all: for (let n = args.length; n >= 1; n--) {
    for (const key in commands) {
      const [seq, callback] = commands[key]
      matches = args.slice(0, n).map((a, i) => a.match(seq[i]))
      if (matches.every(Boolean)) {
        command = callback
        for (let i = n; i < args.length; i++)
          matches.push(args[i])
        break all
      }
    }
  }

  if (options.lazy) return command
  if (command) {
    // @ts-ignore apply() can accept undefined or null
    return command.apply(null, matches)
  } else {
    console.warn(`Not found command!
Put scripts in ${tildify(file)} to register commands, example:

export default function install(R) {
  R('hello', () => console.log('Hello, world!'))
}`)
  }
}

/** @returns {value is RegExp} */
function isRegExp(/** @type {unknown} */value) {
  return Object.prototype.toString.call(value) === '[object RegExp]'
}
