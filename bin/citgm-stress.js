#!/usr/bin/env node
'use strict';
var update = require('../lib/update');
var citgm = require('../lib/citgm');
var logger = require('../lib/out');
var reporter = require('../lib/reporter');
var commonArgs = require('../lib/common-args');
var yargs = require('yargs');
var async = require('async');

var mod;
var script;

yargs = commonArgs(yargs)
  .usage('citgm [options] <module> [script]')
  .option('sha', {
    alias: 'c',
    type: 'string',
    description: 'Install module from commit-sha'
  })
  .option('repeat', {
    alias: 'r',
    type: 'number',
    description: 'set how many times to run the testsuite'
  });

var app = yargs.argv;

mod = app._[0];
script = app._[1];

var log = logger({
  level:app.verbose,
  nocolor: app.noColor
});

update(log);

if (!app.su) {
  require('root-check')(); // silently downgrade if running as root...
                           // unless --su is passed
} else {
  log.warn('root', 'Running as root! Use caution!');
}

if (!mod) {
  yargs.showHelp();
  process.exit(0);
}

var options = {
  script: script,
  lookup: app.lookup,
  nodedir: app.nodedir,
  testPath: app.testPath,
  level: app.verbose,
  npmLevel: app.npmLoglevel,
  timeoutLength: app.timeout,
  sha: app.sha,
  repeat: app.repeat
};
var i = 0;
if (!citgm.windows) {
  var uidnumber = require('uid-number');
  var uid = app.uid || process.getuid();
  var gid = app.gid || process.getgid();
  uidnumber(uid, gid, function(err, uid, gid) {
    options.uid = uid;
    options.gid = gid;
    async.whilst(function() {
    	return i < options.repeat;
    }, function(callback) {
    		launch(mod, options);
    		i++;
    		callback(null);
    }, function(error) {
    	console.log("YAY!");
    });
  });
} else {
  async.whilst(function() {
    return i < options.repeat;
  }, function(callback) {
      launch(mod, options);
      i++;
      callback(null);
  }, function(error) {
    console.log("Done!");
  });
}

function launch(mod, options) {
  var runner = citgm.Tester(mod, options);

  function cleanup() {
    runner.cleanup();
  }

  process.on('SIGINT', cleanup);
  process.on('SIGHUP', cleanup);
  process.on('SIGBREAK', cleanup);
  process.setMaxListeners(process.getMaxListeners() + options.repeat || process.getMaxListeners());

  runner.on('start', function(name) {
    log.info('starting', name);
  }).on('fail', function(err) {
    log.error('failure', err.message);
  }).on('data', function(type, key, message) {
    log[type](key, message);
  }).on('end', function(module) {
    reporter.logger(log, module);

    if (app.markdown) {
      reporter.markdown(log.bypass, module);
    }

    if (typeof app.tap === 'string') {
      var tap = (app.tap) ? app.tap : log.bypass;
      reporter.tap(tap, module, true);
    }

    if (typeof app.junit === 'string') {
      var junit = (app.junit) ? app.junit : log.bypass;
      reporter.junit(junit, module, true);
    }

    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGHUP', cleanup);
    process.removeListener('SIGBREAK', cleanup);
    process.setMaxListeners(process.getMaxListeners() - options.repeat || process.getMaxListeners());
    process.exit(module.error ? 1 : 0);
  }).run();
}
