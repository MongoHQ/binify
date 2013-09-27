(function() {
  var Downloader, TMP_DIR, crypto, fs, path, q, request, shell, tar, zlib;

  q = require('q');

  fs = require('fs');

  tar = require('tar');

  zlib = require('zlib');

  path = require('path');

  shell = require('shelljs');

  crypto = require('crypto');

  request = require('request');

  TMP_DIR = path.join(__dirname, '..', 'tmp');

  module.exports = function(version, callback) {
    return new Downloader(version).download(callback);
  };

  Downloader = (function() {

    function Downloader(version) {
      this.version = version;
      this.node_dir = path.join(TMP_DIR, 'node-v' + this.version);
      this.tgz_file = this.node_dir + '.tar.gz';
    }

    Downloader.prototype.download = function(callback) {
      var _this = this;
      if (fs.existsSync(this.node_dir)) {
        return callback(null, this.node_dir);
      }
      return this.download_version().then(this.validate_sha.bind(this)).then(this.unzip.bind(this)).then(function() {
        return callback(null, _this.node_dir);
      })["catch"](callback);
    };

    Downloader.prototype.download_version = function() {
      var d,
        _this = this;
      d = q.defer();
      console.log('Downloading node', this.version, '...');
      shell.mkdir('-p', path.dirname(this.tgz_file));
      request.get("http://nodejs.org/dist/v" + this.version + "/node-v" + this.version + ".tar.gz").pipe(fs.createWriteStream(this.tgz_file)).on('error', d.reject.bind(d)).on('close', function() {
        console.log('Downloading node', _this.version, '... DONE');
        return d.resolve();
      });
      return d.promise;
    };

    Downloader.prototype.validate_sha = function() {
      var d,
        _this = this;
      d = q.defer();
      console.log('Validating tgz SHA for', this.version, '...');
      request.get({
        url: "http://nodejs.org/dist/v" + this.version + "/SHASUMS256.txt"
      }, function(err, res, body) {
        var hash, sha, stuff;
        if (err != null) {
          return d.reject(err);
        }
        if (res.statusCode !== 200) {
          return d.reject(new Error('Status code is ' + res.statusCode));
        }
        stuff = body.toString().split('\n').reduce(function(o, line) {
          var file, sha, _ref;
          if (line.trim() === '') {
            return o;
          }
          _ref = line.trim().split(/[ \t]+/), sha = _ref[0], file = _ref[1];
          o[file] = sha;
          return o;
        }, {});
        sha = stuff["node-v" + _this.version + ".tar.gz"];
        hash = crypto.createHash('sha256');
        console.log(_this.tgz_file);
        return fs.createReadStream(_this.tgz_file).on('data', function(data) {
          return hash.update(data);
        }).on('error', d.reject.bind(d)).on('close', function(data) {
          var digest;
          if (data != null) {
            hash.update(data);
          }
          digest = hash.digest('hex');
          if (digest !== sha) {
            return d.reject(new Error("SHA256 is '" + digest + "', expected '" + sha + "'"));
          }
          console.log('Validating tgz SHA for', _this.version, '... DONE');
          return d.resolve();
        });
      });
      return d.promise;
    };

    Downloader.prototype.unzip = function() {
      var d, tmp_dir,
        _this = this;
      d = q.defer();
      console.log('Unzipping node', this.version, '...');
      tmp_dir = path.join(TMP_DIR, crypto.randomBytes(4).toString('hex'));
      fs.createReadStream(this.tgz_file).pipe(zlib.createGunzip()).pipe(tar.Extract({
        path: tmp_dir
      })).on('error', d.reject.bind(d)).on('close', function() {
        shell.mv(path.join(tmp_dir, 'node-v' + _this.version), _this.node_dir);
        shell.rm('-r', tmp_dir);
        console.log('Unzipping node', _this.version, '... DONE');
        return d.resolve();
      });
      return d.promise;
    };

    return Downloader;

  })();

}).call(this);
