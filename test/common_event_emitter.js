/*global wap, describe, it, expect, before, after, beforeEach, afterEach */
describe('Event Emitter', function () {

  it('should expose the same methods to hosts and clients', function () {
    var
      host = subpost.host('someAppId'),
      client = subpost.client(host.id)
    ;
    host.on.should.equal(client.on);
    host.off.should.equal(client.off);
    host.fire.should.equal(client.fire);

    // clean up host creation
    subpost.hosts = {};
  });

  describe('method', function () {

    var host;

    beforeEach(function () {
      host = subpost.client('someAppId');
    });

    describe('#on()', function () {

      it('should be monadic', function () {
        host.on().should.equal(host);
      });

      it('should bind callbacks to a given event', function () {
        var
          spyFoo = sinon.spy(),
          spyBar = sinon.spy()
        ;
        host
          .on('foo', spyFoo)
          .on('bar', spyBar)
          .fire('foo')
          .fire('bar')
        ;
        spyFoo.should.have.been.calledOnce;
        spyBar.should.have.been.calledOnce;
      });

      it('should invoke binds in the order they were added', function () {
        var
          spy1 = sinon.spy(),
          spy2 = sinon.spy()
        ;
        host
          .on('foo', spy2)
          .on('foo', spy1)
          .fire('foo')
        ;
        spy2.should.have.been.calledBefore(spy1);
      });

      it('should scope executions to the base object', function () {
        var spy = sinon.spy();
        host
          .on('event', spy)
          .fire('event')
        ;
        spy.should.have.been.calledOn(host);
      });

      it('should use the third argument as the callback scope', function () {
        var
          scope = {},
          spy = sinon.spy()
        ;
        host
          .on('event', spy, scope)
          .fire('event')
        ;
        spy.should.have.been.calledOn(scope);
      });

    });

    describe('#off()', function () {

      it('should be monadic', function () {
        host.off().should.equal(host);
      });

      it('should remove a bind with the same event, callback, and scope', function () {
        var
          spyA = sinon.spy(),
          spyB = sinon.spy(),
          someEvent = 'event',
          scope = {}
        ;
        host
          .on(someEvent, spyA)
          .on(someEvent, spyB, scope)
          .off(someEvent, spyA)
          .off(someEvent, spyB)
          .fire(someEvent)
          .off(someEvent, spyB, scope)
          .fire(someEvent)
        ;
        spyA.should.not.have.been.called;
        spyB.should.have.been.calledOnce;
      });

      it('should remove all binds when invoked with no arguments', function () {
        var spy = sinon.spy();
        host
          .on('foo', spy)
          .on('bar', spy)
          .on('baz', spy)
          .on('zee', spy)
          .off()
          .fire('foo')
          .fire('bar')
          .fire('baz')
          .fire('zee')
        ;
        spy.should.not.have.been.called;        
      });

      it('should remove all binds of an event when the callback is omitted', function () {
        var
          spyA = sinon.spy(),
          spyB = sinon.spy(),
          someEvent = 'event',
          scope = {}
        ;
        host
          .on(someEvent, spyA)
          .on(someEvent, spyB, scope)
          .off(someEvent)
          .fire(someEvent)
        ;
        spyA.should.not.have.been.called;
        spyB.should.not.have.been.called;
      });

    });

    describe('#fire()', function () {

      it('should be monadic', function () {
        host.fire().should.equal(host);
      });

      it('should execute binds for the given event', function () {
        var
          spy = sinon.spy(),
          someEvent = 'foo'
        ;

        host
          .on(someEvent, spy)
          .fire(someEvent)
        ;
        spy.should.have.been.calledOnce;
      });

      it('should pass-thru additional arguments to callbacks', function () {
        var
          spy = sinon.spy(),
          someEvent = 'foo',
          arg0 = {},
          arg1 = {}
        ;

        host
          .on(someEvent, spy)
          .fire(someEvent, arg0, arg1)
        ;
        spy.getCall(0).args[0].should.equal(arg0);
        spy.getCall(0).args[1].should.equal(arg1);
      });

    });

  });

  describe('substitution', function () {
    var
      emitterFn = subpost.config.emitterFn,
      origMethods = {},
      host = subpost.client('someAppId')
    ;

    beforeEach(function () {
      var methodName;
      for (methodName in emitterFn) {
        if (emitterFn.hasOwnProperty(methodName)) {
          origMethods[methodName] = emitterFn[methodName];
        }
      }
    });

    afterEach(function () {
      var methodName;
      for (methodName in emitterFn) {
        if (emitterFn.hasOwnProperty(methodName)) {
          delete emitterFn[methodName];
        }
      }
      for (methodName in origMethods) {
        if (origMethods.hasOwnProperty(methodName)) {
          emitterFn[methodName] = origMethods[methodName];
        }
      }
    });

    it('should work with Backbone', function () {
      var
        prop,
        someEvent = 'foo',
        spy = sinon.spy(),
        scope = {},
        arg = {}
      ;


      // rig with backbone
      for (prop in Backbone.Events) {
        if (Backbone.Events.hasOwnProperty(prop)) {
          emitterFn[prop] = Backbone.Events[prop];
        }
      }
      emitterFn.fire = emitterFn.trigger;

      // invoke backbone subscriber method
      host.once(someEvent, spy, scope);

      host.fire(someEvent, arg);
      host.fire(someEvent, arg);

      spy.should.have.been.calledOnce;
      spy.should.have.been.calledOn(scope);
      spy.should.have.been.calledWith(arg);
    });

  });

});
