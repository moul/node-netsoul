{spawn, exec} = require 'child_process'

call = (command, args = [], fn = null) ->
  exec "#{command} #{args.join(' ')}", (err, stdout, stderr) ->
    if err?
      console.error "Error :"
      return console.dir   err
    fn err if fn

system = (command, args) ->
  spawn command, args, stdio: "inherit"

build = (fn = null) ->
  call 'coffee',     ['-c', '-o', 'lib', 'src'], ->
    call 'coffee',     ['-c', '-o', 'examples', 'examples'], ->
      call 'browserify', ['src/browser.coffee', '-o', 'browser/netsoul.js'], ->
        call "minifyjs", ['--engine', 'yui', '--level', '2', 'browser/netsoul.js', '>', 'browser/netsoul.min.js'], fn

task 'build', 'continually build the JavaScript code', ->
  build ->
    console.log "Done !"

task 'doc', 'rebuild the Docco documentation', ->
  exec([
    'docco src/*.coffee'
  ].join(' && '), (err) ->
    throw err if err
  )
