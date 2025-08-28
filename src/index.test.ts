import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { defineConfig } from './index.js'

test('should work', async () => {
  const lbq = await defineConfig(register => {
    register('hello', () => console.log('world'), 'Hello, world!')
  })

  const hello = lbq.find(['hello'])
  assert.ok(hello)
  assert.equal(hello[1], [['hello']])

  const nonExist = lbq.find(['non-exist'])
  assert.is(nonExist, undefined)

  lbq.register({
    pattern: ['foo', /bar/],
    run: () => console.log('foobar'),
    description: 'Foo Bar'
  })
  const foobar = lbq.find(['foo', 'bar'])
  assert.ok(foobar)
  assert.equal(foobar[1], [['foo'], ['bar']])

  lbq.register('args', (_, ...args) => console.log(args), 'Args')
  const args = lbq.find(['args', 'one', 'two', 'three'])
  assert.ok(args)
  assert.equal(args[1], [['args']])
  assert.equal(args[2], ['one', 'two', 'three'])
})

test.run()
