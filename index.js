//const R = require('ramda')
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

// takes a directory and returns a list of relative file paths
// the returned path will be relative to the passed directory
const findFiles = exports.findFiles = basePath => {
  let stdout = ''
  try {
    const findExe = spawn('find', [basePath, '-type', 'f'], {encoding: 'utf8'})
    findExe.stdout.setEncoding('utf8')
    findExe.stdout.on('data', data => { stdout += data })
    return new Promise((resolve, reject) =>
      findExe.stdout.on('close', () => 
        resolve(stdout.split('\n').filter(Boolean).map(fsPath.normalize))))
  } catch (err) {
    // Error is usually thrown if the directory you are looking in doesnt
    // exist. Return an empty set of files if there is an error.
    console.error(err)
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

// read all files in a given path into an array of file objects
// Note that the default encoding has been changed to utf8 by default to
// increase utility in the ucode CES project
//
// filesFromPaths(['./environments/html/index.html'])
// => Promise.resolve([{path: './environments/html/index.html', content: '<!DOCTYPE html>\n<html>...'}])
const filesFromPaths = exports.filesFromPaths = (paths, options = {encoding: 'utf8'}) =>
  Promise.all(paths.map(path => readFile(path, options).then(content => { return { path, content } })))

