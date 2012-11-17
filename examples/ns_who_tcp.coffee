#!/usr/bin/env coffee
#
# usage: %prog                  ns_who for everybody
#        %prog touron_m         ns_who for touron_m
#        %prog touron_m jog     ns_who for touron_m and jog
#
# socat -v UNIX-LISTEN:/tmp/netsoul.sock,fork,reuseaddr TCP-CONNECT:ns-server.epitech.eu:4242

# clear terminal
#process.stdout.write '\u001B[2J\u001B[0;0f'

NetsoulConnect = require('..').connects.tcp

nsconnect = new NetsoulConnect
    #host:          'ns-server.epitech.eu'
    #port:          4242
    #localAddress:  '192.168.86.784'
    #debug:          false
    #verbose:        true

usernames = if process.argv.length > 2 then process.argv[2..]

nsconnect.on 'connect', -> console.log "ns_who for #{usernames}"

nsconnect.on 'message', (msg) ->
    if msg.split[0] is 'salut'
        if usernames
            nsconnect.send ['list_users', "{#{usernames.join(',')}}"]
        else
            nsconnect.send ['list_users']
    else if msg.split.length is 12
        console.log msg.split.join(' ')
    else if msg.split[0] is 'rep' and msg.split[1] is '002' and msg.split[4] is 'end'
        console.log 'Done'
        do nsconnect.disconnect
        process.exit 0

nsconnect.on 'error', (error) ->
    console.log 'error', error
    process.exit 1

do nsconnect.connect
