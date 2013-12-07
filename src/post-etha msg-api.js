/*!
 * post-etha v0.1.0
 * http://github.com/bemson/post-etha/
 *
 * Copyright, Bemi Faison
 * Released under the MIT License
 */
/* global define, require, module */
!function (inAMD, inCJS, Array, Date, Error, Math, Object, JSON, scope, undefined) {

/*
Connection states

0 - default - not connected to a window or registered to an app
1 - connecting - registering to a window
2 - connected - connected to a window and registered to an app
3 - ready
*/

  // dependent module initializer
  function initPE() {
    var
      // strings
      STR_MESSAGE = 'message',
      STR_EVENT = 'event',
      STR_DIE = 'die',
      STR_PING = 'ping',
      STR_PONG = 'pong',
      STR_CONNECT = 'connect',
      window = inCJS ? global : this,
      next =
        // use setImmediate
        (
          typeof setImmediate === 'function' &&
          setImmediate
        ) ||
        // use nextTick (for nodeJS only)
        (inCJS && process.nextTick) ||
        // fallback to slower setTimeout call
        function (fn) {
          setTimeout(fn, 0);
        },
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
      // will reference Connection.prototype.send
      Connection_send,
      autoEncodeJSON = 0,
      globalIncrement = 0,
      protocol = {
        // from client to app
        ping: function (app, clientConn, evt, eventData) {
          var
            appId = eventData.to,
            clientId = eventData.from,
            allPendingConnections = pe.conns,
            appWaitList = allPendingConnections[appId]
          ;
          // ensure a connection queue exists for the targeted app
          if (!appWaitList) {
            appWaitList = allPendingConnections[appId] = {};
          }
          // add client connection to wait list
          clientConn = appWaitList[clientId] = new Connection({
            win: evt.source,
            id: clientId,
            meta: eventData.data.meta
          });
          // acknowledge message with "pong"
          sendMessage(clientConn, STR_PONG);
          // if the app exists, tell it to add all pending connections
          if (app) {
            App_getPendingConnections(app);
          }
        },
        // from network, to acknowledge the requesting client
        pong: function (client) {
          Client_stopPing(client);
          // update state of the application connection
          client.state = 2;
        },
        // from app when client has been connected
        connect: function (client, appConn, evt, eventData) {
          // if the client is not connected
          if (client.state === 2) {
            // update client info
            mix(appConn, eventData.data);
            // set client state to ready
            client.state = 3;
            // allow client to send app a message
            if (client.onConnect === 'function') {
              client.onConnect(appConn);
            }
          }
        },
        // from app to client and vice versa, when communicating user events
        event: function (host, conn, postMessageEvent, eventData) {
          var
            evt = eventData.data,
            params
          ;
          if (conn) {
            if (evt && evt.type) {
              // init message API based on type of host
              if (host instanceof App) {
                evt = new AppEvent(conn, postMessageEvent, eventData);
              } else {
                evt = new ClientEvent(conn, postMessageEvent, eventData);
              }

              // publish user event with or without variable number of params
              if (evt.params.length) {
                host.fire.apply(host, [evt.type, evt].concat(evt.params));
              } else {
                host.fire(evt.type, evt);
              }
            }
          } else {
            // tell sender to kill it's dead connection
            sendMessage(
              new Connection({
                host: host,
                win: postMessageEvent.source,
                id: eventData.from
              }),
              STR_DIE
            );
          }
        },
        die: function (host, conn, postMessageEvent, eventData) {
          var
            conns = pe.conns,
            waitList,
            waitListConnId,
            noWaitingConnections = 1,
            hostId = eventData.to
          ;
          // remove temporary connections
          if (conns.hasOwnProperty(hostId)) {
            waitList = conns[hostId];
            delete waitList[eventData.from];
            for (waitListConnId in waitList) {
              if (waitList.hasOwnProperty(waitListConnId)) {
                noWaitingConnections = 0;
                break;
              }
            }
            if (noWaitingConnections) {
              delete conns[hostId];
            }
          }
          // remove active connections
          if (conn) {
            if (host instanceof App) {
              // for apps
              delete host.conns[conn.id];
            } else {
              // for clients
              // remove window now, or closing will send an unnecessary die message back
              conn.win = 0;
              host.close();
            }

            // execute disconnect handler
            if (typeof host.onDisconnect === 'function') {
              host.onDisconnect(conn);
            }
          }
        }
      },
      pe = {
        // registered apps
        apps: {},
        // registered clients (connected to apps)
        clients: {},
        // connections waiting for app registration
        conns: {},
        // registers an pe application
        app: function (name) {
          var
            app,
            apps = pe.apps;

          checkAppName(name);

          if (apps.hasOwnProperty(name)) {
            return apps[name];
          }

          // create new application
          app = apps[name] = new App({id: name});
          // check for pending connections later
          next(function () {
            App_getPendingConnections(app);
          });

          return app;
        },
        // creates a client (for connecting to an app)
        client: function (appId, windowReference) {
          var client;

          checkAppName(appId);

          client = new Client({id: guid()});
          client.app = client.conns[appId] = new Connection({
            host: client,
            id: appId
          });

          // connect to the given window reference
          if (windowReference) {
            next(function () {
              client.open(windowReference);
            });
          }

          return client;
        },
        config: {
          openInterval: 1000,
          hostFn: EventEmitter.prototype
        },
        version: '1.0'
      }
    ;

    // sends an arbitrary message
    function sendMessage(conn, msgType, msgData) {
      var
        win = conn.win,
        hostId = conn.host ? conn.host.id : 0,
        message = {
          pe: pe.version,
          id: guid(),
          to: conn.id,
          from: hostId,
          type: msgType,
          data: msgData
        }
      ;
      if (!win || win.closed) {
        return false;
      }
      try {
        if (autoEncodeJSON) {
          win.postMessage(message, '*');
        } else {
          win.postMessage(JSON.stringify(message), '*');
        }
      } catch (e) {
        return false;
      }
      return message;
    }

    // send a message that is a user event
    function sendEvent(conn, eventTypeAndParams, parent) {
      var
        eventName = eventTypeAndParams[0],
        ary,
        connIdx,
        sendResult
      ;
      if (isFullString(eventName)) {
        if (isArray(conn)) {
          connIdx = conn.length;
          ary = [];
          while (connIdx--) {
            if (sendResult = sendEvent(conn[connIdx], eventTypeAndParams, parent)) {
              ary[connIdx] = sendResult;
            }
          }
          ary.reverse();
          return ary;
        }
        sendResult = sendMessage(conn, STR_EVENT, {
          sent: new Date(),
          url: inCJS ? __dirname + __filename : location.href,
          type: eventName,
          params: protoSlice.call(eventTypeAndParams, 1),
          parent: parent || null
        });
        if (sendResult) {
          return sendResult.id;
        }
      }
    }

    function checkAppName(name) {
      if (name === 'hasOwnProperty' || !isFullString(name)) {
        throw new Error('"' +  name + '" is an invalid id');
      }
    }

    function guid() {
      return globalIncrement++ + '-' + +new Date() + Math.random();
    }

    function mix(base) {
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
      return typeof name === 'string' && name;
    }

    function getDate(value) {
      if (autoEncodeJSON) {
        return value;
      }
      return new Date(value);
    }

    function postMessageListener(evt) {
      var
        data = evt.data,
        host
      ;

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          return;
        }
      }

      if (
        typeof data === 'object' &&
        data.pe >= pe.version &&
        protocol.hasOwnProperty(data.type) &&
        data.hasOwnProperty('from') &&
        isFullString(data.id) &&
        isFullString(data.to)
      ) {
        host = pe.clients[data.to] || pe.apps[data.to];
        protocol[data.type](host, host && host.conns[data.from], evt, data);
      }
    }


    function Connection(cfg) {
      mix(this, cfg);
    }
    Connection.prototype.send = Connection_send = function () {
      return sendEvent(this, arguments);
    };


    function EventEmitter(cfg) {
      mix(this, cfg);
    }
    mix(EventEmitter.prototype, {
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
            ctx: scope || me,
            fctx: arguments.length > 2
          });
        }
        return me;
      },
      off: function (evt, callback, scope) {
        var
          me = this,
          subs,
          keep,
          sub,
          subsIdx = 0
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
            // determine which binds to keep
            for (; sub = subs[subsIdx]; subsIdx++) {
              if (
                // callbacks do not match
                sub.cb !== callback ||
                // bind has a forced scope that does not match
                (sub.fctx && sub.ctx !== scope)
              ) {
                // keep this bind
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
            invokeCallback = function (sub) {
              sub.cb.apply(sub.ctx, params);
            };
          } else {
            invokeCallback = function (sub) {
              sub.cb.call(sub.ctx);
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


    function Host() {}
    Host.prototype = new EventEmitter();
    mix(Host.prototype, {
      onConnect: 0,
      onDisconnect: 0
    });


    function App(cfg) {
      var app = this;
      app.conns = {};
      app.meta = {};
      mix(app, cfg);
    }
    App.prototype = new Host();
    // send message to established connections
    App.prototype.emit = function (recipients) {
      var
        app = this,
        customArray = isArray(recipients),
        conns = customArray ? recipients : App_getConnections(app),
        args = arguments,
        connIdx = conns.length,
        totalConns = conns.length
      ;

      if (customArray) {
        args = protoSlice.call(args, 1);
      }

      while(connIdx--) {
        Connection_send.apply(conns[connIdx], args);
      }

      return app;
    };

    function App_getPendingConnections(app) {
      var
        appId = app.id,
        connectPayload,
        pendingId,
        allPendingConnections = pe.conns,
        pendingConns = allPendingConnections[app.id],
        clientConn,
        appConnections = app.conns,
        hasConnectCallback = typeof app.onConnect === 'function'
      ;
      if (pendingConns) {
        // clear queue of pending connections for this app
        allPendingConnections[app.id] = 0;
        // create connect paylod
        connectPayload = {
          meta: app.meta
        };
        for (pendingId in pendingConns) {
          if (pendingConns.hasOwnProperty(pendingId) && !appConnections.hasOwnProperty(pendingId)) {
            clientConn = pendingConns[pendingId];
            // set host (app) for this client connection
            clientConn.host = app;
            // save and announce new client, if we can send a "connect" message
            if (sendMessage(clientConn, STR_CONNECT, connectPayload)) {
              // save connection in app
              appConnections[pendingId] = clientConn;
              // fire connect event after adding this client connection
              if (hasConnectCallback) {
                app.onConnect(clientConn);
              }
            }
          }
        }
      }
      return app;
    }

    // returns an array of app connections
    function App_getConnections(app, excludeId) {
      var
        ary = [],
        conns = app.conns,
        connId
      ;
      for (connId in conns) {
        if (connId !== excludeId && conns.hasOwnProperty(connId)) {
          ary[ary.length] = conns[connId];
        }
      }
      return ary;
    }


    function Client(cfg) {
      var client = this;
      client.conns = {};
      client.open_intv = 0;
      mix(client, cfg);
    }
    Client.prototype = new Host();
    mix(Client.prototype, {
      open: function (winRef) {
        var
          client = this,
          appConn = client.app,
          openIntervalFn,
          pingPayload,
          win = isFullString(winRef) ? window.open('', winRef) : winRef
        ;

        // end any current connection
        if (client.state) {
          client.close();
        }

        // ping the window
        if (win && !win.closed) {
          // allow this client to handle incoming messages
          pe.clients[client.id] = client;

          // update state
          appConn.win = win;
          client.state = 1;

          // define payload and ping window periodically
          pingPayload = {meta: client.meta};
          openIntervalFn = function () {
            // close if we can't ping the window
            if (!sendMessage(appConn, STR_PING, pingPayload)) {
              client.close();
            }
          };
          client.open_intv = setInterval(openIntervalFn, pe.config.openInterval);
          // do first run asap, since interval could be long
          next(openIntervalFn);
        }

        return client;
      },
      close: function () {
        var
          client = this,
          appConn = client.app
        ;

        delete pe.clients[client.id];
        Client_stopPing(client);

        // kill existing connection
        if (appConn.win) {
          sendMessage(appConn, STR_DIE);
        }
        // reset connection members
        client.state =
        appConn.win =
          0;

        return client;
      },
      send: function () {
        var
          client = this,
          appConn = client.app;

        if (client.state === 3) {
          // return the message id or false
          return appConn.send.apply(appConn, arguments) || false;
        }
        return false;
      }
    });

    function Client_stopPing(client) {
      clearInterval(client.open_intv);
      client.open_intv = 0;
    }


    function ClientEvent(conn, postMessageEvent, eventData) {
      var
        evt = this,
        userEvent
      ;
      if (conn) {
        userEvent = eventData.data;
        evt.conn = conn;
        evt.from = conn.id;
        evt.to = conn.host.id;
        evt.event = {
          sent: (autoEncodeJSON) ? userEvent.sent : new Date(userEvent.sent),
          received: new Date(postMessageEvent.timestamp),
          origin: postMessageEvent.origin,
          url: userEvent.url
        };
        evt.type = userEvent.type;
        evt.params = userEvent.params;
        evt.id = eventData.id;
        parentEvent = evt.parent = eventData.parent;
        evt.replies = [];
        // convert string dates if autojson is off
        if (!autoEncodeJSON && parentEvent) {
          parentEvent = parentEvent.event;
          parentEvent.sent = new Date(parentEvent.sent);
          parentEvent.received = new Date(parentEvent.received);
        }
      }
    }
    ClientEvent.prototype.reply = function () {
      var
        evt = this,
        response = sendEvent(evt.conn, arguments, ClientEvent_sanitized(evt))
      ;
      if (response) {
        return evt.replies[evt.replies.length] = response;
      }
      return false;
    };

    function ClientEvent_sanitized(evt) {
      var obj;
      if (!evt._copy) {
        obj = {
          id: evt.id,
          from: evt.from,
          to: evt.to,
          type: evt.type,
          params: evt.params,
          event: evt.event,
          replies: evt.replies
        };
        if (evt.parent) {
          obj.parentId = evt.parent.id;
        }
        evt._copy = obj;
      }

      return evt._copy;
    }

    function ClientEvent_batchReply(evt, targetClients, eventData) {
      var
        replies = evt.replies,
        response = sendEvent(targetClients, eventData, ClientEvent_sanitized(evt))
      ;
      if (response) {
        return replies[replies.length] = response;
      }
      return false;
    }


    function AppEvent(conn, nativeEvent, eventData) {
      ClientEvent.call(this, conn, nativeEvent, eventData);
    }
    AppEvent.prototype = new ClientEvent();
    mix(AppEvent.prototype, {
      replyAll: function () {
        var evt = this;
        return ClientEvent_batchReply(evt, App_getConnections(evt.conn.host), arguments);
      },
      replyElse: function () {
        var
          evt = this,
          conn = evt.conn
        ;
        return ClientEvent_batchReply(evt, App_getConnections(conn.host, conn.id), arguments);
      }
    });

    // assess json encoding capability
    !function () {

      bind(window, STR_MESSAGE, receiveTest);

      try {
        window.postMessage({a:1}, '*');
      } catch (e) {
        endTest();
      }

      function receiveTest(evt) {
        if (typeof evt.data === 'object' && evt.data.a === 1) {
          autoEncodeJSON = 1;
        }
        endTest();
      }

      function endTest() {
        unbind(window, STR_MESSAGE, receiveTest);
        bind(window, STR_MESSAGE, postMessageListener);
      }
    }();

    return pe;

  }

  // initialize and expose Flow, based on the environment
  if (inAMD) {
    define(initPE);
  } else if (inCJS) {
    module.exports = initPE();
  } else if (!scope.postetha) {
    scope.postetha = initPE();
  }
}(
  typeof define == 'function',
  typeof exports != 'undefined',
  Array, Date, Error, Math, Object, JSON, this
);