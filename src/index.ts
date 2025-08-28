/// <reference types="node" />
import fs from 'node:fs'
import os from 'node:os'
import util from 'node:util'
import path from 'node:path'

function env(name: string): string | undefined {
  const snakeName = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  return (
    process.env[`npm_package_config_lbq_${name}`] ||
    process.env[`npm_package_config_lbq_${snakeName}`] ||
    process.env[`LBQ_${snakeName.toUpperCase()}`]
  )
}

/**
 * Returns path to the config file, like `%LOCALAPPDATA%/lbq/index.ts` on Windows.
 */
export function configFile(): string {
  return env('configFile') || searchConfigFile()
}

function searchConfigFile(): string {
  const candidates: string[] = []
  const fileName = 'lbq/index.ts'

  if (process.platform === 'win32')
    candidates.push(path.join(process.env.LOCALAPPDATA || '', fileName))
  else if (process.platform === 'darwin')
    candidates.push(path.join(os.homedir(), 'Library', 'Preferences', fileName))
  else if (process.env.XDG_CONFIG_HOME)
    candidates.push(process.env.XDG_CONFIG_HOME, fileName)

  candidates.push(path.join(os.homedir(), '.config', fileName))

  return candidates.find(a => fs.existsSync(a)) || candidates[0]
}

interface Ref<T> {
  value: T
}

/**
 * Represents a command-line action with a matching pattern and description.
 * The first longest matching action will be executed.
 */
export class Action {
  /**
   * Matching pattern against `process.argv`.
   * Note that strings are case-insensitive.
   */
  readonly pattern: string | RegExp | readonly (string | RegExp)[]
  /**
   * Default to the function body, can be changed with `register({ description })`.
   */
  readonly description: string
  /**
   * The function to execute when the action is triggered.
   */
  readonly run: (...args: unknown[]) => unknown;

  constructor(
    pattern: string | RegExp | readonly (string | RegExp)[],
    run: (...args: unknown[]) => unknown,
    description?: string,
  ) {
    this.pattern = pattern
    this.description = description || run.toString().replace(/\s+/g, ' ').trim()
    this.run = run
  }

  get length(): number {
    return Array.isArray(this.pattern) ? this.pattern.length : 1
  }

  /** @internal */
  get label(): string {
    if (Array.isArray(this.pattern)) {
      return this.pattern.map(a => util.inspect(a)).join(' ')
    } else {
      return util.inspect(this.pattern)
    }
  }

  /** @internal */
  matches(argv: string[], result: Ref<RegExpMatchArray[] | null>): boolean {
    if (this.length === 0) return true
    let out: RegExpMatchArray[] = []
    if (Array.isArray(this.pattern)) {
      for (let i = 0; i < this.pattern.length; i++) {
        if (this.notMatch(argv[i], this.pattern[i], out)) return false
      }
    } else {
      if (this.notMatch(argv[0], this.pattern as string | RegExp, out)) return false
    }
    result.value = out
    return true
  }

  /** @internal */
  private notMatch(input: string | undefined, pattern: string | RegExp, out: RegExpMatchArray[]): boolean {
    if (input == null) return true
    let result = true
    if (typeof pattern === 'string') {
      if (input.toLowerCase() === pattern.toLowerCase()) {
        out.push([input])
        result = false
      }
    } else {
      let match = input.match(pattern)
      if (match) {
        out.push(match)
        result = false
      }
    }
    return result
  }
}

export interface IActionDefinition {
  pattern: string | RegExp | readonly (string | RegExp)[]
  run: (...args: unknown[]) => unknown
  description?: string
}

function isActionDefinition(obj: unknown): obj is IActionDefinition {
  if (obj && typeof obj === 'object' && 'pattern' in obj && 'run' in obj) {
    const def = obj as IActionDefinition
    return (
      typeof def.pattern === 'string' || def.pattern instanceof RegExp ||
      (Array.isArray(def.pattern) && def.pattern.every(a => typeof a === 'string' || a instanceof RegExp))
    ) && typeof def.run === 'function'
  }
  return false
}

/**
 * The main class to register actions and run the CLI.
 */
export class LBQ {
  readonly actions: Action[] = []

  list(): string[] {
    const len = this.actions.reduce((max, action) => Math.max(max, action.label.length), 0) + 4
    const arr: [string, string][] = this.actions.map(a => [a.label, a.description])
    return arr.map(([label, description]) => label.padEnd(len) + (description || ''))
  }

  /**
   * Search for a matching action.
   * Returns the first longest matching action and its matched arguments.
   */
  find(argv: string[] = process.argv.slice(2)): [Action, RegExpMatchArray[], string[]] | undefined {
    let maxLength = 0
    let found: Action | undefined
    let actionArgs: Ref<RegExpMatchArray[] | null> = { value: null }
    for (const action of this.actions) {
      if ((!found || maxLength < action.length) && action.matches(argv, actionArgs)) {
        found = action
        maxLength = action.length
      }
    }
    if (found && actionArgs.value) {
      return [found, actionArgs.value, argv.slice(maxLength)]
    }
  }

  /**
   * Register a new action.
   * The first longest matching action will be executed.
   */
  register(definition: IActionDefinition): void;
  register(pattern: string | RegExp, run: (...args: unknown[]) => unknown, description?: string): void;
  register(pattern: string | RegExp, pattern2: string | RegExp, ...rest: (string | RegExp | ((...args: unknown[]) => unknown) | undefined)[]): void;
  register(...args: unknown[]): this {
    let first = args[0]
    if (!first) {
      const [run, description] = this._getRunAndDescription(args)
      this.actions.push(new Action([], run, description))
    } else if (isActionDefinition(first)) {
      const def = first as IActionDefinition
      this.actions.push(new Action(def.pattern, def.run, toString(def.description)))
    } else if (typeof first === 'string' || first instanceof RegExp) {
      // Scan patterns until the first run argument.
      let end = 1
      for (; end < args.length; end++) {
        const arg = args[end]
        if (typeof arg === 'function') break
        if (typeof arg !== 'string' && !(arg instanceof RegExp)) break
      }
      const patterns = end === 1 ? first : args.slice(0, end) as (string | RegExp)[]
      const [run, description] = this._getRunAndDescription(args, end)
      this.actions.push(new Action(patterns, run, description))
    } else {
      throw new TypeError('Invalid arguments in register()')
    }
    return this
  }

  private _getRunAndDescription(args: unknown[], start: number = 0): [(...args: unknown[]) => unknown, string | undefined] {
    let run: ((...args: unknown[]) => unknown) | undefined
    let description: string | undefined

    for (let i = start; i < args.length; i++) {
      const arg = args[i]
      if (typeof arg === 'function') {
        run = arg as (...args: unknown[]) => unknown
      } else if (typeof arg === 'string') {
        description = arg
      }
    }

    if (!run) throw new Error('No action provided in register()')
    return [run, description]
  }
}

function toString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value == null) return undefined
  return String(value)
}

export interface RegisterFunction {
  (pattern: string | RegExp, run: (arg: RegExpMatchArray) => unknown, description?: string): void;
  (pattern: string | RegExp, pattern2: string | RegExp, run: (arg: RegExpMatchArray, arg2: RegExpMatchArray) => unknown, description?: string): void;
  (pattern: string | RegExp, pattern2: string | RegExp, pattern3: string | RegExp, run: (arg: RegExpMatchArray, arg2: RegExpMatchArray, arg3: RegExpMatchArray) => unknown, description?: string): void;
  (definition: IActionDefinition): void;
}

export async function defineConfig(callback: (register: RegisterFunction) => unknown): Promise<LBQ> {
  const lbq = new LBQ();
  await callback(lbq.register.bind(lbq) as RegisterFunction);
  return lbq;
}
