/*!
 * SubPost v0.1.0
 * http://github.com/bemson/subpost/
 *
 * Copyright, Bemi Faison
 * Released under the MIT License
 */
/* global define, require, module */
!function (inAMD, inCJS, Array, Date, Error, Math, JSON, scope, undefined) {

/*
Connection states

0 - default - not connected to a window or registered to a host
1 - connecting - registering to a window
2 - connected - connected to a window and registered to a host
3 - ready
*/

  // dependent module initializer
  function initSubPost() {
    var
      // strings
      STR_EVENT_PREFIX = '::',
      STR_EVENT_PREFIX_ln = STR_EVENT_PREFIX.length,
      STR_STATE_CHANGE_EVENT = STR_EVENT_PREFIX  + 'stateChange',
      STR_MESSAGE = 'message',
      STR_DISCONNECT = 'disconnect',
      STR_PING = 'ping',
      STR_PONG = 'pong',
      STR_CONNECT = 'connect',
      window = inCJS ? global : this,
      rxp_guid = /[xy]/g,
      _guidPattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
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
      // Connection_send,
      autoEncodeJSON = 0,
      globalIncrement = 0,
      protocol = {
        // from client to host
        ping: function (host, clientConn, evt, eventData) {
          var
            hostId = eventData.to,
            clientId = eventData.from,
            allPendingConnections = subpost.conns,
            hostWaitList = allPendingConnections[hostId]
          ;
          // ensure a connection queue exists for the targeted host
          if (!hostWaitList) {
            hostWaitList = allPendingConnections[hostId] = {};
          }
          // add client connection to wait list
          clientConn = hostWaitList[clientId] = new Connection({
            win: evt.source,
            id: clientId
          });
          // acknowledge message with "pong"
          sendMessage(clientConn, STR_PONG);
          // if the host exists, tell it to add all pending connections
          if (host) {
            Host_getPendingConnections(host);
          }
        },
        // from network, to acknowledge the requesting client
        pong: function (client) {
          Client_stopPing(client);
          // update state of the host connection
          client.state = 2;
          client.fire(STR_STATE_CHANGE_EVENT, 2, 1);
        },
        // from host when client has been connected
        connect: function (client, hostConn, evt, eventData) {
          // if the client is not connected
          if (client.state === 2) {
            // update client info
            mix(hostConn, eventData.data);
            // set client state to ready
            client.state = 3;
            // fire post-sub events
            client.fire(STR_STATE_CHANGE_EVENT, 3, 2);
            client.fire(STR_EVENT_PREFIX + STR_CONNECT, hostConn);
          }
        },
        // from host to client and vice versa, when communicating user events
        message: function (socket, conn, postMessageEvent, eventData) {
          var
            evt = eventData.data,
            msg,
            params
          ;
          if (conn) {
            if (evt && evt.type) {
              msg = new ClientEvent(conn, postMessageEvent, eventData);
              // fire generic message event
              socket.fire(STR_EVENT_PREFIX + STR_MESSAGE, msg);
              // publish user event with or without variable number of params
              if (msg.params.length) {
                socket.fire.apply(socket, [msg.type, msg].concat(msg.params));
              } else {
                socket.fire(msg.type, msg);
              }
            }
          } else {
            // tell sender to kill it's dead connection
            sendMessage(
              new Connection({
                sox: socket,
                win: postMessageEvent.source,
                id: eventData.from
              }),
              STR_DISCONNECT
            );
          }
        },
        disconnect: function (socket, conn, postMessageEvent, eventData) {
          var
            conns = subpost.conns,
            waitList,
            waitListConnId,
            noWaitingConnections = 1,
            socketId = eventData.to
          ;
          // remove temporary connections
          if (conns.hasOwnProperty(socketId)) {
            waitList = conns[socketId];
            delete waitList[eventData.from];
            for (waitListConnId in waitList) {
              if (waitList.hasOwnProperty(waitListConnId)) {
                noWaitingConnections = 0;
                break;
              }
            }
            if (noWaitingConnections) {
              delete conns[socketId];
            }
          }
          // remove active connections
          if (conn) {
            if (socket instanceof Host) {
              // for hosts
              delete socket.conns[conn.id];
            } else {
              // for clients
              // remove window now, or closing will send an unnecessary die message back
              conn.win = 0;
              socket.close();
            }

            // fire post-sub event
            socket.fire(STR_EVENT_PREFIX + STR_DISCONNECT, conn);
          }
        }
      },
      subpost = {
        // registered hosts
        hosts: {},
        // registered clients (connected to hosts)
        clients: {},
        // connections waiting for host registration
        conns: {},
        // registers a host
        host: function (name) {
          var
            host,
            hosts = subpost.hosts;

          checkHostName(name);

          if (hosts.hasOwnProperty(name)) {
            return hosts[name];
          }

          // create new host
          host = hosts[name] = new Host({id: name});
          // check for pending connections later
          next(function () {
            Host_getPendingConnections(host);
          });

          return host;
        },
        // creates a client (for connecting to an host)
        client: function (hostId, windowReference) {
          var client;

          checkHostName(hostId);

          client = new Client({
            id: guid(),
            hostId: hostId,
            state: 0
          });
          client.conns[hostId] = new Connection({
            sox: client,
            id: hostId
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
          pingInterval: 1000,
          emitterFn: EventEmitter.prototype
        },
        version: '1.0'
      }
    ;

    // sends an arbitrary message
    function sendMessage(conn, msgType, msgData) {
      var
        win = conn.win,
        hostId = conn.sox ? conn.sox.id : 0,
        message = {
          ps: subpost.version,
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
        sendResult = sendMessage(conn, STR_MESSAGE, {
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

    function checkHostName(name) {
      if (
        name === 'hasOwnProperty' ||
        !isFullString(name) ||
        name.substr(0, STR_EVENT_PREFIX_ln) === STR_EVENT_PREFIX
      ) {
        throw new Error('"' +  name + '" is an invalid identifier');
      }
    }

    function guid() {
      return _guidPattern.replace(rxp_guid, _guid);
    }

    function _guid (c) {
        var
          r = Math.random()*16|0,
          v = c === 'x' ? r : (r&0x3|0x8)
        ;
        return v.toString(16);
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
        socket
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
        data.ps >= subpost.version &&
        protocol.hasOwnProperty(data.type) &&
        data.hasOwnProperty('from') &&
        isFullString(data.id) &&
        isFullString(data.to)
      ) {
        socket = subpost.clients[data.to] || subpost.hosts[data.to];
        protocol[data.type](socket, socket && socket.conns[data.from], evt, data);
      }
    }


    function Connection(cfg) {
      mix(this, cfg);
    }
    // Connection.prototype.send = Connection_send = function () {
    Connection.prototype.send = function () {
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
            for (; sub = subs[subsIdx]; ++subsIdx) {
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
          for (subsIdx = 0; subsIdx < subsLn; ++subsIdx) {
            invokeCallback(subs[subsIdx]);
          }
        }

        return me;
      }
    });


    function Socket() {}
    Socket.prototype = new EventEmitter();

    function Host(cfg) {
      var host = this;
      host.conns = {};
      mix(host, cfg);
    }
    Host.prototype = new Socket();
    // send message to established connections
    Host.prototype.emit = function (recipients) {
      var
        host = this,
        customArray = isArray(recipients),
        conns = customArray ? recipients : Host_getConnections(host),
        args = arguments,
        connIdx = 0,
        connLn = conns.length,
        conn,
        totalConns = conns.length
      ;

      if (customArray) {
        args = protoSlice.call(args, 1);
      }

      for (; connIdx < connLn; ++connIdx) {
        conn = conns[connIdx];
        conn.send.apply(conn, args);
      }

      return host;
    };

    function Host_getPendingConnections(host) {
      var
        hostId = host.id,
        pendingId,
        allPendingConnections = subpost.conns,
        pendingConns = allPendingConnections[host.id],
        clientConn,
        hostConnections = host.conns
      ;
      if (pendingConns) {
        // clear queue of pending connections for this host
        allPendingConnections[host.id] = 0;
        for (pendingId in pendingConns) {
          if (pendingConns.hasOwnProperty(pendingId) && !hostConnections.hasOwnProperty(pendingId)) {
            clientConn = pendingConns[pendingId];
            // set host for this client connection
            clientConn.sox = host;
            // save and announce new client, if we can send a "connect" message
            if (sendMessage(clientConn, STR_CONNECT)) {
              // save connection in host
              hostConnections[pendingId] = clientConn;
              host.fire(STR_EVENT_PREFIX + STR_CONNECT, clientConn);
            }
          }
        }
      }
      return host;
    }

    // returns an array of host connections
    function Host_getConnections(host, excludeId) {
      var
        ary = [],
        conns = host.conns,
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
    Client.prototype = new Socket();
    mix(Client.prototype, {
      open: function (winRef) {
        var
          client = this,
          hostConn = client.conns[client.hostId],
          pingIntervalFn,
          win = isFullString(winRef) ? window.open('', winRef) : winRef
        ;

        // end any current connection
        client.close();

        // ping the window
        if (win && !win.closed) {
          // allow this client to handle incoming messages
          subpost.clients[client.id] = client;

          // update state
          hostConn.win = win;
          client.state = 1;
          client.fire(STR_STATE_CHANGE_EVENT, 1, 0);

          // ping window periodically
          pingIntervalFn = function () {
            // close if we can't ping the window
            if (!sendMessage(hostConn, STR_PING)) {
              client.close();
            }
          };
          client.open_intv = setInterval(pingIntervalFn, subpost.config.pingInterval);
          // do first run asap, since interval could be long
          next(pingIntervalFn);
        }

        return client;
      },
      close: function () {
        var
          client = this,
          lastState = client.state,
          hostConn = client.conns[client.hostId]
        ;

        // if this client is active...
        if (lastState) {

          // remove client (if already connected)
          delete subpost.clients[client.id];
          // stop client from pinging (if connecting)
          Client_stopPing(client);

          // kill existing connection
          if (hostConn.win) {
            sendMessage(hostConn, STR_DISCONNECT);
          }
          // reset connection members
          client.state =
          hostConn.win =
            0;
          next(function () {
            client.fire(STR_STATE_CHANGE_EVENT, 0, lastState);
            client.fire(STR_EVENT_PREFIX + STR_DISCONNECT, hostConn);
          });
        }

        return client;
      },
      send: function () {
        var
          client = this,
          hostConn = client.conns[client.hostId]
        ;

        if (client.state === 3) {
          // return the message id or false
          return hostConn.send.apply(hostConn, arguments) || false;
        }
        return false;
      }
    });


    function ClientEvent(conn, postMessageEvent, eventData) {
      var
        evt = this,
        userEvent,
        parentEvent
      ;
      if (conn) {
        userEvent = eventData.data;
        mix(evt, {
          conn: conn,
          from: conn.id,
          to: conn.sox.id,
          event: {
            sent: (autoEncodeJSON) ? userEvent.sent : new Date(userEvent.sent),
            received: new Date(postMessageEvent.timeStamp),
            url: userEvent.url,
            native: postMessageEvent
          },
          type: userEvent.type,
          params: userEvent.params,
          id: eventData.id,
          replies: []
        });
        parentEvent = evt.parent = userEvent.parent;
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
        evt._copy = obj = {
          id: evt.id,
          from: evt.from,
          to: evt.to,
          type: evt.type,
          params: evt.params,
          event: {
            sent: evt.event.sent,
            received: evt.event.received,
            url: evt.event.url
          },
          replies: evt.replies
        };
        if (evt.parent) {
          obj.parentId = evt.parent.id;
        }
      }

      return evt._copy;
    }

    function Client_stopPing(client) {
      clearInterval(client.open_intv);
      client.open_intv = 0;
    }

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

    return subpost;

  }

  // initialize and expose Flow, based on the environment
  if (inAMD) {
    define(initSubPost);
  } else if (inCJS) {
    module.exports = initSubPost();
  } else if (!scope.subpost) {
    scope.subpost = initSubPost();
  }
}(
  typeof define == 'function',
  typeof exports != 'undefined',
  Array, Date, Error, Math, JSON, this
);