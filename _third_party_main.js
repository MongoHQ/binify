var NativeModule = require('native_module')
  , Module = require('module')
  , path = require('path')
  , third_party_source = require('_third_party_source');

function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

var get_content = function(filename) {
  if (!third_party_source[filename]) return null;
  return third_party_source[filename];
  // return new Buffer(third_party_source[filename], 'ascii');
};

var resolve_filename = function(name) {
  if (third_party_source[name]) return name;
  if (third_party_source[path.join(name, '__main__')]) return third_party_source[path.join(name, '__main__')];
  if (third_party_source[name + '.js']) return name + '.js';
  if (third_party_source[path.join(name, 'index.js')]) return path.join(name, 'index.js');
  if (third_party_source[name + '.json']) return name + '.json';
  return null;
};

var resolve_module_filename = function(name, parent_path) {
  if (!parent_path) parent_path = '__main__';
  
  while (parent_path !== '.') {
    var result = resolve_filename(path.join(parent_path, 'node_modules', name));
    if (result) return result;
    parent_path = path.dirname(parent_path);
  }
  
  return null;
};

// Module Overrides

var _resolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent) {
  if (NativeModule.exists(request)) return request;
  
  var request_path;
  
  if (request[0] === '/') {
    var idx = request.indexOf('__main__');
    if (idx === -1) return _resolveFilename.apply(Module, arguments);
    request = request.slice(idx);
    request_path = resolve_filename(request);
  } else if (parent && request[0] !== '.') {
    request_path = resolve_module_filename(request, parent ? path.dirname(parent.filename) : null);
  } else if (request[0] === '.') {
    request_path = resolve_filename(path.join((parent ? path.dirname(parent.filename) : '__main__'), request));
  } else {
    request_path = resolve_filename(request);
  }
  
  // console.log('RESOLVE', parent ? parent.filename : '[orphan]', request, '=>', request_path);
  
  if (!request_path) {
    var err = new Error("Cannot find module '" + request + "'");
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  }
  
  return request_path;
};

var _js_extension = Module._extensions['.js'];
Module._extensions['.js'] = function(module, filename) {
  if (filename.slice(0, 8) !== '__main__') return _js_extension.apply(Module._extensions, arguments);
  
  var content = get_content(filename).toString('ascii');
  module._compile(stripBOM(content), filename);
};

var _json_extension = Module._extensions['.json'];
Module._extensions['.json'] = function(module, filename) {
  if (filename.slice(0, 8) !== '__main__') return _json_extension.apply(Module._extensions, arguments);
  
  var content = get_content(filename).toString('ascii');
  try {
    module.exports = JSON.parse(stripBOM(content));
  } catch (err) {
    err.message = filename + ': ' + err.message;
    throw err;
  }
};

// File System Overrides

var fs = require('fs');

var _readFileSync = fs.readFileSync;
fs.readFileSync = function(filename, options) {
  // console.log('READ SYNC', arguments);
  if (filename.slice(0, 8) !== '__main__') return _readFileSync.apply(fs, arguments);
  
  var content = get_content(filename);
  if (!content) throw new Error("ENOENT, no such file or directory '" + filename + "'");
  
  if (options) {
    if (options.encoding) content = content.toString(options.encoding);
  }
  
  return content;
};

Module._load('__main__', null, true);
process._tickCallback();
