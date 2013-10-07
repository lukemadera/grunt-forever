- 0.4.2
	- date: 2013-10-06
	- changes
		- stop and restart by uid (more specific than just index/file, which could stop/restart multiple processes)
			- support searching by options as well as just file/index name to allow finer grained separation (i.e. between two processes that may have the same file/index but are different - i.e. different ports or other command options)
		- support passing in options for start

0.4.0:
  date: 2013-02-28
  changes:
    - Grunt 0.4.0 compliant.