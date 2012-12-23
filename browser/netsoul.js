(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/connects.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ConnectBase, ConnectNet, ConnectTCP, ConnectUnixSocket, protocol, utils,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  protocol = require('./protocol');

  utils = require('./utils');

  ConnectBase = (function(_super) {

    __extends(ConnectBase, _super);

    function ConnectBase(options) {
      this.options = options != null ? options : {};
      this.connect = __bind(this.connect, this);

      this.handleOptions = __bind(this.handleOptions, this);

      this.verbose = __bind(this.verbose, this);

      this.debug = __bind(this.debug, this);

      this.connected = false;
      this.handleOptions();
      this.debug('ConnectBase::constructor');
      ConnectBase.__super__.constructor.call(this, this.options);
    }

    ConnectBase.prototype.debug = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (this.options.debug) {
        return (_ref = this.options).logFn.apply(_ref, ["" + this.constructor.name + "> "].concat(__slice.call(args)));
      }
    };

    ConnectBase.prototype.verbose = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (this.options.verbose) {
        return (_ref = this.options).logFn.apply(_ref, ["" + this.constructor.name + "> "].concat(__slice.call(args)));
      }
    };

    ConnectBase.prototype.handleOptions = function() {
      var _base, _base1, _base2, _ref, _ref1, _ref2;
      if ((_ref = (_base = this.options).logFn) == null) {
        _base.logFn = console.log;
      }
      if ((_ref1 = (_base1 = this.options).verbose) == null) {
        _base1.verbose = false;
      }
      if ((_ref2 = (_base2 = this.options).debug) == null) {
        _base2.debug = false;
      }
      return this.debug('handleOptions');
    };

    ConnectBase.prototype.connect = function() {
      if (!(this.socket != null)) {
        throw new Error('socket does not exists');
      }
    };

    return ConnectBase;

  })(utils.PubSub);

  ConnectNet = (function(_super) {

    __extends(ConnectNet, _super);

    function ConnectNet() {
      this.onError = __bind(this.onError, this);

      this.onClose = __bind(this.onClose, this);

      this.onDisconnect = __bind(this.onDisconnect, this);

      this.handleLine = __bind(this.handleLine, this);

      this.onBuffer = __bind(this.onBuffer, this);

      this.onConnect = __bind(this.onConnect, this);

      this.disconnect = __bind(this.disconnect, this);

      this.send = __bind(this.send, this);

      this.connect = __bind(this.connect, this);
      return ConnectNet.__super__.constructor.apply(this, arguments);
    }

    ConnectNet.prototype.connect = function() {
      this.debug("ConnectNet::connect");
      ConnectNet.__super__.connect.apply(this, arguments);
      this.socket.on('connect', this.onConnect);
      this.socket.on('data', this.onBuffer);
      this.socket.on('end', this.onDisconnect);
      this.socket.on('error', this.onError);
      return this.socket.on('close', this.onClose);
    };

    ConnectNet.prototype.send = function(message, encoding, callback) {
      var data;
      if (encoding == null) {
        encoding = null;
      }
      if (callback == null) {
        callback = null;
      }
      if (typeof message === 'string') {
        data = "" + message + "\r\n";
      } else {
        data = message.join(" ") + "\r\n";
      }
      return this.socket.write(data, encoding, callback);
    };

    ConnectNet.prototype.disconnect = function() {
      this.socket.end();
      return this.onDisconnect();
    };

    ConnectNet.prototype.onConnect = function() {
      this.connected = true;
      this.debug("ConnectNet::onConnect");
      return this.emit('connect');
    };

    ConnectNet.prototype.onBuffer = function(buffer) {
      var line, _i, _len, _ref, _results;
      this.debug('ConnectNet::onBuffer', buffer);
      this.emit('buffer', buffer);
      _ref = buffer.toString().split("\n");
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        line = _ref[_i];
        _results.push(this.handleLine(line));
      }
      return _results;
    };

    ConnectNet.prototype.handleLine = function(line) {
      var message;
      line = line.replace(/^\s+|\s+$/g, "");
      if (!line.length) {
        return false;
      }
      this.debug('ConnectNet::handleLine', line);
      message = protocol.prototype.parseData(line);
      this.debug('protocol::parseData', message);
      this.emit('data', line);
      return this.emit('message', message);
    };

    ConnectNet.prototype.onDisconnect = function() {
      this.debug("ConnectNet::onDisconnect");
      this.connected = false;
      return this.emit('disconnect');
    };

    ConnectNet.prototype.onClose = function() {
      this.debug("ConnectNet::onClose");
      this.connected = false;
      return this.emit('disconnect');
    };

    ConnectNet.prototype.onError = function(error) {
      this.debug("ConnectNet::onError", error);
      return this.emit('error', error);
    };

    return ConnectNet;

  })(ConnectBase);

  ConnectTCP = (function(_super) {

    __extends(ConnectTCP, _super);

    function ConnectTCP() {
      this.connect = __bind(this.connect, this);

      this.handleOptions = __bind(this.handleOptions, this);
      return ConnectTCP.__super__.constructor.apply(this, arguments);
    }

    ConnectTCP.prototype.handleOptions = function() {
      var _base, _base1, _base2, _ref, _ref1, _ref2;
      ConnectTCP.__super__.handleOptions.apply(this, arguments);
      if ((_ref = (_base = this.options).host) == null) {
        _base.host = 'ns-server.epitech.net';
      }
      if ((_ref1 = (_base1 = this.options).port) == null) {
        _base1.port = 4242;
      }
      return (_ref2 = (_base2 = this.options).localAddress) != null ? _ref2 : _base2.localAddress = '0.0.0.0';
    };

    ConnectTCP.prototype.connect = function() {
      this.debug("ConnectTCP::connect");
      this.verbose("Connecting to " + this.options.host + ":" + this.options.port + "...");
      this.socket = require('net').connect({
        port: this.options.port,
        host: this.options.host,
        localAddress: this.options.localAddress
      });
      return ConnectTCP.__super__.connect.apply(this, arguments);
    };

    return ConnectTCP;

  })(ConnectNet);

  ConnectUnixSocket = (function(_super) {

    __extends(ConnectUnixSocket, _super);

    function ConnectUnixSocket() {
      this.connect = __bind(this.connect, this);

      this.handleOptions = __bind(this.handleOptions, this);
      return ConnectUnixSocket.__super__.constructor.apply(this, arguments);
    }

    ConnectUnixSocket.prototype.handleOptions = function() {
      ConnectUnixSocket.__super__.handleOptions.apply(this, arguments);
      if (!(this.options.path != null)) {
        throw new Error('unix socket not specified');
      }
    };

    ConnectUnixSocket.prototype.connect = function() {
      this.debug("ConnectUnixSocket::connect");
      this.verbose("Connecting to " + this.options.path + "...");
      this.socket = require('net').connect({
        path: this.options.path
      });
      return ConnectUnixSocket.__super__.connect.apply(this, arguments);
    };

    return ConnectUnixSocket;

  })(ConnectNet);

  module.exports = {
    unixSocket: ConnectUnixSocket,
    tcp: ConnectTCP,
    net: ConnectNet,
    base: ConnectBase
  };

}).call(this);

});

require.define("/protocol.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var Message, Protocol;

  Message = (function() {

    function Message() {}

    Message.prototype.data = '';

    Message.prototype.split = [];

    Message.prototype.debug = function(callback) {
      if (callback == null) {
        callback = console.dir;
      }
      return callback({
        data: this.data,
        split: this.split
      });
    };

    return Message;

  })();

  Protocol = (function() {

    function Protocol() {}

    Protocol.prototype.parseData = function(line) {
      var message, _ref;
      message = new Message;
      message.line = line;
      message.split = line.split(' ');
      if ((_ref = message.split[0]) === 'salut' || _ref === 'ping' || _ref === 'rep') {
        message.type = message.split[0];
      }
      return message;
    };

    return Protocol;

  })();

  module.exports = Protocol;

  module.exports.Message = Message;

}).call(this);

});

require.define("/utils.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var PubSub,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __slice = [].slice;

  PubSub = (function() {

    function PubSub() {
      this.emit = __bind(this.emit, this);

      this.on = __bind(this.on, this);
      this.subs = {};
    }

    PubSub.prototype.on = function(event, callback, id) {
      if (id == null) {
        id = null;
      }
      if (!(this.subs[event] != null)) {
        this.subs[event] = [];
      }
      return this.subs[event].push({
        callback: callback,
        id: id
      });
    };

    PubSub.prototype.emit = function() {
      var args, event, subscription, _i, _len, _ref, _results;
      event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (!(this.subs[event] != null)) {
        return false;
      }
      _ref = this.subs[event];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        subscription = _ref[_i];
        _results.push(subscription.callback.apply(subscription, args));
      }
      return _results;
    };

    return PubSub;

  })();

  module.exports = {
    PubSub: PubSub
  };

}).call(this);

});

require.define("net",function(require,module,exports,__dirname,__filename,process,global){// todo

});

require.define("/clients.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ClientAuth, ClientBase, ClientDaemon, crypto, protocol, utils,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  protocol = require('./protocol');

  utils = require('./utils');

  crypto = require('crypto');

  ClientBase = (function(_super) {

    __extends(ClientBase, _super);

    function ClientBase(options) {
      this.options = options != null ? options : {};
      this.onConnect = __bind(this.onConnect, this);

      this.onError = __bind(this.onError, this);

      this.onMessage = __bind(this.onMessage, this);

      this.onDisconnect = __bind(this.onDisconnect, this);

      this.send = __bind(this.send, this);

      this.connect = __bind(this.connect, this);

      this.setupConnect = __bind(this.setupConnect, this);

      this.setupClient = __bind(this.setupClient, this);

      this.handleOptions = __bind(this.handleOptions, this);

      this.verbose = __bind(this.verbose, this);

      this.debug = __bind(this.debug, this);

      ClientBase.__super__.constructor.apply(this, arguments);
      this.handleOptions();
      this.debug('ClientBase::constructor');
      this.setupConnect();
      this.setupClient();
    }

    ClientBase.prototype.debug = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (this.options.debug) {
        return (_ref = this.options).logFn.apply(_ref, ["" + this.constructor.name + "> "].concat(__slice.call(args)));
      }
    };

    ClientBase.prototype.verbose = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (this.options.verbose) {
        return (_ref = this.options).logFn.apply(_ref, ["" + this.constructor.name + "> "].concat(__slice.call(args)));
      }
    };

    ClientBase.prototype.handleOptions = function() {
      var _base, _base1, _base2, _base3, _base4, _base5, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
      if ((_ref = (_base = this.options).logFn) == null) {
        _base.logFn = console.log;
      }
      if ((_ref1 = (_base1 = this.options).verbose) == null) {
        _base1.verbose = false;
      }
      if ((_ref2 = (_base2 = this.options).debug) == null) {
        _base2.debug = false;
      }
      if ((_ref3 = (_base3 = this.options).login) == null) {
        _base3.login = process.env.USER;
      }
      if ((_ref4 = (_base4 = this.options).location) == null) {
        _base4.location = '-';
      }
      if ((_ref5 = (_base5 = this.options).agent) == null) {
        _base5.agent = 'node-netsoul';
      }
      if (!(this.options.password != null)) {
        throw new Error('password is not specified');
      }
      if (!(this.options.nsconnect != null)) {
        throw new Error('nsconnect is not specified');
      }
      this.ns = this.options.nsconnect;
      return this.debug('ClientBase::handleOptions', this.options);
    };

    ClientBase.prototype.setupClient = function() {
      return this.debug('ClientBase::setupClient');
    };

    ClientBase.prototype.setupConnect = function() {
      this.debug('ClientBase::setup');
      this.ns.on('connect', this.onConnect);
      this.ns.on('message', this.onMessage);
      this.ns.on('error', this.onError);
      return this.ns.on('disconnect', this.onDisconnect);
    };

    ClientBase.prototype.connect = function() {
      this.debug('ClientBase::connect');
      return this.ns.connect();
    };

    ClientBase.prototype.send = function(data) {
      this.verbose('ClientBase::send', data.join(' '));
      return this.ns.send(data);
    };

    ClientBase.prototype.onDisconnect = function() {
      return this.debug('ClientBase::onDisconnect');
    };

    ClientBase.prototype.onMessage = function(message) {
      var handlerName;
      this.verbose('ClientBase::onMessage', message.line);
      if (message.type != null) {
        handlerName = "message_" + message.type;
        this.debug("ClientBase::onMessage, type=" + handlerName);
        this.emit(handlerName, message);
        if (this[handlerName] != null) {
          return this[handlerName](message);
        }
      }
    };

    ClientBase.prototype.onError = function(error) {
      return this.debug('ClientBase::onError', error);
    };

    ClientBase.prototype.onConnect = function() {
      return this.debug('ClientBase::onConnect');
    };

    return ClientBase;

  })(utils.PubSub);

  ClientAuth = (function(_super) {

    __extends(ClientAuth, _super);

    function ClientAuth() {
      this.message_ping = __bind(this.message_ping, this);

      this.handshakeAccepted = __bind(this.handshakeAccepted, this);

      this.readyForHandshake = __bind(this.readyForHandshake, this);

      this.message_rep = __bind(this.message_rep, this);

      this.message_salut = __bind(this.message_salut, this);

      this.setupClient = __bind(this.setupClient, this);
      return ClientAuth.__super__.constructor.apply(this, arguments);
    }

    ClientAuth.prototype.setupClient = function() {
      ClientAuth.__super__.setupClient.apply(this, arguments);
      this.debug("ClientAuth::setupClient");
      this.authenticated = false;
      return this.auth_step = 0;
    };

    ClientAuth.prototype.message_salut = function(message) {
      this.debug("ClientAuth::message_salut", message.line);
      this.handshake = message.split;
      return this.send(['auth_ag', 'ext_user', 'none', 'none']);
    };

    ClientAuth.prototype.message_rep = function(message) {
      var code;
      code = message.split[1];
      if (!this.authenticated) {
        if (this.auth_step === 0) {
          this.readyForHandshake();
        }
        if (this.auth_step === 1) {
          this.handshakeAccepted();
        }
        return this.auth_step++;
      }
    };

    ClientAuth.prototype.readyForHandshake = function() {
      var agent, concat, hash, location, login;
      concat = "" + this.handshake[2] + "-" + this.handshake[3] + "/" + this.handshake[4] + this.options.password;
      login = this.options.login;
      hash = crypto.createHash('md5').update(concat).digest("hex");
      agent = encodeURIComponent(this.options.agent);
      location = encodeURIComponent(this.options.location);
      this.debug("ClientAuth::message_salut", "login=" + login + ", concat=" + concat + ", hash=" + hash + ", location=" + location + ", agent=" + agent);
      return this.send(['ext_user_log', login, hash, agent, location]);
    };

    ClientAuth.prototype.handshakeAccepted = function() {
      this.debug("ClientAuth::handshakeAccepted");
      this.authenticated = true;
      return this.emit('authenticate');
    };

    ClientAuth.prototype.message_ping = function(message) {
      this.debug("ClientAuth::message_pong", message);
      return this.send(message.split);
    };

    return ClientAuth;

  })(ClientBase);

  ClientDaemon = (function(_super) {

    __extends(ClientDaemon, _super);

    function ClientDaemon() {
      return ClientDaemon.__super__.constructor.apply(this, arguments);
    }

    ClientDaemon.prototype.setupClient = function() {
      var _this = this;
      ClientDaemon.__super__.setupClient.apply(this, arguments);
      this.debug("ClientDaemon::setupClient");
      return this.on('authenticate', function() {
        return _this.send(['user_cmd', 'state', 'actif']);
      });
    };

    return ClientDaemon;

  })(ClientAuth);

  module.exports = {
    base: ClientBase,
    auth: ClientAuth,
    daemon: ClientDaemon
  };

}).call(this);

});

require.define("crypto",function(require,module,exports,__dirname,__filename,process,global){module.exports = require("crypto-browserify")
});

require.define("/node_modules/crypto-browserify/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {}
});

require.define("/node_modules/crypto-browserify/index.js",function(require,module,exports,__dirname,__filename,process,global){var sha = require('./sha')
var rng = require('./rng')

var algorithms = {
  sha1: {
    hex: sha.hex_sha1,
    binary: sha.b64_sha1,
    ascii: sha.str_sha1
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) {
  alg = alg || 'sha1'
  if(!algorithms[alg])
    error('algorithm:', alg, 'is not yet supported')
  var s = ''
  var _alg = algorithms[alg]
  return {
    update: function (data) {
      s += data
      return this
    },
    digest: function (enc) {
      enc = enc || 'binary'
      var fn
      if(!(fn = _alg[enc]))
        error('encoding:', enc , 'is not yet supported for algorithm', alg)
      var r = fn(s)
      s = null //not meant to use the hash after you've called digest.
      return r
    }
  }
}

exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, rng(size));
    } catch (err) { callback(err); }
  } else {
    return rng(size);
  }
}

// the least I can do is make error messages for the rest of the node.js/crypto api.
;['createCredentials'
, 'createHmac'
, 'createCypher'
, 'createCypheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDeffieHellman'
, 'pbkdf2'].forEach(function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

});

require.define("/node_modules/crypto-browserify/sha.js",function(require,module,exports,__dirname,__filename,process,global){/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

exports.hex_sha1 = hex_sha1;
exports.b64_sha1 = b64_sha1;
exports.str_sha1 = str_sha1;
exports.hex_hmac_sha1 = hex_hmac_sha1;
exports.b64_hmac_sha1 = b64_hmac_sha1;
exports.str_hmac_sha1 = str_hmac_sha1;

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data)
{
  var bkey = str2binb(key);
  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
  return core_sha1(opad.concat(hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
  return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str(bin)
{
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
  return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
  }
  return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}


});

require.define("/node_modules/crypto-browserify/rng.js",function(require,module,exports,__dirname,__filename,process,global){// Original code adapted from Robert Kieffer.
// details at https://github.com/broofa/node-uuid
(function() {
  var _global = this;

  var mathRNG, whatwgRNG;

  // NOTE: Math.random() does not guarantee "cryptographic quality"
  mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  }

  // currently only available in webkit-based browsers.
  if (_global.crypto && crypto.getRandomValues) {
    var _rnds = new Uint32Array(4);
    whatwgRNG = function(size) {
      var bytes = new Array(size);
      crypto.getRandomValues(_rnds);

      for (var c = 0 ; c < size; c++) {
        bytes[c] = _rnds[c >> 2] >>> ((c & 0x03) * 8) & 0xff;
      }
      return bytes;
    }
  }

  module.exports = whatwgRNG || mathRNG;

}())
});

require.define("/browser.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {

  window.Netsoul = {
    connects: require('./connects'),
    clients: require('./clients')
  };

}).call(this);

});
require("/browser.coffee");
})();
