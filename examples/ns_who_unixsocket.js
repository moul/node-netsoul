// Generated by CoffeeScript 1.4.0
(function() {
  var NetsoulConnect, nsconnect, usernames;

  NetsoulConnect = require('..').connects.unixSocket;

  nsconnect = new NetsoulConnect({
    path: '/tmp/netsoul.sock'
  });

  usernames = process.argv.length > 2 ? process.argv.slice(2) : void 0;

  nsconnect.on('connect', function() {
    return console.log("ns_who for " + usernames);
  });

  nsconnect.on('message', function(msg) {
    if (msg.split[0] === 'salut') {
      if (usernames) {
        return nsconnect.send(['list_users', "{" + (usernames.join(',')) + "}"]);
      } else {
        return nsconnect.send(['list_users']);
      }
    } else if (msg.split.length === 12) {
      return console.log(msg.split.join(' '));
    } else if (msg.split[0] === 'rep' && msg.split[1] === '002' && msg.split[4] === 'end') {
      console.log('Done');
      nsconnect.disconnect();
      return process.exit(0);
    }
  });

  nsconnect.on('error', function(error) {
    console.log('error', error);
    return process.exit(1);
  });

  nsconnect.connect();

}).call(this);