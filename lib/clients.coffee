class ClientBase
    constructor: (@options) ->
        do @handleOptions
        @log 'Inited'

    log: (args...) ->
        @options.log "#{@constructor.name}> ", args...

    handleOptions: =>
        @options.log      ?= console.log
        @options.login    ?= process.env.USER
        @options.location ?= require('os').hostname() || '-'
        if not @options.password?
            throw new Error 'password is not specified'
        @log 'handleOptions'

module.exports =
    base:       ClientBase
