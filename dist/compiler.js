(function() {
  var Compiler, build_source, download, fs, os, path, q, shell;

  q = require('q');

  fs = require('fs');

  os = require('os');

  path = require('path');

  shell = require('shelljs');

  download = require('./download');

  build_source = require('./build_source');

  module.exports = function(opts, callback) {
    return new Compiler(opts).compile(callback);
  };

  Compiler = (function() {

    function Compiler(opts) {
      var pkg, _base, _base1, _base2, _base3, _base4, _ref, _ref1, _ref2, _ref3, _ref4;
      this.opts = opts;
      if ((_ref = (_base = this.opts).node) == null) {
        _base.node = '0.10.18';
      }
      if ((_ref1 = (_base1 = this.opts).ignore) == null) {
        _base1.ignore = ['node_modules', 'test'];
      }
      if ((_ref2 = (_base2 = this.opts).root) == null) {
        _base2.root = process.cwd();
      }
      if ((_ref3 = (_base3 = this.opts)['append-platform']) == null) {
        _base3['append-platform'] = true;
      }
      if ((_ref4 = (_base4 = this.opts)['print-opts']) == null) {
        _base4['print-opts'] = false;
      }
      this.opts.ignore = this.opts.ignore.reduce(function(o, i) {
        o.push.apply(o, i.split(',').map(function(f) {
          return f.trim();
        }));
        return o;
      }, []).filter(function(i) {
        return i !== '';
      });
      if (this.opts.output == null) {
        try {
          pkg = require(path.join(this.opts.root, 'package.json'));
          this.opts.output = path.join(this.opts.root, pkg.name);
        } catch (err) {
          this.opts.output = path.basename(process.cwd());
        }
      }
      if (this.opts['append-platform']) {
        this.opts.output = [this.opts.output, os.platform(), os.arch()].join('-');
      }
      if (this.opts['print-opts']) {
        console.log('Compiler Options:');
        console.log(JSON.stringify(this.opts, null, 2).split('\n').map(function(line) {
          return '  ' + line;
        }).join('\n'));
        process.exit();
      }
    }

    Compiler.prototype.compile = function(callback) {
      var _this = this;
      return this.download_node().then(this.build_source.bind(this)).then(this.prepare_node.bind(this)).then(this.make.bind(this)).then(function() {
        return callback(null, _this.opts.output);
      })["catch"](callback);
    };

    Compiler.prototype.download_node = function() {
      var d,
        _this = this;
      d = q.defer();
      download(this.opts.node, function(err, node_directory) {
        if (err != null) {
          return d.reject(err);
        }
        _this.opts.node_dir = node_directory;
        return d.resolve(node_directory);
      });
      return d.promise;
    };

    Compiler.prototype.build_source = function() {
      var d;
      d = q.defer();
      try {
        this.source_tree = build_source({
          root: this.opts.root,
          ignore: this.opts.ignore
        });
        d.resolve();
      } catch (err) {
        d.reject(err);
      }
      return d.promise;
    };

    Compiler.prototype.prepare_node = function() {
      var d, gyp_file;
      d = q.defer();
      console.log('Preparing node', this.opts.node, '...');
      gyp_file = path.join(this.opts.node_dir, 'node.gyp');
      if (shell.grep('_third_party_source', gyp_file) === '') {
        console.log('INSTALLING libs in node.gyp');
        shell.sed('-i', "'lib/zlib.js',", "'lib/zlib.js', 'lib/_third_party_main.js', 'lib/_third_party_source.js',", gyp_file);
      }
      shell.cp('-f', path.join(__dirname, '..', '_third_party_main.js'), path.join(this.opts.node_dir, 'lib', '_third_party_main.js'));
      fs.writeFileSync(path.join(this.opts.node_dir, 'lib', '_third_party_source.js'), 'module.exports = ' + JSON.stringify(this.source_tree, null, 2) + ';');
      console.log('Preparing node', this.opts.node, '... DONE');
      d.resolve();
      return d.promise;
    };

    Compiler.prototype.make = function() {
      var d;
      d = q.defer();
      console.log('Making node', this.opts.node, '...');
      shell.cd(this.opts.node_dir);
      shell.exec('make');
      shell.cp('-f', path.join(this.opts.node_dir, 'out', 'Release', 'node'), this.opts.output);
      if (shell.which('strip') != null) {
        console.log('Stripping', this.opts.output);
        shell.exec('strip ' + this.opts.output);
      }
      console.log('Making node', this.opts.node, '... DONE');
      d.resolve();
      return d.promise;
    };

    return Compiler;

  })();

}).call(this);
