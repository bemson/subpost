/*global wap, WINDOW, describe, it, expect, before, after, beforeEach, afterEach */
describe('Client', function () {

  var
    hostId = 'myApp',
    host,
    client
  ;

  before(function () {
    host = subpost.host(hostId);
  });

  beforeEach(function () {
    client = subpost.client(hostId);
  });

  afterEach(function (done) {
    host.off();
    client.off();
    if (client.state) {
      client.close();
      client.on('::disconnect', function () {
        client.off();
        done();
      });
    } else {
      done();
    }
  });

  after(function () {
    subpost.hosts = {};
  });

  describe('property', function () {

    describe('.id', function () {

      it('should be a uuid string', function () {
        subpost.client(hostId).id.should.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });

    });

    describe('.hostId', function () {

      it('should match the string passed to subpost#client()', function () {
        subpost.client(hostId).hostId.should.equal(hostId);
      });

    });

    describe('.state', function () {

      it('should be 0 initially', function () {
        subpost.client(hostId).state.should.equal(0);
      });

    });

  });
/*
  describe('first connection', function () {

    var firstConnection

    it('should reference the client connection by application name', function () {
      client.app.id.should.equal(hostId);
      client.conns.should.haveOwnProperty(hostId);
    });

    it('should contain app meta data after connecting', function (done) {
      var appMeta = {foo: 'bar', bo: {pop: 'lock'}};
      app.meta = appMeta;
      client
        .open(window)
        .on('connect', function (eventName, appConn) {
          appConn.meta.should.eql(appMeta);
          done();
        });
    });

    it('should list app types after connecting', function (done) {
      app.types = {
        flip: 1,
        flop: 2,
        abc: 3
      };
      client
        .open(window)
        .on('connect', function (eventName, appConn) {
          var sortedTypes = Object.keys(app.types);
          sortedTypes.sort();
          appConn.types.should.eql(sortedTypes);
          done();
        });
    });

  });

*/

  describe('method', function () {

    describe('#open()', function () {

      it('should be monadic', function () {
        client.open().should.equal(client);
      });

      it('should establish a link to a host in the given window', function (done) {
        var tested = false;
        client.open(window);

        host.on('::connect', function (clientConnection) {
          tested = true;
          clientConnection.id.should.equal(client.id);
        });

        client.on('::connect', function () {
          tested.should.be.ok;
          done();
        });
      });

      it('should attempt opening the given window name', function () {
        var
          windowOpenSpy = sinon.stub(window, 'open'),
          winName = 'someWindowName'
        ;

        client.open(winName);

        windowOpenSpy.should.have.been.calledWith('', winName);
        windowOpenSpy.restore();
      });

      it('should execute asynchronously', function (done) {
        var
          synchronousCall = sinon.spy(),
          postMessageSpy = sinon.stub(window, 'postMessage')
        ;

        client.open(window);
        synchronousCall();

        setTimeout(function () {
          synchronousCall.should.have.been.calledBefore(postMessageSpy);
          postMessageSpy.restore();
          done();
        }, 15);
      });

      it('should close an existing connection', function (done) {
        var hostDroppedClient = false;

        client.open(window);

        client.on('::connect', function () {
          client.off();
          client.open(window);
          client.on('::connect', function () {
            hostDroppedClient.should.be.ok;
            done();
          });
        });

        host.on('::disconnect', function () {
          host.off();
          hostDroppedClient = true;
        });
      });

    });

    describe('#close()', function () {

      it('should be monadic', function () {
        client.close().should.equal(client);
      });

      it('should remove a connected client', function (done) {
        subpost.clients.should.not.haveOwnProperty(client.id);
        client
          .open(window)
          .on('::connect', function () {
            subpost.clients.should.haveOwnProperty(client.id);

            client.close();
            client.on('::disconnect', function () {
              subpost.clients.should.not.haveOwnProperty(client.id);
              done();
            });
          });
      });

      it('should abort a connecting client', function (done) {
        var
          mockWindow = {postMessage: sinon.spy()},
          originalIntervalValue = subpost.config.openInterval
        ;
        subpost.config.openInterval = 10;
        client.open(window);

        setTimeout(function () {
          var pings = mockWindow.postMessage.callCount;
          client.close();

          setTimeout(function () {
            mockWindow.postMessage.callCount.should.equal(pings);

            subpost.config.openInterval = originalIntervalValue;
            done();
          }, 40);

        }, 40);
      });

      it('should send "disconnect" message if called after connection is established', function (done) {
        var postSpy = sinon.spy(window, 'postMessage');

        client
          .open(window)
          .on('::connect', function () {
            client.close();
            postSpy.lastCall.args[0].type.should.equal('disconnect');
            postSpy.restore();
            done();
          });
      });

    });

    describe('#send()', function () {

      it('should return the id of the sent message', function (done) {
        client
          .open(window)
          .on('::connect', function () {
            client.send('foo')
              .should.be.a('string')
              .and.have.length.above(0);
            done();
          });
      });


      it('should return false until connected', function (done) {
        client.send('blah').should.be.false;
        client
          .open(window)
          .on('::connect', function () {
            client.send('blah').should.not.be.false;
            done();
          });
      });

    });

  });

});
