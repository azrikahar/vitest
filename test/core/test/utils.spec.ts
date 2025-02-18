import { beforeAll, describe, expect, test } from 'vitest'
import { assertTypes, deepClone, objectAttr, toArray } from '@vitest/utils'
import { deepMerge, resetModules } from '../../../packages/vitest/src/utils'
import { deepMergeSnapshot } from '../../../packages/vitest/src/integrations/snapshot/port/utils'
import type { EncodedSourceMap } from '../../../packages/vite-node/src/types'
import { ModuleCacheMap } from '../../../packages/vite-node/dist/client'

describe('assertTypes', () => {
  test('the type of value should be number', () => {
    const value = 5
    const value_string = '5'
    assertTypes(value, 'value', ['number'])
    expect(() => assertTypes(value_string, 'value_string', ['number'])).toThrow()
  })

  test('the type of value should be number or BigInt', () => {
    const value_number = 5
    const value_bigint = BigInt(5)
    const value_string = '5'
    assertTypes(value_number, 'value_number', ['number', 'bigint'])
    assertTypes(value_bigint, 'value_bigint', ['number', 'bigint'])
    expect(() => assertTypes(value_string, 'value_string', ['number', 'bigint'])).toThrow()
  })
})

describe('deepMerge', () => {
  test('non plain objects retain their prototype, arrays are not merging, plain objects are merging', () => {
    class TestA {
      baz = 'baz'

      get foo() {
        return 'foo'
      }
    }
    class TestB {
      bar = 'bar'
    }

    const testA = new TestA()
    const testB = new TestB()

    const a = {
      test: testA,
      num: 30,
      array: [1, 2],
      obj: {
        foo: 'foo',
      },
    }

    const b = {
      test: testB,
      num: 40,
      array: [3, 4],
      obj: {
        baz: 'baz',
      },
    }

    const merged = deepMerge(a, b)

    expect(merged.test instanceof TestB).toBe(true)
    expect(merged.test.baz).toBeUndefined()
    expect(merged.num).toBe(40)
    expect(merged.array).toEqual([3, 4])
    expect(merged.obj).toEqual({
      foo: 'foo',
      baz: 'baz',
    })
  })

  test('deepMergeSnapshot considers asymmetric matcher', () => {
    class Test {
      zoo = 'zoo'
      get bar() {
        return 'name'
      }
    }

    const obj = deepMergeSnapshot({
      regexp: /test/,
      test: new Test(),
      name: 'name',
      foo: 5,
      array: [/test/, 'test'],
    }, {
      name: expect.stringContaining('name'),
      foo: 88,
      array: [/test2/],
      test: { baz: 'baz' },
    })

    expect(obj.regexp instanceof RegExp).toBe(true)
    expect(obj.test instanceof Test).toBe(false)
    expect(obj.array[0] instanceof RegExp).toBe(false)

    expect(obj).toEqual({
      regexp: /test/,
      test: { baz: 'baz', zoo: 'zoo' },
      name: expect.stringContaining('name'),
      foo: 88,
      array: [{}, 'test'],
    })
  })
})

describe('toArray', () => {
  test('number should be converted to array correctly', () => {
    expect(toArray(0)).toEqual([0])
    expect(toArray(1)).toEqual([1])
    expect(toArray(2)).toEqual([2])
  })

  test('return empty array when given null or undefined', () => {
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
  })

  test('return the value as is when given the array', () => {
    expect(toArray([1, 1, 2])).toEqual([1, 1, 2])
  })

  test('object should be stored in the array correctly', () => {
    expect(toArray({ a: 1, b: 1, expected: 2 })).toEqual([{ a: 1, b: 1, expected: 2 }])
  })
})

describe('deepClone', () => {
  test('various types should be cloned correctly', () => {
    expect(deepClone(1)).toBe(1)
    expect(deepClone(true)).toBe(true)
    expect(deepClone(undefined)).toBe(undefined)
    expect(deepClone(null)).toBe(null)
    expect(deepClone({ a: 1 })).toEqual({ a: 1 })
    expect(deepClone([1, 2])).toEqual([1, 2])
    const symbolA = Symbol('a')
    expect(deepClone(symbolA)).toBe(symbolA)
    const objB: any = {}
    Object.defineProperty(objB, 'value', {
      configurable: false,
      enumerable: false,
      value: 1,
      writable: false,
    })
    expect(deepClone(objB).value).toEqual(objB.value)
    const objC = Object.create(objB)
    expect(deepClone(objC).value).toEqual(objC.value)
    const objD: any = { name: 'd', ref: null }
    objD.ref = objD
    expect(deepClone(objD)).toEqual(objD)
  })
})

describe('resetModules doesn\'t resets only user modules', () => {
  const mod = () => ({ evaluated: true, promise: Promise.resolve({}), resolving: false, exports: {}, map: {} as EncodedSourceMap })

  const moduleCache = new ModuleCacheMap()
  const modules = [
    ['/some-module.ts', true],
    ['/@fs/some-path.ts', true],
    ['/node_modules/vitest/dist/index.js', false],
    ['/node_modules/vitest-virtual-da9876a/dist/index.js', false],
    ['/node_modules/some-module@vitest/dist/index.js', false],
    ['/packages/vitest/dist/index.js', false],
    ['mock:/some-module.ts', false],
    ['mock:/@fs/some-path.ts', false],
  ] as const

  beforeAll(() => {
    modules.forEach(([path]) => {
      moduleCache.set(path, mod())
    })
    resetModules(moduleCache)
  })

  test.each(modules)('Cashe for %s is reseted (%s)', (path, reset) => {
    const cached = moduleCache.get(path)

    if (reset) {
      expect(cached).not.toHaveProperty('evaluated')
      expect(cached).not.toHaveProperty('resolving')
      expect(cached).not.toHaveProperty('exports')
      expect(cached).not.toHaveProperty('promise')
    }
    else {
      expect(cached).toHaveProperty('evaluated')
      expect(cached).toHaveProperty('resolving')
      expect(cached).toHaveProperty('exports')
      expect(cached).toHaveProperty('promise')
    }

    expect(cached).toHaveProperty('map')
  })
})

describe('objectAttr', () => {
  const arrow = (a: number) => a * 3
  const func = function (a: number) {
    return a * 3
  }

  test.each`
    value                         | path            | expected
    ${{ foo: 'bar' }}             | ${'foo'}        | ${'bar'}
    ${{ foo: { bar: 'baz' } }}    | ${'foo'}        | ${{ bar: 'baz' }}
    ${{ foo: { bar: 'baz' } }}    | ${'foo.bar'}    | ${'baz'}
    ${{ foo: [{ bar: 'baz' }] }}  | ${'foo.0.bar'}  | ${'baz'}
    ${{ foo: [1, 2, ['a']] }}     | ${'foo'}        | ${[1, 2, ['a']]}
    ${{ foo: [1, 2, ['a']] }}     | ${'foo.2'}      | ${['a']}
    ${{ foo: [1, 2, ['a']] }}     | ${'foo.2.0'}    | ${'a'}
    ${{ foo: [[1]] }}             | ${'foo.0.0'}    | ${1}
    ${{ deep: [[[1]]] }}          | ${'deep.0.0.0'} | ${1}
    ${{ a: 1, b: 2, c: 3, d: 4 }} | ${'a'}          | ${1}
    ${{ arrow }}                  | ${'arrow'}      | ${arrow}
    ${{ func }}                   | ${'func'}       | ${func}
  `('objectAttr($value, $path) -> $expected', ({ value, path, expected }) => {
    expect(objectAttr(value, path)).toEqual(expected)
  })
})
