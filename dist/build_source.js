(function() {
  var SourceBuilder, coffee, fs, path,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  fs = require('fs');

  path = require('path');

  coffee = require('coffee-script');

  module.exports = function(opts) {
    return new SourceBuilder(opts).build();
  };

  SourceBuilder = (function() {

    function SourceBuilder(opts) {
      this.opts = opts;
    }

    SourceBuilder.prototype.build = function() {
      var src;
      console.log('Building source file for', this.opts.root, '...');
      src = this.build_package(this.opts.root, '__main__');
      console.log('Building source file for', this.opts.root, '... DONE');
      return src;
    };

    SourceBuilder.prototype.build_package = function(root, prefix, source_tree) {
      var main_path, pkg_obj,
        _this = this;
      if (source_tree == null) {
        source_tree = {};
      }
      this.process_dir(root, prefix, source_tree);
      try {
        pkg_obj = require(path.join(root, 'package.json'));
      } catch (err) {

      }
      if (pkg_obj != null) {
        if (pkg_obj.main != null) {
          main_path = path.join(prefix, pkg_obj.main.replace(/\.(js|coffee)$/, '') + '.js');
          source_tree[path.join(prefix, '__main__')] = source_tree[main_path];
        }
        Object.keys(pkg_obj.dependencies).forEach(function(dep) {
          try {
            return _this.build_package(path.join(root, 'node_modules', dep), path.join(prefix, 'node_modules', dep), source_tree);
          } catch (err) {

          }
        });
      }
      return source_tree;
    };

    SourceBuilder.prototype.process_dir = function(dir, prefix, source_tree) {
      var file, file_path, _i, _len, _ref, _results;
      _ref = fs.readdirSync(dir);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (file[0] === '.' || __indexOf.call(this.opts.ignore, file) >= 0) {
          continue;
        }
        file_path = path.join(dir, file);
        if (fs.statSync(file_path).isDirectory()) {
          _results.push(this.process_dir(file_path, path.join(prefix, file), source_tree));
        } else {
          _results.push(this.process_file(file_path, prefix, source_tree));
        }
      }
      return _results;
    };

    SourceBuilder.prototype.process_file = function(file, prefix, source_tree) {
      var content, ext, filename, original_ext;
      original_ext = ext = path.extname(file);
      if (ext !== '.js' && ext !== '.coffee' && ext !== '.json') {
        return;
      }
      content = fs.readFileSync(file).toString('ascii');
      if (original_ext === '.coffee') {
        content = coffee.compile(content);
        ext = '.js';
      }
      filename = file.slice(path.dirname(file).length, -original_ext.length) + ext;
      return source_tree[path.join(prefix, filename)] = content;
    };

    return SourceBuilder;

  })();

}).call(this);
