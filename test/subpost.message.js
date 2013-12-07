/*global wap, WINDOW, describe, it, expect, before, after, beforeEach, afterEach */
describe.skip('Subpost message', function () {

  var
    hostId = 'myApp',
    host,
    client,
    hostMsg,
    hostMsgType = 'foo',
    hostMsgArgs = [1, '2', function () {}],
    hostMsgArgsJSON = JSON.stringify(hostMsgArgs),
    clientMsg,
    clientMsgType = 'bar',
    hostRsp,
    hostRspType = 'baz',
    rxp_uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    msgCallback = sinon.spy()
  ;

  before(function (done) {
    host = subpost.host(hostId)
      .on('::connect', function (sox) {
        sox.send.apply(sox, [hostMsgType].concat(hostMsgArgs));
      })
      .on(clientMsgType, function (msg) {
        clientMsg = msg;
        msg.reply(hostRspType);
      })
    ;
    client = subpost.client(hostId, window)
      .on(hostMsgType, function (msg) {
        hostMsg = msg;
        msg.reply(clientMsgType);
      })
      // .on(hostMsgType, msgCallback)
      .on(hostRspType, function (msg) {
        hostRsp = msg;
        done();
      });
  });

  after(function () {
    host.off();
    client.off();
    subpost.hosts = {};
    subpost.clients = {};
  });

  it('should be the first argument to callbacks');

  describe('basics', function () {

    var msg;

    before(function () {
      msg = hostMsg;
    });

    it('should have a type', function () {
      msg.should.haveOwnProperty('type');
      msg.type
        .should.be.a('string')
        .and.length.above(0);
    });

    it('should have a unique id', function () {
      msg.should.haveOwnProperty('id');
      msg.id
        .should.be.a('string')
        .and.match(rxp_uuid);
    });

    it('should include the sender and recipient ids', function () {
      msg
        .should.haveOwnProperty('to')
        .and.haveOwnProperty('from')
      ;
      // recipient is the client
      msg.to
        .should.be.a('string')
        .and.match(rxp_uuid)
        .and.equal(client.id)
      ;
      // sender is the host
      msg.from
        .should.be.a('string')
        .and.equal(host.id)
      ;
    });

  });

  describe('parameters', function () {

    var msg;

    before(function () {
      msg = hostMsg;
    });

    it('should be a collection of extra values passed with the message', function () {
      msgCallback.getCall(0).args.slice(1).should.eql(hostMs);
    });

    it('should match extra arguments passed to the callback', function () {
      msgCallback.getCall(0).args.slice(1).should.eql(msg.params);
    });

    it('should be sanitized as JSON values');

  });

  describe('meta-data', function () {

    it('should reference the native event');

    it('should describe when the message was sent and received');

    it('should provide the url of the sending window');

  });

  describe('responses', function () {

    it('should reference a sanitized version of the parent message');

    it('should contain the id of the parent to the parent message');

  });

});
