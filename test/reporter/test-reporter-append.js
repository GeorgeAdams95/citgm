'use strict';
var test = require('tap').test;

var reporter = require('../../lib/reporter');

test('reporter.tap(tap, module, true):', function (t) {
  t.ok(reporter.tap, 'you should be able to append');
  t.equals(typeof reporter.markdown, 'function', 'tap is a function');
  t.end();
});
