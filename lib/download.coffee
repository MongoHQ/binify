q = require 'q'
fs = require 'fs'
tar = require 'tar'
zlib = require 'zlib'
path = require 'path'
shell = require 'shelljs'
crypto = require 'crypto'
request = require 'request'

TMP_DIR = path.join(__dirname, '..', 'tmp')

module.exports = (version, callback) -> new Downloader(version).download(callback)

class Downloader
  constructor: (@version) ->
    @node_dir = path.join(TMP_DIR, 'node-v' + @version)
    @tgz_file = @node_dir + '.tar.gz'
  
  download: (callback) ->
    return callback(null, @node_dir) if fs.existsSync(@node_dir)
    
    @download_version()
      .then(@validate_sha.bind(@))
      .then(@unzip.bind(@))
      .then(=> callback(null, @node_dir))
      .catch(callback)
  
  download_version: ->
    d = q.defer()
    
    console.log 'Downloading node', @version, '...'
    
    shell.mkdir('-p', path.dirname(@tgz_file))
    
    request.get("http://nodejs.org/dist/v#{@version}/node-v#{@version}.tar.gz")
      .pipe(fs.createWriteStream(@tgz_file))
      .on('error', d.reject.bind(d))
      .on 'close', =>
        console.log 'Downloading node', @version, '... DONE'
        d.resolve()
    
    d.promise
  
  validate_sha: ->
    d = q.defer()
    
    console.log 'Validating tgz SHA for', @version, '...'
    
    request.get {url: "http://nodejs.org/dist/v#{@version}/SHASUMS256.txt"}, (err, res, body) =>
      return d.reject(err) if err?
      return d.reject(new Error('Status code is ' + res.statusCode)) unless res.statusCode is 200
      
      stuff = body.toString().split('\n').reduce (o, line) ->
        return o if line.trim() is ''
        [sha, file] = line.trim().split(/[ \t]+/)
        o[file] = sha
        o
      , {}
      
      sha = stuff["node-v#{@version}.tar.gz"]
      
      hash = crypto.createHash('sha256')
      console.log @tgz_file
      fs.createReadStream(@tgz_file)
        .on('data', (data) -> hash.update(data))
        .on('error', d.reject.bind(d))
        .on 'close', (data) =>
          hash.update(data) if data?
          digest = hash.digest('hex')
          
          return d.reject(new Error("SHA256 is '#{digest}', expected '#{sha}'")) unless digest is sha
          
          console.log 'Validating tgz SHA for', @version, '... DONE'
          d.resolve()
    
    d.promise

  unzip: ->
    d = q.defer()
    
    console.log 'Unzipping node', @version, '...'
    
    tmp_dir = path.join(TMP_DIR, crypto.randomBytes(4).toString('hex'))
    
    fs.createReadStream(@tgz_file)
      .pipe(zlib.createGunzip())
      .pipe(tar.Extract(path: tmp_dir))
      .on('error', d.reject.bind(d))
      .on 'close', =>
        shell.mv(path.join(tmp_dir, 'node-v' + @version), @node_dir)
        shell.rm('-r', tmp_dir)
        
        console.log 'Unzipping node', @version, '... DONE'
        d.resolve()

    d.promise
