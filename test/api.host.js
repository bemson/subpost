/*global subpost. WINDOW, describe, it, expect, before, after, beforeEach, afterEach */
describe('Host', function () {

  var
    hostId = 'foo',
    host,
    client
  ;

  before(function (done) {
    host = subpost.host(hostId);
    client = subpost.client(hostId, window);
    client.on('::connect', function () {
      client.off('::connect');
      done();
    });
  });

  afterEach(function () {
    client.off();
  });

  after(function (done) {
    client.on('::disconnect', function () {
      client.off('::disconnect');
      subpost.hosts = {};
      done();
    });
    client.close();
  });

  describe('method', function () {

    describe('#emit()', function () {

      var sendSpy;

      before(function () {
        sendSpy = sinon.spy(host.conns[client.id], 'send');
      });

      after(function () {
        sendSpy.restore();
      });

      afterEach(function () {
        sendSpy.reset();
      });

      it('should be monadic', function () {
        host.emit().should.equal(host);
      });

      it('should invoke #send() on all given connections', function () {
        host.emit('foo', 1, 2, 3);
        sendSpy.should.have.been.calledWith('foo', 1, 2, 3);
      });

      it('should accept an array of connections as the first argument', function () {
        var mockConn = {send:sinon.spy()};

        host.emit([mockConn], 'bar', 1, 2);

        mockConn.send.should.have.been.calledWith('bar', 1, 2);
      });

      it('should execute connections in the order they are given', function () {
        var
          mockConnA = {send: sinon.spy()},
          mockConnB = {send: sinon.spy()}
        ;

        host.emit([mockConnA, mockConnB], 'foo');
        mockConnB.send.should.have.been.called;
        mockConnA.send.should.have.been.calledBefore(mockConnB.send);
      });

    });

  });

  describe('property', function () {

    describe('.id', function () {

      it('should match the string given to subpost#host()', function () {
        subpost.host(hostId).id.should.equal(hostId);
      });

    });

    describe('.conns', function () {

      it('should be an object', function () {
        host.conns.should.be.an('object');
      });

      it('should list connected clients by id', function () {
        host.conns.should.haveOwnProperty(client.id);
      });

    });

  });

});