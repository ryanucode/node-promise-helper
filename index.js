const fs = require('fs')
const fsPath = require('path')
const spawn = require('child_process').spawn

// returns a promise that resolves when all promisses in the passed promises
// array have either resolved or rejected
//
// Returned promise resolves with an array of arrays.
// The outer array maintains the order and length of the original passed array.
// The 1st item of the inner array is a string indicating the state of the
// promise.
// The 2nd item is the payload of the promise.
//
// Ex output:
// Promise.resolved([['resolved', { some: 'object' }], ['rejected', 'reason']])
const allComplete = exports.allComplete = (promises) => {
  return new Promise(resolve => {
    let retVals = Array(promises.length).fill(['pending', undefined])

    const f = (state, i) => res => {
      retVals[i] = [state, res]
      if (retVals.every(r => r[0] !== 'pending')) {
        resolve(retVals)
      }
    }

    promises.forEach((p, i) => {
      Promise.resolve(p).then(f('resolved', i), f('rejected', i))
    })
  })
}

// ensures an onject behaves like a native promise
const isPromise = exports.isPromise = (thing) => {
  return typeof thing.then === 'function' && typeof thing.catch === 'function'
}

// filesystem promises

// readfile as promise
// takes a file path and optional readoptions as arguments
// returns a promise that resolves with the file data or rejects with a read
// error
const readFile = exports.readFile = (path, options = {encoding: null, flag: 'r'}) =>
  new Promise((resolve, reject) =>
    fs.readFile(path, options, (err, data) => err ? reject(err) : resolve(data)))

// takes a directory and returns a files object
// the returned path will be relative to the passed directory
// Ex:
// filesFromDir('./environments/html/files')
// => Promise.resolve([{path: './given.html', content: '<!DOCTYPE html>\n<html>...'}])
const filesFromDir = exports.filesFromDir = dirPath => {
  let files = []
  const addPathToFiles = path => files.push(readFile(path).then(content => { return { path, content } }))
  try {
    const findExe = spawn('find', ['-type', 'f'], {cwd: dirPath})
    findExe.stdout.on('data', addPathToFiles)
    return new Promise((resolve, reject) => findExe.stdout.on('close', () => resolve(files)))
    .then(filesP => Promise.all(filesP))
  } catch (e) {
    // Error is usually thrown if the directory you are looking for doesnt
    // exist. Return an empty set of files if there is an error.
    console.error(e)
    return Promise.resolve([])
  }
}

// takes the same arguments as fs.writeFile() except it does not take a callback
// returns a promise
const writeFile = exports.writeFile = (path, content) =>
  new Promise((resolve, reject) =>
    fs.writeFile(path, content, (err) => err ? reject(err) : resolve()))

// identical to writeFile but create any nessicary directories
const writeFileRec = exports.writeFileRec = (path, content) => {
  return writeFile(path, content).catch(err => {
    if (err.code !== 'ENOENT') throw err
    return mkdirRec(fsPath.dirname(path)).then(() => writeFile(path, content))
  })
}

const mkdir = exports.mkdir = (path, mode) =>
  new Promise((resolve, reject) =>
    fs.mkdir(path, mode, err => err ? reject(err) : resolve()))

const mkdirRec = exports.mkdirRec = (path, mode) => {
  return mkdir(path, mode).catch(err => {
    if (err.code !== 'ENOENT') throw err
    return mkdirRec(fsPath.dirname(path), mode).then(() => mkdir(path, mode))
  })
}

// takes the same arguments as fs.writeFile() except it does not take a callback
// returns a promise
const symlink = exports.symlink = (target, path, type = 'file') =>
  new Promise((resolve, reject) =>
    fs.symlink(target, path, type, err => err ? reject(err) : resolve()))
