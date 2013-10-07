console.log('v13');
var forever     = require('forever'),
    path        = require('path'),
    logDir      = path.join(process.cwd(), '/forever'),
    logFile     = path.join(logDir, '/out.log'),
    errFile     = path.join(logDir, '/err.log'),
	foreverOpts = [],
	paramsMatch = {},
    commandName = 'node',
    commandMap  = {
      start:      startForeverWithIndex,
      stop:       stopOnProcess,
      restart:    restartOnProcess
    },
    done, gruntRef;

/**
 * Logs message to console using log.writeln() from grunt.
 * @param  {String} message Message to print with log formatting.
 */
function log( message ) {
  gruntRef.log.writeln( message );
}
/**
 * Logs message to console using warn() from grunt.
 * @param  {String} message Message to print with warn formatting.
 */
function warn( message ) {
  gruntRef.warn( message );
}
/**
 * Logs message to console using log.error() and raises error from grunt.
 * @param  {String} message Message to print in error formatting.
 */
function error( message ) {
  gruntRef.log.error( message ).error();
}
/**
 * Pretty prints supplied object in JSON notation using grunt logging.
 * @param  {String} id     String description of object
 * @param  {Object} object Generic Object to be JSON-ified.
 */
function prettyPrint( id, object ) {
  log(id + ' : ' + JSON.stringify(object, null, 2));
}
/**
 * Locates running process previously started by forever based on index file, and notifies callback. Will notify of undefined if not found, other wise the unformatted process object.
 * @param  {String}   index    Index filename.
 @param {Object} params Additional parameters for identifying the process (in case have multiple with the same index / command)
	@param {Array} optionsMatch Array of options to search through to try to match; each is a string
 * @param  {Function} callback Delegate method to invoke with either the found process object or undefined if not found.
 */
// function findProcessWithIndex( index, params, callback ) {
function findProcessWithIndex( index, callback ) {
	//NOTE: apparently `console.log` can't be used here or it breaks things!? wtf??
	// console.log('paramsMatch: '+JSON.stringify(paramsMatch));
	// var params =paramsMatch;
	/*
	if(params ===undefined || !params) {
		// console.log('no params or params undefined');
		params ={};
	}
	*/
  var i, jj, kk, process, uid =false;
  try {
    forever.list(false, function(context, list) {
      i = list ? list.length : 0;
      while( --i > -1 ) {
        process = list[i];
        if( process.hasOwnProperty('file') &&
          process.file === index ) {
			if(params.optionsMatch !==undefined) {
				if(process.hasOwnProperty('options')) {
					for(jj =0; jj<process.options.length; jj++) {
						for(kk =0; kk<params.optionsMatch.length; kk++) {
							if(process.options[jj].indexOf(params.optionsMatch[kk]) >-1) {
								if(process.hasOwnProperty('uid')) {
									uid =process.uid;
								}
								break;
							}
						}
					}
				}
			}
			else {	//if no options to check, match on file is good enough
				if(process.hasOwnProperty('uid')) {
					uid =process.uid;
				}
				break;
			}
			// if(process.hasOwnProperty('uid')) {
				// uid =process.uid;
			// }
			// break;
        }
        process = undefined;
      }

      callback.call(null, process, uid);
    });
  }
  catch( e ) {
    error( 'Error in trying to find process ' + index + ' in forever. [REASON] :: ' + e.message );
    callback.call(null, undefined, uid);
  }
}
/**
 * Attempts to start process using the index file.
 * @param  {String} index Filename.
 */
function startForeverWithIndex( index ) {
  log( 'Attempting to start ' + index + ' as daemon.');

  done = this.async();
  // findProcessWithIndex( index, function(process, uid) {
  findProcessWithIndex( index, function(process) {
    // if found, be on our way without failing.
    if( typeof process !== 'undefined' ) {
      // warn( index + ' is already running.');
	  log( index + ' is already running.');		//not necessarily an error so don't want to abort
      log( forever.format(true, [process]) );
      done();
    }
    else {
      gruntRef.file.mkdir(logDir);
      // 'forever start -o out.log -e err.log -c node -a -m 3 index.js';
      forever.startDaemon( index, {
        errFile: errFile,
        outFile: logFile,
        command: commandName,
        append: true,
        max: 3,
		options: foreverOpts
      })
		.on('start', function() {
			done();
		})
		.on('error', function(message) {
			error( 'Error starting ' + index + '. [REASON] :: ' + message );
			done(false);
		})
	  ;
      log( 'Logs can be found at ' + logDir + '.' );
      // done();		//async so don't complete until it actually starts (or errors) - this created a bug where it would complete before forever was actually started sometimes - it was sporadic since it was due to timing so was a hard error to track down!
    }
  });
}
/**
 * Attempts to stop a process previously started associated with index.
 * @param  {String} index Filename associated with previously started process.
 */
function stopOnProcess(index) {
  log( 'Attempting to stop ' + index + '...' );

  done = this.async();
  findProcessWithIndex( index, function(process, uid) {
  // findProcessWithIndex( index, function(process) {
	if( typeof process !== 'undefined' && uid ) {
    // if( typeof process !== 'undefined' ) {
      log( forever.format(true,[process]) );

	  forever.stop( uid )		//more specific
      // forever.stop( index )
        .on('stop', function() {
          done();
        })
        .on('error', function(message) {
			error( 'Error stopping uid: ' + uid + 'index: ' + index + '. [REASON] :: ' + message );
          // error( 'Error stopping ' + index + '. [REASON] :: ' + message );
          done(false);
        });
    }
    else {
		log('yes');
		if(typeof process !== 'undefined') {
			log( forever.format(true, [process]) );
		}
		else {
			log('forever process undefined');
		}
		gruntRef.warn( index + ' not found in list of processes in forever.' );
		done();
    }
  });
}
/**
 * Attempts to stop and restart a process previously started associated with index. If no process found as previously started, just starts a new one.
 * @param  {String} index Filename associated with previously started process.
 */
function restartOnProcess( index ) {
  log( 'Attempting to restart ' + index + '...' );

  // generate delegate function to pass with proper contexts.
  var startRequest = (function(context, index) {
    return function() {
        startForeverWithIndex.call(context, index);
    };
  }(this, index));

  done = this.async();
  findProcessWithIndex( index, function(process, uid) {
  // findProcessWithIndex( index, function(process) {
	if(typeof process !== 'undefined' && uid) {
    // if(typeof process !== 'undefined') {
      log(forever.format(true,[process]));

	  forever.restart(uid)		//more specific
      // forever.restart( index)
        .on('error', function(message) {
			error('Error restarting uid: '+uid+' index: ' + index + '. [REASON] :: ' + message);
          // error('Error restarting ' + index + '. [REASON] :: ' + message);
          done(false);
        })
		.on('restart', function() {
			done();
		})
		;
      // done();		//do NOT do this - async so need to WAIT and listen for restart to actually fire first!
    }
    else {
      log(index + ' not found in list of processes in forever. Starting new instance...');
      startRequest();
      // done();		//do NOT do this - start will call done when it's done!
    }
  });
}

/**
 * grunt-future task
 * @param  {Object} grunt Grunt
 */
module.exports = function(grunt) {

  gruntRef = grunt;
  grunt.registerTask( 'forever', 'Starts node app as a daemon.', function(target) {

      var index = this.options().index || 'index.js',
          operation = target;

      commandName = this.options().command;
      if (this.options().logDir) {
        logDir  = path.join(process.cwd(), this.options().logDir) || logDir;
        logFile = path.join(logDir, this.options().logFile || 'out.log');
        errFile = path.join(logDir, this.options().errFile || 'err.log');
      }
	  
		foreverOpts =this.options().options || [];
		paramsMatch =this.options().paramsMatch || {};
		//default to match passed in options (if they exist)
		if(paramsMatch.optionsMatch ===undefined) {
			paramsMatch.optionsMatch =foreverOpts;
		}

      try {
        if(commandMap.hasOwnProperty(operation)) {
          commandMap[operation].call(this, index);
        }
        else {
          warn('Operation ' + operation + ' is not supported currently. Only forever:start, forever:stop or forever:restart.');
        }
      }
      catch(e) {
          error('Exception thrown in attempt to ' + operation + ' on ' + index + ': ' + e);
      }
  });
};