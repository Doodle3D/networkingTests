//http://10.0.0.144:8080/debug?port=5858

/*notes:
 * - async module import in wifi.js
 * - in wifi.js rename 'wifi' to 'WiFi'
 */

var ConnMan = require('jsdx-connman');
var async = require('async');
var Q = require('q');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var ps = require('ps-node');

//from: http://stackoverflow.com/questions/8556777/dbus-php-unable-to-launch-dbus-daemon-without-display-for-x11
process.env.DISPLAY = ':0';
process.env.DBUS_SESSION_BUS_ADDRESS = 'unix:path=/run/dbus/system_bus_socket';

var connman = new ConnMan();

connman.init(function() {

	enableHotspot(function(err, res) {
		if(!err) {
			console.log('RES: ' + res);

			console.log('timeout...');
			setTimeout(test, 10000, function(err, res) {
				if(!err) {
					console.log('test() res');
				}
			});
		} else {
			console.log('ERR: ' + err);
		}
	})

	function test(callback) {
		getAccesspoints(function(err, list) {
			if(!err) {
				for (var index in list) {
					var ap = list[index];
					var name = String((ap.Name ? ap.Name : '*hidden*'));
					console.log('  ' + name, '  \t\t\t Strength: ' + ap.Strength + '%', '  \t\t\t Security: ' + ap.Security);
				}

				disableHotspot(function(err,res) {
					if(!err) { 
						console.log("res: " + res);
					}

					connectToAccesspoint('Doodle3D-wisp', '', function(err, res) {
					if(!err) {
						console.log('callback res: ' + res);

						console.log('timeout to disconnect...')
						setTimeout(disconnectFromAccesspoint, 10000, 'Doodle3D-wisp', function(err, res) {
							if(!err) {
								console.log("res: " + res);
							} else {
								console.log("err: " + err);
							}
						});
						} else {
							console.log('ERR ' + err);
						}
					})
				})
			} else {
				console.log("error: " + err);
			}
		})
	};	
});

enableHotspot = function(cb) {
	/* NOTE
	 * http://serverfault.com/questions/480812/privileges-for-ifconfig
	 * You do not need root access to use ifconfig to change IP addresses, only CAP_NET_ADMIN.
	 * $cp /sbin/ifconfig .
	 * $sudo setcap cap_net_admin=eip ./ifconfig
	 * $./ifconfig eth0 1.2.3.4    # succeeds
	 */

	var wlanId = 'wlan0';

	async.series
    ([  
        function (callback) {
            console.log('bring '+wlanId+' up...');
            //note: ./ifconfigUser is local copy of ifconfig with previleges
            var child = exec('./ifconfigUser '+wlanId+' up');
			child.stdout.on('data', function(data) { 
				console.log('stdout: ' + data); 
			})
			child.stderr.on('data', function(data) { 
				console.log('stdout: ' + data); 
			})
			child.on('close', function(code) {
				callback();
			})
        }
        ,
        function (callback) {
            console.log('set '+wlanId+' ip...');
            var child = exec('./ifconfigUser '+wlanId+' 192.168.1.1');
			child.stdout.on('data', function(data) { 
				console.log('stdout: ' + data); 
			})
			child.stderr.on('data', function(data) { 
				console.log('stdout: ' + data); 
			})
			child.on('close', function(code) {
				callback();
			})
        }
        ,
        /* NOTE: dnsmasq is started at boot */
   //     	,
   //      function (callback) {
   //      	//TODO: FIRST KILL DNSMASQ BY PS AUX | GREP DNSMASQ , KILL <PID>
   //          console.log("dnsmasq start...");
   //          var child = exec('dnsmasq -i '+wlanId+' -F 192.168.1.100,192.168.1.200,12h');
			// child.stdout.on('data', function(data) { 
			// 	console.log('stdout: ' + data); 
			// })
			// child.stderr.on('data', function(data) { 
			// 	console.log('stdout: ' + data); 
			// })
			// child.on('close', function(code) {
			// 	callback();
			// })
   //      }
   //      ,
        function (callback) {
            console.log("hostapd start...");
			
			//-B: run as deamon in background, -t:time log messages, -d: debug messages			
			var child = spawn('hostapd', ['-B', '-t', '-d', '/etc/hostapd/hostapd.conf'], {});

			child.stdout.on('data', function(data) { 
				console.log('stdout: ' + data); 
			})
			child.stderr.on('data', function(data) { 
				console.log('stdout: ' + data); 
			})
			child.on('close', function(code) {
				// callback();
				cb(null, 'hotspot enabled');
			})
        }
    ]);

	// ifconfig wlan3 up
	// ifconfig wlan3 192.168.1.1
	// dnsmasq -i wlan3 -F 192.168.1.100,192.168.1.200,12h
	// hostapd /etc/hostapd/hostapd.conf

	// ./ifconfigUser wlan3 up
	// ./ifconfig wlan3 192.168.1.1
	// dnsmasq -i wlan3 -F 192.168.1.100,192.168.1.200,12h -p 55
	// hostapd /etc/hostapd/hostapd.conf
}

disableHotspot = function(cb) {

	// Technologies
	connman.getTechnologies(function(err, technologies) {
		//--see if wifi module exists
		if(technologies.WiFi !== undefined) {
			console.log("wifi module exists");

			//--make sure wifi module is enabled (powered)
			technologies.WiFi.getProperties(function(err, properties) {
				if(!err) {
					var wifi = connman.technologies['WiFi'];

					if(properties.Powered) {
						wifi.setProperty('Powered', false, function(err, res) {
							console.log('Disabled wifi...');
							console.log('small timeout for wifi module to power down...')
							setTimeout(cb, 5000, null, 'wifi disabled');
						});
					} else {
						console.log('wifi was already disabled');
						cb(null, 'wifi already disabled');
					}
				}
			});
		}
	});
}

getAccesspoints = function(cb) {

	connman.on('PropertyChanged', function(name, value) {
		console.log('[Manager]', name, value);
	});

	// Technologies
	connman.getTechnologies(function(err, technologies) {
		//--see if wifi module exists
		if(technologies.WiFi !== undefined) {
			console.log("wifi module exists");

			//--make sure wifi module is enabled (powered)
			technologies.WiFi.getProperties(function(err, properties) {
				if(!err) {
					var wifi = connman.technologies['WiFi'];

					if(!properties.Powered) {
						wifi.setProperty('Powered', true, function(err, res) {
							console.log('Enabled wifi');
							console.log('small timeout for wifi module to get powered...')
							setTimeout(scan, 5000); //10000ms = 10 sec = delay for antenna hardware to power up
						});
					} else {
						console.log('wifi was already enabled');
						scan();
					}

					function scan(callback) {
						console.log("scan()");
						technologies.WiFi.getProperties(function(err, properties) {
							if(!err) {
								if(properties.Powered === true) { 
									console.log('Scanning...');
									wifi.scan(function(err) {
										if(!err) {
											wifi.listAccessPoints(function(err, list) {
												console.log('Returning ' + list.length + ' Access Point(s)');
												cb(null, list);
											});
										} else {
											console.log(new Error('ERR: ' + err));
											setTimeout(scan, 500); //--rescan if .NoCarrier error
										}
									});
								} else {
									console.log("wifi is not enabled yet in software...");
								}								
							} else {
								console.log("ERR: " + err);
							}
						})	
					}
				}
			})
		} else {
			console.log("wifi module does not exist (not plugged in?)");
		}
	});
}

connectToAccesspoint = function(serviceName, passphrase, cb) {

	// Technologies
	connman.getTechnologies(function(err, technologies) {
		//--see if wifi module exists
		if(technologies.WiFi !== undefined) {
			console.log("wifi module exists");

			//--make sure wifi module is enabled (powered)
			technologies.WiFi.getProperties(function(err, properties) {
				if(!err) {
					var wifi = connman.technologies['WiFi'];

					if(!properties.Powered) {
						wifi.setProperty('Powered', true, function(err, res) {
							console.log('Enabled wifi');
							console.log('small timeout for wifi module to get powered...')
							setTimeout(connect, 5000); //10000ms = 10 sec = delay for antenna hardware to power up
						});
					} else {
						console.log('wifi was already enabled');
						connect();
					}
				}
			})
		}
	})

	function connect(callback) {
		var wifi = connman.technologies['WiFi'];

		wifi.findAccessPoint(serviceName, function(err, service) {
			//--check if service name exists
			if (!service) {
				cb(new Error('No such accesspoint: ' + serviceName));
				return;
			} else {
				console.log('Try connecting to service: ' + service.serviceName);
			}

			//--get connection
			connman.getConnection(service.serviceName, function(err, ap) {

				/* Making connection to access point */
				ap.connect(function(err, agent) {

					if (err) {
						cb(err);
						return;
					} else {
						// cb(agent);
					}

					var failed = false;

					console.log('Connecting ...');
					// cb(null, 'Connecting....');

					agent.on('Release', function() {
						console.log('Release');
					});

					agent.on('ReportError', function(path, err) {
						console.log('ReportError:');
						console.log(err);
						failed = true;
						/* connect-failed */
						/* invalid-key */
					});

					agent.on('RequestBrowser', function(path, url) {
						console.log('RequestBrowser');
					});

					/* Initializing Agent for connecting access point */
					agent.on('RequestInput', function(path, dict, callback) {
						console.log(dict);

						if ('Passphrase' in dict) {
							callback({ 'Passphrase': passphrase });
							return;
						}

						callback({});
					});

					agent.on('Cancel', function() {
						console.log('Cancel');
					});

					ap.on('PropertyChanged', function(name, value) {
						// console.log(name + '=' + value);

						if (name == 'State') {
							switch(value) {
							case 'failure':
								console.log('Connection failed');
								break;

							case 'association':
								console.log('Associating ...');
								break;

							case 'configuration':
								console.log('Configuring ...');
								break;

							case 'ready':
								console.log('Ready!')
								cb(null, 'Ready!');
								break;

							case 'online':
								console.log('Connected');
								break;
							}
						}
					});
				});
			});
		});
	}
}

disconnectFromAccesspoint = function(serviceName, cb) {

	var wifi = connman.technologies['WiFi'];

	wifi.findAccessPoint(serviceName, function(err, service) {
		//--check if service name exists
		if (!service) {
			cb(new Error('No such accesspoint: ' + serviceName));
			return;
		} else {
			console.log('Try disconnecting from service: ' + service.serviceName);
		}

		//--get connection
		connman.getConnection(service.serviceName, function(err, ap) {

			/* Making connection to access point */
			ap.disconnect(function(err) {

				if (err) {
					cb(err);
					return;
				}

				// console.log('Disconnecting from ' + serviceName +'...');
				cb(null, 'Disconnected from ' + serviceName +'...');
			});
		});
	});
}




































