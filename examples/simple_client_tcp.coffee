#!/usr/bin/env coffee
# usage: %prog <login> <password>



# clear terminal
process.stdout.write '\u001B[2J\u001B[0;0f'

netsoul = require('..')

client = new netsoul.clients.daemon
    verbose:            true
    debug:              true
    login:              process.argv[2]
    password:           process.argv[3]
    nsconnect: new NetsoulConnect
        #host:          'ns-server.epitech.eu'
        #port:          4242
        #localAddress:  '192.168.86.784'
        #debug:          false
        #verbose:        true

client.on 'authenticate', ->
    console.log 'Successfully authenticated !'

client.on 'message_ping', ->
    console.log 'Ping received'

do client.connect
