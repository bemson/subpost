/*!
 * wap v0.1.0
 * http://github.com/bemson/wap/
 *
 * Copyright, Bemi Faison
 * Released under the MIT License
 */
/* global define, require, module */
!function (inAMD, inCJS, Array, Date, Error, Math, Object, scope, undefined) {

  // dependent module initializer
  function initWAP() {
    var
      ERR_MALFORMED_REQUEST = 600,
      ERR_MISSING_PROPERTY = 601,
      ERR_INVALID_VALUE = 602,
      ERR_INVALID_WINDOW = 604,
      ERR_CLIENT_EXISTS = 605,
      CLIENT_STATE_CLOSED = 'closed',
      CLIENT_STATE_OPEN = 'open',
      CLIENT_STATE_OPENING = 'opening',
      window = inCJS ? global : this,
      bind = scope.attachEvent ?
        function (object, eventName, callback) {
          object.attachEvent('on' + eventName, callback);
        } :
        function (object, eventName, callback) {
          object.addEventListener(eventName, callback, false);
        },
      unbind = scope.attachEvent ?
        function (object, eventName, callback) {
          object.detachEvent('on' + eventName, callback);
        } :
        function (object, eventName, callback) {
          object.removeEventListener(eventName, callback, false);
        },
      getLocation = inCJS ?
        function () {
          return __dirname + __filename;
        } :
        function () {
          return location.href;
        },
      isArray = (typeof Array.isArray === 'function') ?
        Array.isArray :
        function (obj) {
          return obj instanceof Array;
        },
      protoSlice = Array.prototype.slice,
      autoEncodeJSON = 0,
      isWapEnabled = 0,
      globalIncrement = 0,
      appCount = 0,
      apps = {},
      listeningSockets = {},
      wap = {
        app: function (name) {
          if (!isFullString(name)) {
            throw new Error('expected a valid app name');
          }

          if (apps.hasOwnProperty(name)) {
            return apps[name];
          }

          return apps[name] = new ServerHost({id: name});
        },
        link: function (targetAppName, windowReference) {
          var client;

          if (!isFullString(targetAppName)) {
            throw new Error('expected a valid app name');
          }

          client = new ClientHost();
          client.app.name = targetAppName;
          if (arguments.length > 1) {
            client.open(windowReference);
          }
          return client;
        },
        // enable: enableWap,
        // disable: disableWap
      }
    ;

    function sendPostMessage(win, data) {
      try {
        if (autoEncodeJSON) {
          win.postMessage(JSON.stringify(data), '*');
        } else {
          win.postMessage(data, '*');
        }
      } catch (e) {
        return 0;
      }
      return 1;
    }

    function sendProtocolMessage(win, from, to, type, data) {
      return sendPostMessage(win, {});
    }

    function sendMsg(socket, msgType, msgData, parentMsgId) {
      var
        socketId = socket.id,
        host = socket.host,
        win = socket.win,
        payload
      ;
      if (!win || win.closed) {
        // remove unusable window reference
        socket.win = 0;
        // remove and disconnect the client socket
        if (host.conns.hasOwnProperty(socketId)) {
          delete host.conns[socketId];
          host.fire('disconnect', socket);
        }
        host.fire('error', ERR_INVALID_WINDOW);
      } else {
        payload = {
          wap: wap.version,
          id: guid(),
          from: host.id,
          to: socketId,
          type: msgType
        };
        if (parentMsgId) {
          payload.parent = parentMsgId;
        }
        if (msgData) {
          payload.data = msgData;
        }
        if (sendPostMessage(win, payload)) {
          socket.lastMsgId = payload.id;
          return payload;
        }
        host.fire('error', ERR_SEND_FAILED, payload);
      }
      return 0;
    }

    function sendEvent(socket, eventType, eventParams, parentMsgId) {
      return sendMsg(socket, 'message', createMessagePayload(eventType, eventParams), parentMsgId);
    }

    function guid() {
      return globalIncrement++ + '-' + +new Date() + Math.random();
    }

    function extend(base) {
      var
        argumentIdx = 1,
        source,
        member
      ;
      while (source = arguments[argumentIdx++]) {
        for (member in source) {
          if (source.hasOwnProperty(member)) {
            base[member] = source[member];
          }
        }
      }
      return base;
    }

    function isFullString(name) {
      return name && typeof name === 'string';
    }

    function getSortedKeys(obj) {
      var keys = Object.keys(obj);
      keys.sort();
      return keys;
    }

    function getDate(value) {
      if (autoEncodeJSON) {
        return value;
      }
      return new Date(value);
    }

    function createMessagePayload(args) {
      var eventType = args[0];

      return {
        sent: new Date(),
        url: getLocation(),
        event: (typeof eventType === 'object') ?
          eventType :
          {
            type: eventType,
            params: protoSlice.call(args, 1)
          }
      };
    }

    function processPostMessage(evt) {
      var
        data = evt.data,
        socket,
        msgHandler
      ;
      if (isFullString(data)) {
        try {
          data = JSON.parse(data);
        } catch (e) {
          return;
        }
      }

      // verify basic message structure
      if (
        typeof data === 'object' &&
        data.wap >= wap.version &&
        isFullString(data.id) &&
        (
          !data.hasOwnProperty('parent') ||
          isFullString(data.parent)
        )
      ) {
        // define message handler
        msgHandler = new ProtocolMsg(evt);
        socket = listeningSockets[data.to];
        if (socket) {
          msgHandler.socket = socket;
          if (socket['type_' + data.type]) {
            // give message to the target socket
            socket['type_' + data.type](msgHandler);
          } else {
            // tell sender the message is invalid
            msgHandler.fail(ERR_INVALID_COMMAND, data.type);
          }
        } else if (isFullString(data.from)) {
          // tell sender the recipient doesn't exist
          msgHandler.fail(ERR_BAD_RECIPIENT, data.to);
        }
      }
    }

    // tests json auto encoding
    !function () {

      bind(window, 'message', receiveTest);

      try {
        window.postMessage({a:1}, '*');
      } catch (e) {
        endTest();
      }

      function endTest() {
        unbind(window, 'message', receiveTest);
        bind(window, 'message', processPostMessage);
      }

      function receiveTest(evt) {
        if (typeof evt.data === 'object' && evt.data.a === 1) {
          autoEncodeJSON = 1;
        }
        endTest();
      }

    }();

    function EventEmitter() {}
    extend(EventEmitter.prototype, {
      on: function (evt, callback, scope) {
        var me = this;

        if (
          isFullString(evt) &&
          typeof callback === 'function'
        ) {
          if (!me.hasOwnProperty('_evts')) {
            me._evts = {};
          }
          if (!me._evts.hasOwnProperty(evt)) {
            me._evts[evt] = [];
          }
          me._evts[evt].push({
            cb: callback,
            ctx: scope || me
          });
        }
        return me;
      },
      off: function (evt, callback, scope) {
        var
          me = this,
          subs,
          keep,
          subsIdx,
          subsLn
        ;

        if (!me.hasOwnProperty('_evts') || !arguments.length) {
          me._evts = {};
        } else if (
          isFullString(evt) &&
          me._evts.hasOwnProperty(evt)
        ) {
          if (!callback) {
            me._evts[evt] = [];
          } else {
            subs = me._evts[evt];
            keep = me._evts[evt] = [];
            subsIdx = 0;
            subsLn = subs.length;
            for (subsIdx = 0; subsIdx < subsLn; subsIdx++) {
              sub = subs[subsIdx];
              if (sub.cb === callback && (!scope || scope === sub.ctx)) {
                keep[keep.length] = sub;
              }
            }
          }
        }

        return me;
      },
      fire: function (evt) {
        var
          me = this,
          params,
          subs,
          subsLn,
          subsIdx,
          invokeCallback
        ;

        if (
          isFullString(evt) &&
          me.hasOwnProperty('_evts') &&
          me._evts.hasOwnProperty(evt) &&
          (subs = me._evts[evt]).length
        ) {
          params = protoSlice.call(arguments, 1);
          if (params.length) {
            params.unshift(evt);
            invokeCallback = function (sub) {
              sub.cb.apply(sub.ctx, params);
            };
          } else {
            invokeCallback = function (sub) {
              sub.cb.call(sub.ctx, evt);
            };
          }
          subsLn = subs.length;
          for (subsIdx = 0; subsIdx < subsLn; subsIdx++) {
            invokeCallback(subs[subsIdx]);
          }
        }

        return me;
      }
    });


    function Host(cfg) {
      var host = this;

      host.id = guid();
      host.types = {};
      host.conns = {};
      extend(host, cfg);
    }
    Host.prototype = new EventEmitter();

    function ServerHost(cfg) {
      var server = this;

      Host.call(server, cfg);

      server.socket = new ServerSocket({
        host: server
      });
    }
    ServerHost.prototype = new Host();
    extend(ServerHost.prototype, {
      emit: function (eventType) {
        var
          server = this,
          sockets = server.conns,
          socketId,
          pkg
        ;

        if (isFullString(eventType)) {
          pkg = {
            type: eventType,
            params: protoSlice.call(arguments, 1)
          };
          for (socketId in sockets) {
            if (sockets.hasOwnProperty(socketId)) {
              sockets[socketId].send(pkg);
            }
          }
        }
      }
    });

    function ClientHost(cfg) {
      var client = this;

      Host.call(client, cfg);

      client.app = {};
      client.socket = new ClientSocket({
        host: client
      });
    }
    ClientHost.prototype = new Host();
    extend(ClientHost.prototype, {
      open: function (winRef) {
        var host = this;

        host.socket.open(winRef);
        return host;
      },
      close: function () {
        var host = this;

        // reset client app info
        host.app = {
          name: host.app.name
        };

        // disconnect from current app/server
        host.socket.close();

        // remove host from listeners
        delete listeningSockets[host.id];

        return host;
      },
      // sends a custom message
      send: function (eventType) {
        var
          host = this,
          msgSocket = host.conns[host.app.name]
        ;
        if (msgSocket && msgSocket.state === CLIENT_STATE_OPEN && isFullString(eventType)) {
          return msgSocket.send({
            type: eventType,
            params: protoSlice.call(arguments, 1)
          });
        }
      }
    });

    function postMessageResponder(socket, evt) {
      var
        msg = this,
        data = evt.data
      ;
      msg.host,
      msg.win = evt.source;
      msg.from = data.id;
      msg.to = data.fromId;
      msg.id = data.id;
      msg.data = data;
    }
    extend(Message.prototype, {
      reply: function (msgType, msgData) {
        sendProtocolMessage(msg.win, msg.from, msg.to, msgType, msgData, this.id);
      },
      fail: function (code, reason) {
        var msg = this;
        msg.reply('fail', {code: code, text: reason, src: msg.data});
      },
      ack: function () {
        this.reply('ack');
      }
    });

    function Message(host, nativeEvent) {
      var
        msg = this,
        data = nativeEvent.data
      ;
      msg.replies = [];
      msg.id = data.id;
      msg.parent = data.parent || '';
      msg.event = {
        origin: nativeEvent.origin,
        source: nativeEvent.source,
        received: nativeEvent.timestamp ? getDate(nativeEvent.timestamp) : new Date()
      };
      msg.sendee = host;
      // use sender if present, otherwise prep for replying later
      msg.sender = host.conns[msg.fromId];
      if (!msg.sender) {
        msg.fromId = data.fromId;
      }
    }
    extend(Message.prototype, {
      reply: function (msgType, msgData) {
        var
          msg = this,
          payload
        ;
        // use temporal sender, if not present
        if (msg.fromId) {
          msg.sender = new Socket({
            host: msg.sendee.host,
            id: msg.fromId
          });
          delete msg.fromId;
        }
        payload = msg.sender.send(msgType, msgData, msg.id);
        if (payload) {
          msg.replies[msg.replies.length] = payload;
        }
        return payload;
      }
    });

    function MessageAPI(host, nativeEvent) {
      var
        msg = this,
        data = nativeEvent.data
      ;

      msg.event.url = data.url;
      msg.event.sent = getDate(data.sent);
    }
    extend(MessageAPI.prototype, {
      reply: function () {
        var msg = this;
        sendEvent();
        return msg.sendee.socket.send.call(msg.sender,
          'message',
          createMessagePayload(arguments),
          msg.id
        );
      }
    });

    function Socket(cfg) {
      var socket = this;

      socket.id = guid();
      extend(socket, cfg);
    }
    extend(Socket.prototype, {
      send : function (msgType, msgData, parentMsgId) {
        return sendMsg(this, msgType, msgData, parentMsgId);
      }
    });

    function HostSocket(cfg) {
      Socket.call(this, cfg);
    }
    HostSocket.prototype = new Socket();
    extend(HostSocket.prototype, {
      send: function () {
        var socket = this;
        if (Socket.prototype.send.apply(socket, arguments)) {
          listeningSockets[socket.host.id] = socket;
        }
      },
      // when a socket receives a custom message
      type_message: function (protocolMsg) {
        var
          host = protocolMsg.host,
          eventMsg = new EventMsg(protocolMsg),
          types = host.types,
          eventType = eventMsg.type
        ;

        // signal receipt of a message
        host.fire('message', eventMsg);

        // execute declared event handler
        if (types.hasOwnProperty(eventType)) {
          types[eventType].apply(host, [eventMsg].concat(eventMsg.params));
        }
      },
      // when a client of the host is being told to destroy itself
      type_die: function (protocolMsg) {
        var
          host = protocolMsg.host,
          clientId = protocolMsg.to,
          clients = host.conns,
          client
        ;
        if (clients.hasOwnProperty(clientid)) {
          client = clients[clientId];
          delete clients[clientId];
          host.fire('disconnect', client);
        }
      }
    });

    function ClientSocket(cfg) {
      var socket = this;

      HostSocket.call(socket, cfg);
      socket.intv = 0;
    }
    ClientSocket.prototype = new HostSocket();
    extend(ClientSocket.prototype, {
      intv: 0,
      state: CLIENT_STATE_CLOSED,
      open: function (winRef) {
        var
          socket = this,
          host = socket.host,
          pingParams,
          win = isFullString(winRef) ? window.open('', winRef) : winRef
        ;

        if (!win || !win.postMessage) {
          throw new Error('invalid window reference');
        }

        // close host connection if already open or opening
        if (socket.state === CLIENT_STATE_OPEN || socket.state === CLIENT_STATE_OPENING) {
          host.close();
        }

        socket.state = CLIENT_STATE_OPENING;
        socket.win = win;
        pingParams = {types: getSortedKeys(host.types)};

        // ping window to connect
        socket.intv = setInterval(function () {
          socket.send('ping', pingParams);
        }, 500);
      },
      close: function () {
        var
          host = this,
          socket = host.socket
        ;

        // inofrm existing connection - if any
        if (socket.win) {
          socket.send('die');
        }

        clearInterval(socket.intv);
        socket.win = socket.intv = 0;

        socket.state = CLIENT_STATE_CLOSED;
      },
      // when a socket receives an app payload
      type_pong: function (protocolMsg) {
        var
          socket = this,
          host = protocolMsg.host,
          clients = socket.conns,
          data = evt.data,
          appId = data.fromId
        ;
        if (appId !== host.app.name) {
          protocolMsg.fail(ERR_INVALID_VALUE, appId);
        } else if (!data.hasOwnProperty('types')) {
          protocolMsg.fail(ERR_MISSING_PROPERTY, 'types');
        } else if (!Array.isArray(data.types)) {
          protocolMsg.fail(ERR_INVALID_VALUE, 'types');
        } else if (!data.hasOwnProperty('name')) {
          protocolMsg.fail(ERR_MISSING_PROPERTY, 'name');
        } else if (typeof data.name !== 'string') {
          protocolMsg.fail(ERR_INVALID_VALUE, 'name');
        } else if (!data.hasOwnProperty('meta')) {
          protocolMsg.fail(ERR_MISSING_PROPERTY, 'meta');
        } else if (typeof data.meta !== 'object') {
          protocolMsg.fail(ERR_INVALID_VALUE, 'meta');
        } else if (clients.hasOwnProperty(appId)) {
          protocolMsg.fail(ERR_CLIENT_EXISTS, appId);
        } else {
          // create socket that communicates with this app
          clients[appId] = new MessageSocket({
            host: socket,
            win: evt.source,
            id: appId
          });
          // respond to pong
          msg.reply('ok');
          // signal that the socket is connected to an app
          socket.fire('connect', extend(host.app, {
            types: data.types,
            meta: data.meta
          }));
        }
      }
    });

    function ServerSocket() {
      HostSocket.call(this, cfg);
    }
    ServerSocket.prototype = new HostSocket();
    extend(ServerSocket.prototype, {
      // receives ping from socket
      type_ping: function (msg) {
        var
          socket = this,
          host = socket.host,
          sockets = host.conns,
          data = evt.data,
          clientId = data.fromId,
          client = sockets[clientId]
        ;
        if (!data.hasOwnProperty('types')) {
          msg.fail(ERR_MISSING_PROPERTY, 'types');
        } else if (!Array.isArray(data.types)) {
          msg.fail(ERR_INVALID_VALUE, 'types');
        } else if (client) {
          msg.fail(ERR_INVALID_VALUE, clientId);
        } else if (msg.reply('pong', {
          name:host.name,
          types:getSortedKeys(socket.types),
          meta:app.meta
        })) {
          // represent this socket connection if the response works
          client = sockets[clientId] = new MessageSocket({
            host: host,
            win: evt.source,
            id: clientId,
            types: data.types
          });
        }
      },
      // when a app receives an acknowledgement from a socket
      type_ok: function (evt) {
        var
          app = this.host,
          client = app.clients[evt.data.fromId]
        ;
        if (client) {
          // signal to the host that it can send messages to the app
          app.fire('connect', client);
        } else {
          // otherwise, tell socket to disconnect it's connection to this app
          (new Message(app, evt)).reply('die');
        }
      }
    });

    function MessageSocket(cfg) {
      Socket.call(this, cfg);
    }
    MessageSocket.prototype = new Socket();
    extend(MessageSocket.prototype, {
      send: function () {
        sendEvent(this, arguments);
      }
    });

    function AppClient() {
      Client.call(this);
    }
    AppClient.prototype = new Client();

    wap.enable();

    return wap;
  }

  // initialize and expose Flow, based on the environment
  if (inAMD) {
    define(initWAP);
  } else if (inCJS) {
    module.exports = initWAP();
  } else if (!scope.WAP) {
    scope.wap = initWAP();
  }
}(
  typeof define == 'function',
  typeof exports != 'undefined',
  Array, Date, Error, Math, Object, this
);