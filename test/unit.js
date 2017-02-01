const test = require('ava')
const fs = require('fs')
const P = require('../index')
const spawn = require('child_process').spawn
const fsPath = require('path')

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
})

const setupTmpDir = dir => {
  const nestedDir = `${dir}/nested`
  return new Promise((resolve, reject) => {
    fs.mkdir(dir, err => err ? reject(err) : resolve())
  })
  .then(() => new Promise((resolve, reject) => {
    fs.mkdir(nestedDir, err => err ? reject(err) : resolve())
  }))
  .then(() => Promise.all([
    P.writeFile(dir + '/file1', 'this is the first file'),
    P.writeFile(dir + '/)(*&!@#.html', 'funny name'),
    P.writeFile(nestedDir + '/nested.md', '# found the nested file!\n'),
    P.symlink(dir + '/file1', dir + '/sym'),
  ]))
}

test('findFiles',  t => {
  // create a bunch of nested files to find
  const dir = `${tmpDir}/${genId()}`
  return setupTmpDir(dir)
  .then(() => P.findFiles(dir))
  .then(foundFiles => {
    //console.log('found files:', foundFiles)
    t.true(foundFiles.includes('./file1'), 'should find a top level file')
    t.true(foundFiles.includes('./)(*&!@#.html'), 'should return existing files with non normal names')
    t.true(foundFiles.includes('./nested/nested.md'), 'should find all nested files')
    t.false(foundFiles.includes('./nested'), 'should not return directories')
    t.false(foundFiles.includes('./sym'), 'should not return symlinks')
    t.false(foundFiles.includes(''), 'should not return any empty paths')
  })
})

test('filesFromPaths', t => {
  const dir = `${tmpDir}/${genId()}`
  return setupTmpDir(dir)
  // usually i dont like to depend on other library methods in tests, however
  // findFiles() and filesFromPaths() will very often be used together
  .then(() => P.findFiles(dir))
  .then(paths => P.filesFromPaths(paths.map(relPath => fsPath.normalize(`${dir}/${relPath}`)), {encoding: 'utf8'}))
  .then(files => {
    //console.log('files:', files)
    const paths = files.map(f => f.path)
    //const contents = files.map(f => f.content)
    const byPath = path => files.find(f => f.path === path)
    t.is(byPath(dir + '/file1').content, 'this is the first file')
    t.is(byPath(dir + '/)(*&!@#.html').content, 'funny name')
    t.is(byPath(dir + '/nested/nested.md').content, '# found the nested file!\n')
    // path assertions same from findFiles
    t.true(paths.includes(dir + '/file1'), 'should find a top level file')
    t.true(paths.includes(dir + '/)(*&!@#.html'), 'should return existing files with non normal names')
    t.true(paths.includes(dir + '/nested/nested.md'), 'should find all nested files')
    t.false(paths.includes(dir + '/nested'), 'should not return directories')
    t.false(paths.includes(dir + '/sym'), 'should not return symlinks')
    t.false(paths.includes(''), 'should not return any empty paths')
    t.false(paths.includes(dir), 'should not return the base directory')
  })
})
