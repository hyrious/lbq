# @hyrious/lbq

Simple command line task runner written in Node.js.

## Usage

```console
$ npm i -g @hyrious/lbq
$ lbq --edit
```

## Configuration

`lbq` loads `{configPath}/lbq/index.ts` to get all commands, where `configPath` is:

- Windows: `%LOCALAPPDATA%`
- macOS: `~/Library/Preferences`
- Linux: `` $XDG_CONFIG_HOME `` or `~/.config`

`lbq` uses [`jiti`](https://github.com/unjs/jiti) under the hood to load TypeScript files.
So you can use `jiti`'s environment variables to configure its behaviors or debug it.

You can use `lbq --edit` to open an editor in the config folder.

Example config file:

```ts
// {configPath}/lbq/index.ts
import { defineConfig } from '/usr/local/lib/node_modules/lbq/dist/index.js'
// ^ You can get the path with `lbq --location`, or just install lbq here.

export default defineConfig(register => {
  register('hello', () => {
    console.log('world')
  })
})
```

## License

MIT @ [hyrious](https://github.com/hyrious)
