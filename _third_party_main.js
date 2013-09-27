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
var resolve_filename = function(name) {
  if (third_party_source[name]) return name;
  if (third_party_source[path.join(name, '__main__')]) return path.join(name, '__main__');
  if (third_party_source[name + '.js']) return name + '.js';
  if (third_party_source[path.join(name, 'index.js')]) return path.join(name, 'index.js');
  return null;
};

Module._resolveFilename = function(request, parent) {
  if (NativeModule.exists(request)) return request;
  
  var request_path = request;
  
  if (request[0] === '.') {
    request_path = path.join((parent ? path.dirname(parent.filename) : '__main__'), request_path);
  } else {
    if (parent) request_path = path.join(path.dirname(parent.filename), 'node_modules', request_path);
  }
  
  request_path = resolve_filename(request_path);
  
  if (!request_path) {
    var err = new Error("Cannot find module '" + request + "'");
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  }
  
  return request_path;
};

Module._extensions['.js'] = function(module, filename) {
  var content = third_party_source[filename];
  module._compile(stripBOM(content), filename);
};

Module._load('__main__', null, true);
process._tickCallback();
