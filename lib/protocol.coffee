class Message
    data: ''
    split: []

    debug: (callback = console.dir) ->
        callback
            data:  @data
            split: @split

class Protocol
    parseData: (line) ->
        message = new Message
        message.line =  line
        message.split = line.split(' ')
        if message.split[0] in ['salut', 'ping', 'rep']
            message.type = message.split[0]
        return message

module.exports = Protocol
module.exports.Message = Message
