fs = require 'fs'
path = require 'path'
coffee = require 'coffee-script'

module.exports = (opts) -> new SourceBuilder(opts).build()

class SourceBuilder
  constructor: (@opts) ->
  
  build: ->
    console.log 'Building source file for', @opts.root , '...'
    src = @build_package(@opts.root, '__main__')
    console.log 'Building source file for', @opts.root , '... DONE'
    src
  
  build_package: (root, prefix, source_tree = {}) ->
    @process_dir(root, prefix, source_tree)
    
    try
      pkg_obj = require(path.join(root, 'package.json'))
    catch err

    if pkg_obj?
      if pkg_obj.main?
        main_path = path.join(prefix, pkg_obj.main.replace(/\.(js|coffee)$/, '') + '.js')
        source_tree[path.join(prefix, '__main__')] = main_path
      
      Object.keys(pkg_obj.dependencies).forEach (dep) =>
        try
          @build_package(path.join(root, 'node_modules', dep), path.join(prefix, 'node_modules', dep), source_tree)
        catch err
    
    source_tree
  
  process_dir: (dir, prefix, source_tree) ->
    for file in fs.readdirSync(dir)
      continue if file[0] is '.' or file in @opts.ignore

      file_path = path.join(dir, file)
      if fs.statSync(file_path).isDirectory()
        @process_dir(file_path, path.join(prefix, file), source_tree)
      else
        @process_file(file_path, prefix, source_tree)
  
  process_file: (file, prefix, source_tree) ->
    original_ext = ext = path.extname(file)
    return unless ext in ['.js', '.coffee', '.json', '.types']

    content = fs.readFileSync(file).toString('ascii')
    if original_ext is '.coffee'
      content = coffee.compile(content)
      ext = '.js'
    
    filename = file.slice(path.dirname(file).length, -original_ext.length) + ext
    source_tree[path.join(prefix, filename)] = content
