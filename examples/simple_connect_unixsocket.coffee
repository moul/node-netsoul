#!/usr/bin/env coffee
#
# socat -v UNIX-LISTEN:/tmp/netsoul.sock,fork,reuseaddr TCP-NSCONNECT:ns-server.epitech.eu:4242

NetsoulConnect = require('..').connects.unixSocket

nsconnect = new NetsoulConnect
    path:         '/tmp/netsoul.sock'
    #verbose:      true
    #debug:        true

prefix = "DEBUG> "

nsconnect.on 'buffer', (buffer) ->    console.log "#{prefix}buffer", buffer

nsconnect.on 'data', (data) ->        console.log "#{prefix}data", data

nsconnect.on 'nsconnect', ->          console.log "#{prefix}nsconnect"

nsconnect.on 'disconnect', ->         console.log "#{prefix}disconnect"

nsconnect.on 'error', (error) ->
    console.log "#{prefix}error", error
    process.exit 1

nsconnect.on 'message', (msg) ->
    console.log "#{prefix}message", msg
    if msg.split[0] is 'ping'
        nsconnect.send 'pong'

do nsconnect.connect
