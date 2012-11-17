#!/usr/bin/env coffee
# usage: %prog <login> <password>
#
# socat -v UNIX-LISTEN:/tmp/netsoul.sock,fork,reuseaddr TCP-CONNECT:ns-server.epitech.eu:4242

# clear terminal
process.stdout.write '\u001B[2J\u001B[0;0f'

netsoul = require('..')

client = new netsoul.clients.daemon
    verbose:            true
    debug:              true
    login:              process.argv[2]
    password:           process.argv[3]
    nsconnect: new netsoul.connects.unixSocket
        path:           '/tmp/netsoul.sock'
        #verbose:        true
        #debug:          true



client.on 'authenticate', ->
    console.log 'Successfully authenticated !'

client.on 'message_ping', ->
    console.log 'Ping received'

do client.connect
