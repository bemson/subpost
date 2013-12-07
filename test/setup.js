var
  sinon = require('sinon'),
  chai = require('chai'),
  sinonChai = require('sinon-chai'),
  Backbone = require('backbone'),
  messageEventSubscribers = []
;

chai.use(sinonChai);
chai.should();

global.window = global;
global.sinon = sinon;
global.expect = chai.expect;
global.Backbone = Backbone;

// simulate window#postMessage in nodejs

global.addEventListener = function (evt, callback) {
	if (!~messageEventSubscribers.indexOf(callback)) {
		messageEventSubscribers.push(callback);
	}
};

global.removeEventListener = function (evt, callback) {
	var callbackIdx = messageEventSubscribers.indexOf(callback);
	if (~callbackIdx) {
		messageEventSubscribers.splice(callbackIdx, 0);
	}
};

global.postMessage = function (data) {
	var evtObj = {
		data: data,
		origin: 'http://www.example.com',
		source: global,
		timestamp: new Date().getTime()
	};

	setImmediate(function () {
		messageEventSubscribers.forEach(function (callback) {
			callback(evtObj);
		});
	});
};

global.open = function () {};

// simulate window.location in nodejs

global.location = {
	hash: '',
	host: 'example.com',
	hostname: 'example.com',
	href: 'http://www.example.com',
	pathname: '',
	port: '',
	protocol: 'http:',
	search: ''
};

global.location.toString = function () {
	return 'http://www.example.com';
};

var subpost = require('../src/subpost');
global.subpost = subpost;
