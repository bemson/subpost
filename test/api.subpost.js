/*global subpost, WINDOW, describe, it, expect, before, after, beforeEach, afterEach */
describe('SubPost', function () {

  var hostId = 'foo';

  describe('property', function () {

    describe('.version', function () {

      it('should be a string', function () {
        subpost.version.should.be.a('string');
      });

      it('should be numeric', function () {
        expect(parseInt(subpost.version)).to.be.a('number');
      });

    });


    describe('.hosts', function () {

      afterEach(function () {
        subpost.hosts = {};
      });

      it('should be an object member', function () {
        subpost.hosts.should.be.an('object');
      });

      it('should have no local members, by default', function () {
        var
          member,
          memberCount = 0
        ;
        for (member in subpost.hosts) {
          if (subpost.hosts.hasOwnProperty(member)) {
            memberCount++;
          }
        }
        memberCount.should.equal(0);
      });

      it('should reference hosts created via subpost#host', function () {
        var
          hostId = 'foo',
          host = subpost.host(hostId)
        ;
        expect(subpost.hosts[hostId]).to.equal(host);
      });

    });

    describe('.clients', function () {

      afterEach(function () {
        subpost.hosts = {};
        subpost.clients = {};
      });

      it('should be an object', function () {
        subpost.clients.should.be.an('object');
      });

      it('should only list connecting/opened sockets', function (done) {

        var client = subpost.client(hostId);

        subpost.host(hostId);

        subpost.clients.should.not.have.ownProperty(client.id);

        client.open(window);

        subpost.clients.should.have.ownProperty(client.id);
        subpost.clients[client.id].should.equal(client);

        client.on('::connect', function () {
          subpost.clients.should.have.ownProperty(client.id);
          subpost.clients[client.id].should.equal(client);
          done();
        });

      });

    });

    describe('.config', function () {

      it('should be an object', function () {
        subpost.config.should.be.an('object');
      });

      describe('.pingInterval', function () {

        var
          originalInterval,
          postSpy,
          client
        ;

        before(function () {
          originalInterval = subpost.config.pingInterval;
          client = subpost.client(Math.random().toString());
        });

        afterEach(function () {
          subpost.config.pingInterval = originalInterval;
        });

        it('should be a number', function () {
          subpost.config.pingInterval.should.be.a('number');
        });

        // excluding test from node because setInterval is not reliable
        if (typeof navigator !== 'undefined') {
          it('should determine the frequency with which a client pings a window', function (done) {
            var
              countAt15 = 0,
              postSpy = sinon.stub(window, 'postMessage');

            subpost.config.pingInterval = 15;
            client.open(window);

            setTimeout(function () {
              client.close();
              countAt15 = postSpy.callCount;
              postSpy.reset();

              subpost.config.pingInterval = 30;
              client.open(window);

              setTimeout(function () {
                client.close();

                postSpy.callCount.should.be.below(countAt15);
                postSpy.restore();

                done();
              }, 100);

            }, 100);

          });
        }

      });

      describe('.emitterFn', function () {

        it('should be the prototype for host and client instances', function () {
          var
            client = subpost.client('someAppId'),
            host = subpost.host('foo'),
            emitterFn = subpost.config.emitterFn
          ;

          expect(emitterFn).to.be.an('object');
          client.on.should.equal(emitterFn.on);
          host.on.should.equal(emitterFn.on);
        });

      });

    });

  });

  describe('method', function () {

    describe('#host()', function () {

      afterEach(function () {
        subpost.hosts = {};
      });

      it('should accomodate one argument', function () {
        subpost.host.should.have.lengthOf(1);
      });

      it('should return the same instance when given the same name', function () {
        subpost.host(hostId).should.equal(subpost.host(hostId));
      });

      it('should throw when the id is omitted', function () {
        expect(function () {subpost.host();}).to.throw(Error);
      });

      it('should throw when the id is not a string', function () {
        [0, 1, {}, [], true, false, null, undefined, function () {}].forEach(
          function (nonString) {
            expect(function () {subpost.host(nonString);}).to.throw(Error);
          }
        );
      });

      it('should throw when the id is an empty string', function () {
        expect(function () {subpost.host('');}).to.throw(Error);
      });

      it('should throw when the id is "hasOwnProperty"', function () {
        expect(function () {subpost.host('hasOwnProperty');}).to.throw(Error);
      });

      it('should throw when the id begins with "subpost:"', function () {
        expect(function () {subpost.host('::');}).to.throw(Error);
      });

      it('should set the instance id member to the given string', function () {
        subpost.host(hostId).id.should.equal(hostId);
      });

    });

    describe('#client()', function () {

      before(function () {
        subpost.host(hostId);
      });

      afterEach(function () {
        subpost.clients = {};
      });

      after(function () {
        subpost.hosts = {};
      });

      it('should accomodate two arguments', function () {
        subpost.client.should.have.lengthOf(2);
      });

      it('should return a new socket everytime', function () {
        subpost.client(hostId).should.not.equal(subpost.client(hostId));
      });

      it('should return a new socket for hosts that do not exist', function () {
        subpost.client(hostId).should.not.equal(subpost.client(hostId));
      });

      it('should invoke #open when the second argument is a window reference', function (done) {
        var
          client = subpost.client(hostId, window),
          openSpy = sinon.spy(client, 'open')
        ;
        setTimeout(function () {
          client.close();
          openSpy.should.have.been.calledOnce;
          done();
        }, 15);
      });

      it('should throw when the host name is invalid or missing', function () {
        expect(function () {subpost.client();}).to.throw(Error);
        ['', 1, {}, [], true, false, null, undefined, function () {}].forEach(
          function (arg) {
            expect(function () {subpost.client(arg);}).to.throw(Error);
          }
        );
      });

    });

  });

});
