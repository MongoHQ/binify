q = require 'q'
fs = require 'fs'
os = require 'os'
path = require 'path'
shell = require 'shelljs'
download = require './download'
build_source = require './build_source'

module.exports = (opts, callback) -> new Compiler(opts).compile(callback)

class Compiler
  constructor: (@opts) ->
    @opts.node ?= '0.10.18'
    @opts.ignore ?= ['node_modules', 'test']
    @opts.root ?= process.cwd()
    @opts['append-platform'] ?= true
    @opts['print-opts'] ?= false
    
    @opts.ignore = @opts.ignore.reduce((o, i) ->
      o.push(i.split(',').map((f) -> f.trim())...)
      o
    , []).filter (i) -> i isnt ''
    
    unless @opts.output?
      try
        pkg = require(path.join(@opts.root, 'package.json'))
        @opts.output = path.join(@opts.root, pkg.name)
      catch err
        @opts.output = path.basename(process.cwd())
    
    @opts.output = [@opts.output, os.platform(), os.arch()].join('-') if @opts['append-platform']
    
    if @opts['print-opts']
      console.log 'Compiler Options:'
      console.log JSON.stringify(@opts, null, 2).split('\n').map((line) -> '  ' + line).join('\n')
      process.exit()
  
  compile: (callback) ->
    @download_node()
      .then(@build_source.bind(@))
      .then(@prepare_node.bind(@))
      .then(@make.bind(@))
      .then(=> callback(null, @opts.output))
      .catch(callback)
  
  download_node: ->
    d = q.defer()
    
    download @opts.node, (err, node_directory) =>
      return d.reject(err) if err?
      @opts.node_dir = node_directory
      d.resolve(node_directory)
    
    d.promise
  
  build_source: ->
    d = q.defer()
    
    try
      @source_tree = build_source(root: @opts.root, ignore: @opts.ignore)
      d.resolve()
    catch err
      d.reject(err)
    
    d.promise
  
  prepare_node: ->
    d = q.defer()
    
    console.log 'Preparing node', @opts.node, '...'
    
    gyp_file = path.join(@opts.node_dir, 'node.gyp')

    if shell.grep('_third_party_source', gyp_file) is ''
      console.log 'INSTALLING libs in node.gyp'
      shell.sed('-i', "'lib/zlib.js',", "'lib/zlib.js', 'lib/_third_party_main.js', 'lib/_third_party_source.js',", gyp_file)

    shell.cp('-f', path.join(__dirname, '..', '_third_party_main.js'), path.join(@opts.node_dir, 'lib', '_third_party_main.js'))
    
    fs.writeFileSync(path.join(@opts.node_dir, 'lib', '_third_party_source.js'), 'module.exports = ' + JSON.stringify(@source_tree, null, 2) + ';')
    
    console.log 'Preparing node', @opts.node, '... DONE'
    d.resolve()

    d.promise
  
  make: ->
    d = q.defer()
    
    console.log 'Making node', @opts.node, '...'
    
    shell.cd(@opts.node_dir)
    shell.exec('make')

    shell.cp('-f', path.join(@opts.node_dir, 'out', 'Release', 'node'), @opts.output)
    if shell.which('strip')?
      console.log 'Stripping', @opts.output
      shell.exec('strip ' + @opts.output)
    
    console.log 'Making node', @opts.node, '... DONE'
    d.resolve()
    
    d.promise
