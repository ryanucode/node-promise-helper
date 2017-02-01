const test = require('ava')
const fs = require('fs')
const P = require('../index')
const spawn = require('child_process').spawn

const tmpDir = '/tmp/ava-test'

const genId = (length = 5) =>
  Math.random().toString(36).substr(2, 2 + length)

// provide a temp file with a known value for testing filesystem helpers
test.before(t => {
  fs.mkdir(tmpDir, () => {
    fs.writeFile(`${tmpDir}/ces-test-value`, 'ucode is great!')
  })
})

test.after(t => {
  spawn('rm', ['-rf', tmpDir])
})

test('writeFileP', t => {
  const filename = `${tmpDir}/${genId()}`
  const promise = P.writeFile(filename, 'hello world')
  t.true(promise instanceof Promise, 'should return a promise')
  return promise.then(() => {
    fs.stat(filename, (err, stats) => {
      if (err) throw err
      t.true(stats.isFile(), 'should be a file')
      t.false(stats.isDirectory(), 'should not be a directory')
      t.is(stats.size, 11, 'file should have the correct size')
    })
    fs.readFile(filename, data => t.is(data, 'hello world'), 'should contain the content of the input value')
  })
})

test('symlink', t => {
  const filename = `${tmpDir}/${genId()}`
  const promise = P.symlink(`${tmpDir}/ces-test-value`, filename)
  t.true(promise instanceof Promise, 'should return a promise')
  return promise.then(() => {
    Promise.all([
      new Promise((resolve, reject) => {
        fs.stat(filename, (err, stats) => {
          if (err) reject(err)
          t.false(stats.isFile(), 'should not be a file')
          t.false(stats.isDirectory(), 'should not be a directory')
          t.true(stats.isSymbolicLink(), 'should be a symlink')
          resolve()
        })
      }),
      new Promise((resolve, reject) => {
        fs.readFile(filename, data => resolve(t.is(data, 'ucode is great!', 'should contain the content of the input value')))
      }),
    ])
  })
})

test('mkdir', t => {
  const path = `${tmpDir}/${genId()}`
  const promise = P.mkdir(path)
  t.true(promise instanceof Promise, 'should return a promise')
  return promise.then(() => {
    Promise.all([
      new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
          if (err) reject(err)
          t.false(stats.isFile(), 'should not be a file')
          t.true(stats.isDirectory(), 'should not be a directory')
          t.false(stats.isSymbolicLink(), 'should be a symlink')
          resolve()
        })
      }),
    ])
  })
})

test('mkdirRecP', t => {
  const basePath = `${tmpDir}$/{genId()}`
  const path = `${basePath}/${genId()}/${genId()}/${genId()}`
  const promise = P.mkdirRec(path)
  t.true(promise instanceof Promise, 'should return a promise')
  return promise.catch(err => t.fail(err)).then(() => {
    Promise.all([
      new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
          if (err) throw err
          t.false(stats.isFile(), 'should not be a file')
          t.true(stats.isDirectory(), 'should not be a directory')
          t.false(stats.isSymbolicLink(), 'should be a symlink')
          resolve()
        })
      }),
    ])
  })
})

test('util.allComlete', t => {
  const promises = [
    // check resolutions with different datatypes
    Promise.resolve(1),
    Promise.resolve('a string'),
    // check rejections with different datatypes
    Promise.reject(['an array']),
    // check delayed promises
    new Promise((resolve, reject) => setTimeout(() => resolve('late'), 500)),
    // check caught promises
    Promise.reject('caught').catch((thing) => thing),
  ]
  const expected = [
    ['resolved', 1],
    ['resolved', 'a string'],
    ['rejected', ['an array']],
    ['resolved', 'late'],
    ['resolved', 'caught'],
  ]
  return P.allComplete(promises)
  .then(actual => t.deepEqual(actual, expected, 'returns accurate results from all promises'))
})

test('isPromise', t => {
  const rejected = Promise.reject()
  const thenable = { then: () => {} }
  const thenableCatchable = {then: () => {}, catch: () => {}}
  t.true(P.isPromise(Promise.resolve()), 'a resolved promise is true')
  t.true(P.isPromise(rejected), 'a rejected promise is true')
  t.false(P.isPromise({}), 'an empty object is false')
  t.false(P.isPromise(thenable))
  t.true(P.isPromise(thenableCatchable))

  // catch the rejection after the tests to prevent an error
  rejected.catch(() => {})
  //console.log(Promise.reject())
})
