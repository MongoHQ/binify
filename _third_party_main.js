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

var has_content = function(filename) {
  return third_party_source[filename] ? true : false;
}

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

// File System

var fs = require('fs');

// Override Support

var wrap_fs_method = function(method_name, fn) {
  if (!fs[method_name]) return;
  
  var _old_method = fs[method_name];
  fs[method_name] = function() {
    if (arguments[0].slice(0, 8) !== '__main__') return _old_method.apply(fs, arguments);
    return fn.apply(fs, arguments);
  };
};

var wrap_fs_method_async = function(method_name, fn) {
  wrap_fs_method_async(method_name, function() {
    var callback = arguments[arguments.length - 1];
    if (typeof(callback) !== 'function') callback = null;
    
    try {
      var result = fn.apply(fs, arguments);
      if (!callback) return;
      delay(function() {
        callback(null, result);
      });
    } catch (err) {
      if (!callback) return;
      delay(function() {
        callback(err);
      });
    }
  });
};

var get_encoding = function(encoding_or_options) {
  if (!encoding_or_options) return null;
  if (typeof(encoding_or_options) === 'string') return encoding_or_options;
  if (encoding_or_options.encoding) return encoding_or_options.encoding;
  return null;
};

var delay = function(fn) {
  if (setImmediate) {
    setImmediate(fn);
  } else {
    process.nextTick(fn);
  }
};

// Overrides

var read_file = function(filename, encoding_or_options) {
  var content = get_content(filename);
  if (!content) throw new Error("ENOENT, no such file or directory '" + filename + "'");
  
  var encoding = get_encoding(encoding_or_options);
  if (encoding) content = content.toString(encoding);
  
  return content;
};

wrap_fs_method_async('readFile', read_file);
wrap_fs_method('readFileSync', read_file);

var exists = function(path) {
  return has_content(path);
};

wrap_fs_method_async('exists', exists);
wrap_fs_method('existsSync', exists);

var unsupported = function(name) {
  throw new Error('fs.' + name + ' is currently not supported in binify');
};

wrap_fs_method_async('read', unsupported('read'));
wrap_fs_method('readSync', unsupported('readSync'));
wrap_fs_method_async('open', unsupported('open'));
wrap_fs_method('openSync', unsupported('openSync'));
wrap_fs_method_async('close', unsupported('close'));
wrap_fs_method('closeSync', unsupported('closeSync'));
wrap_fs_method_async('readdir', unsupported('readdir'));
wrap_fs_method('readdirSync', unsupported('readdirSync'));
wrap_fs_method_async('stat', unsupported('stat'));
wrap_fs_method('statSync', unsupported('statSync'));
wrap_fs_method_async('lstat', unsupported('lstat'));
wrap_fs_method('lstatSync', unsupported('lstatSync'));
wrap_fs_method_async('fstat', unsupported('fstat'));
wrap_fs_method('fstatSync', unsupported('fstatSync'));
wrap_fs_method_async('', unsupported(''));
wrap_fs_method('Sync', unsupported('Sync'));
wrap_fs_method_async('', unsupported(''));
wrap_fs_method('Sync', unsupported('Sync'));

wrap_fs_method('createReadStream', function(path, options) {
  throw new Error('fs.createReadStream is currently not supported in binify');
});

Module._load('__main__', null, true);
process._tickCallback();
