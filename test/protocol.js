/*global wap, describe, it, expect, before, after, beforeEach, afterEach */
describe('Protocol', function () {

  var
    hostId = 'foo',
    host,
    client
  ;

  before(function () {
    host = subpost.host(hostId);
  });

  beforeEach(function () {
    host.conns = {};
    if (client) {
      client.close();
    }
  });

  after(function () {
    subpost.hosts = {};
    subpost.clients = {};
  });

  describe('handshake', function () {

    it('should start with client pinging host', function () {

    });

    it('should require ')

    it('should be observable')

    it('should start with ping to host from client');

  });

  describe('', function () {

  });

  describe('message', function () {

  });

  describe('ping', function () {

    it('should be sent from the client to the host');

    it('should repeat until window closes');

    it('should persist until client is closed');

    describe('payload', function () {

      it('should list expected event types');

    });

  });

  describe('pong', function () {

    it('should be sent from host in response to client ping');

    it('should stop the client from pinging the host');

    it('should cause the client to trigger a "connect" event');

    describe('payload', function () {

      it('should list expected event types');

      it('should provide clone of host .meta member');

    });

  });

  describe('pong-ack', function () {

    it('should be sent from client to host, in response to pong');

    it('should cause the host to trigger a "connect" event');

    describe('payload', function () {

    });

  });

});
