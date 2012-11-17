protocol = require './protocol'

class PubSub
    constructor: ->
        @subs = {}

    on: (event, callback, id = null) =>
        @subs[event] = [] if not @subs[event]?
        @subs[event].push
            callback: callback
            id:       id

    emit: (event, args...) =>
        return false if not @subs[event]?
        for subscription in @subs[event]
            subscription.callback args...

class ConnectBase extends PubSub
    constructor: (@options = {}) ->
        @connected = false
        do @handleOptions
        @debug 'ConnectBase::constructor'
        super @options

    debug: (args...) =>
        @options.logFn   "#{@constructor.name}> ", args... if @options.debug

    verbose: (args...) =>
        @options.logFn   "#{@constructor.name}> ", args... if @options.verbose

    handleOptions: =>
        @options.logFn    ?= console.log
        @options.verbose  ?= false
        @options.debug    ?= false
        @debug 'handleOptions'

    connect: =>
        if not @socket?
            throw new Error 'socket does not exists'

# classes using lib net
class ConnectNet extends ConnectBase
    connect: =>
        @debug "ConnectNet::connect"
        super
        @socket.on 'connect', @onConnect
        @socket.on 'data',    @onBuffer
        @socket.on 'end',     @onDisconnect
        @socket.on 'error',   @onError

    send: (message, encoding = null, callback = null) =>
        data = message.join(" ") + "\r\n"
        @socket.write data, encoding, callback

    disconnect: =>
        do @socket.end
        do @onDisconnect

    # Net callbacks
    onConnect: =>
        @connected = true
        @debug "ConnectNet::onConnect"
        @emit 'connect'

    onBuffer: (buffer) =>
        @debug 'ConnectNet::onBuffer', buffer
        @emit 'buffer',  buffer
        @handleLine line for line in buffer.toString().split("\n")

    handleLine: (line) =>
        line    = line.replace /^\s+|\s+$/g, ""
        return false if not line.length
        @debug 'ConnectNet::handleLine', line
        message = protocol::parseData line

        @debug 'protocol::parseData', message

        @emit 'data',    line
        @emit 'message', message

    onDisconnect: =>
        @debug "ConnectNet::onDisconnect"
        @connected = false
        @emit 'socketDisconnect'

    onError: (error) =>
        @debug "ConnectNet::onError", error
        @emit 'error', error

class ConnectTCP extends ConnectNet
    handleOptions: =>
        super
        @options.host         ?= 'ns-server.epitech.net'
        @options.port         ?= 4242
        @options.localAddress ?= '0.0.0.0'

    connect: =>
        @debug "ConnectTCP::connect"
        @verbose "Connecting to #{@options.host}:#{@options.port}..."
        @socket = require('net').connect
            port:         @options.port
            host:         @options.host
            localAddress: @options.localAddress
        super

class ConnectUnixSocket extends ConnectNet
    handleOptions: =>
        super
        if not @options.path?
            throw new Error 'unix socket not specified'

    connect: =>
        @debug "ConnectUnixSocket::connect"
        @verbose "Connecting to #{@options.path}..."
        @socket = require('net').connect
            path: @options.path
        super

module.exports =
    unixSocket: ConnectUnixSocket
    tcp:        ConnectTCP
    net:        ConnectNet
    base:       ConnectBase
    PubSub:     PubSub
