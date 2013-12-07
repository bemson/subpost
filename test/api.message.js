/*global subpost, describe, it, expect, before, after, beforeEach, afterEach */
describe.skip('Message', function () {

  var
    hostId = 'myApp',
    host,
    client,
    rxp_uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  ;

  before(function (done) {
    host = subpost.host(hostId);
    client = subpost.client(hostId, window);
    client.on('::connect', function () {
      client.off();
      done();
    });
  });

  after(function (done) {
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
    subpost.hosts = {};
  });

  describe('property', function () {

    describe('.id', function () {

      it('should be a uuid', function () {
        msg.id.should.match(rxp_uuid);
      });

    });

    describe('.from', function () {

      it('should point to the sender id', function () {
        msg.from.should.match(rxp_uuid);
      });

    });


    describe('.to', function () {

      it('should reference the recipient id', function () {
        hostMsg.to.should.equal(client.id);
      });

    });

    describe('.params', function () {

      it('')

    });

    describe('.type', function () {

      it('should be a string', function () {
        hostMsg.type.should.be.a('string');
      });

    });

    describe('.event', function () {

      it('should be an object');

      it('should detail when the message was sent');

      it('should detail when the message was received');

      it('should provide the url of the sending window');

      it('should reference the native event', function () {
        msg.event.native
          .should.be.ok
          .and.be.an('object')
          .and.haveOwnPropety('origin');
      });

    });

    describe('.parent', function () {

      it('should be null when there is no parent');

      it('should contain the parent message');



    });

  });

  describe('API', function () {

    describe('#reply()', function () {

      it('should send origial message');

    });

  });

});