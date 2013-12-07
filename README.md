# SubPost

PubSub over postMessage

(12/7/13)
version 0.1.0
by Bemi Faison


## Description

SubPost makes sharing data between windows easier than using postMessage alone. SubPost offers a familiar publish-subscribe API, to abstract message routing, and supplements origin-based security with a simple client/host model.

Below demonstrates how subpost works between windows.

```js
// code in host window, named "mashup"
var rssHost = subpost.host('rss');
rssHost
  .on('::connect', function (client) {
    client.send('news', 'hello', 'world!');
  })
  .on('my other event', function (msg) {
    console.log(msg.params);
  })
;

// code in client window
var rssClient = subpost.client('mashup', 'rss');
rssClient.on('news', function (msg, param1, param2) {
  console.log(param1, param2);
  msg.reply('my other event', ['some', 'data'], 'arbitrary params');
});
```

## Install

Load SubPost as you would any external JavaScript library. The code works within AMD and CJS environments, and adds "subpost" to the global namespace - when loaded via a standard `SCRIPT` tag.


## Usage

SubPost implements a minimal client/host network, between applications, in one or more windows. Once connected, the client or host may send and listen for custom messages, and/or monitor network events.

Messages are similar to the custom events you might find in many event frameworks, but provide an enhanced API for responding to and identifying the sender. Network events are subscribable, just like messages, but have a double-colon prefix ("::") and do not use the standard message signature.


### Define a host

The "host" object is equivalent to an event publisher. To resolve a host object, pass a unique name to `subpost.host()`. This static method accesses a simple, window-level, registry of host objects - i.e., passing the same name returns the same host object.

```js
var fooHost = subpost.host('foo');
```

#### Broadcast messages

You may immediately broadcast messages to all connected clients using `host.emit()`. This is equivalent to invoking the `.fire()` or `.trigger()` method of popular event libraries. After the arbitrary "type", any additional arguments are passed to subscribed clients. (All arguments must be JSON friendly, or your results may vary - i.e., no functions or non-core object types).

```js
fooHost.emit('greeting', 'hello world!', {some: 'data'});
```

#### Message individual clients

Connected clients are available in the host object's `host.conns` member. Use their `connection.send()` method to send individual messages to a connected client.

```js
fooHost.conns['someClientId'].send('privateMessage', 'just', 'for', 'you');
```


### Define a client

The "client" is equivalent to an event subscriber. Instantiate a client with `subpost.client()`, passing it the host's name (at least), and a reference or name of the window containing the host. (No instances, returned by this static method, are the same.)

```js
var fooClient = subpost.client('foo', 'windowName');
```

#### Message the host

Once connected, a client can communicate with it's host using `client.send()`. Just like `host.emit()`, pass in an arbitrary message type (at least), and any additional arguments. The message recipient will be the client's host, and the method does nothing until a connection is established.

```js
fooClient.send('ping', 'from: ' + fooClient.id);
```

### Handling Network Events

Both host and client objects may subscribe to network events, like when a connection begins or ends. Below lists the salient network events available to both hosts and clients.

  * **::connect** Available to both clients and hosts, the callback can expect a single _connection_ object.
  * **::disconnect** Available to both clients and hosts, the callback can expect a single _connection_ object.


### Handling Messages

Callbacks to message subscriptions will receive at least one argument, the _message_ object. The content of a message - that is, what was sent by the sender - is available in the `message.type` and `message.params` members. The latter is always an array, listing the additional arguments sent with the message. The remaining members of the message object, provide meta-information, like the sender's id, timestamps, and the native postMessage event.

The message object also features a `message.reply()` method to conveniently respond directly to the sender. The method takes the same arguments as `client.send()` or `host.emit()` - an arbitrary type and additional parameters.


## Requirements & Compatability

SubPost depends on the following features:

  * postMessage [(compatible browsers)](http://caniuse.com/#search=postmessage)
  * JSON [(compatible browsers)](http://caniuse.com/#search=json)

Of note, IE 8 and 9 have limited postMessage capabilities.

Be sure to emulate and expose these requirements, if you plan to use SubPost within an unsupported/limited browser agent. For example, there are JSON shims available online.


### Consider security

When processing external commands, **do** consider application security. Generally speaking, your logic should only use _your_ application state/logic, versus the incoming message. (i.e., "Should my application do this now?")

Remember that SubPost messages expose comprehensive information about the sending window, such as the current url, page title, etc. Should you need to enforce origin-based security, you may access the native postMessage object at `message.event.native`.