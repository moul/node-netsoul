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

module.exports =
    PubSub: PubSub