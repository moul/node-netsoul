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
        return message

module.exports = Protocol
module.exports.Message = Message
