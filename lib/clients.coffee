protocol = require './protocol'
utils    = require './utils'
crypto   = require 'crypto'

class ClientBase extends utils.PubSub
    constructor: (@options = {}) ->
        super
        do @handleOptions
        @debug 'ClientBase::constructor'
        do @setupConnect
        do @setupClient

    debug: (args...) =>
        @options.logFn   "#{@constructor.name}> ", args... if @options.debug

    verbose: (args...) =>
        @options.logFn   "#{@constructor.name}> ", args... if @options.verbose

    handleOptions: =>
        @options.logFn    ?= console.log
        @options.verbose  ?= false
        @options.debug    ?= false
        @options.login    ?= process.env.USER
        @options.location ?= require('os').hostname() || '-'
        @options.agent    ?= 'node-netsoul'
        if not @options.password?
            throw new Error 'password is not specified'
        if not @options.nsconnect?
            throw new Error 'nsconnect is not specified'
        @ns = @options.nsconnect
        @debug 'ClientBase::handleOptions', @options

    setupClient: =>
        @debug 'ClientBase::setupClient'

    setupConnect: =>
        @debug 'ClientBase::setup'
        @ns.on 'connect',    @onConnect
        @ns.on 'message',    @onMessage
        @ns.on 'error',      @onError
        @ns.on 'disconnect', @onDisconnect

    # nsconnect wrappers
    connect: =>
        @debug 'ClientBase::connect'
        do @ns.connect

    send: (data) =>
        @verbose 'ClientBase::send', data.join(' ')
        @ns.send data

    # nsconnect handlers
    onDisconnect: =>
        @debug 'ClientBase::onDisconnect'

    onMessage: (message) =>
        @verbose 'ClientBase::onMessage', message.line
        if message.type?
            handlerName = "message_#{message.type}"
            @debug "ClientBase::onMessage, type=#{handlerName}"
            @emit handlerName, message
            if @[handlerName]?
                @[handlerName] message

    onError: (error) =>
        @debug 'ClientBase::onError', error

    onConnect: =>
        @debug 'ClientBase::onConnect'

    # client handlers

class ClientAuth extends ClientBase
    setupClient: =>
        super
        @debug "ClientAuth::setupClient"
        @authenticated = false
        @auth_step = 0

    message_salut: (message) =>
        @debug "ClientAuth::message_salut", message.line
        @handshake = message.split
        @send ['auth_ag', 'ext_user', 'none', 'none']

    message_rep: (message) =>
        code = message.split[1]
        if not @authenticated
            if @auth_step is 0
                do @readyForHandshake
            if @auth_step is 1
                do @handshakeAccepted
            @auth_step++

    readyForHandshake: =>
        concat    = "#{@handshake[2]}-#{@handshake[3]}/#{@handshake[4]}#{@options.password}"
        login     = @options.login
        hash      = crypto.createHash('md5').update(concat).digest("hex")
        agent     = encodeURIComponent @options.agent
        location  = encodeURIComponent @options.location
        @debug "ClientAuth::message_salut", "login=#{login}, concat=#{concat}, hash=#{hash}, location=#{location}, agent=#{agent}"
        @send ['ext_user_log', login, hash, agent, location]

    handshakeAccepted: =>
        @debug "ClientAuth::handshakeAccepted"
        @authenticated = true
        @emit 'authenticate'

    message_ping: (message) =>
        @debug "ClientAuth::message_pong", message
        @send message.split

class ClientDaemon extends ClientAuth
    setupClient: ->
        super
        @debug "ClientDaemon::setupClient"
        @on 'authenticate', =>
            @send ['user_cmd', 'state', 'actif']

module.exports =
    base:       ClientBase
    auth:       ClientAuth
    daemon:     ClientDaemon
