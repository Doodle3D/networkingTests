//http://10.0.0.144:8080/debug?port=5858

/*notes:
 * - async module import in wifi.js
 * - in wifi.js rename 'wifi' to 'WiFi'
 */

var ConnMan = require('jsdx-connman');
var async = require('async');
var Q = require('q');

//from: http://stackoverflow.com/questions/8556777/dbus-php-unable-to-launch-dbus-daemon-without-display-for-x11
process.env.DISPLAY = ':0';
process.env.DBUS_SESSION_BUS_ADDRESS = 'unix:path=/run/dbus/system_bus_socket';

var connman = new ConnMan();

connman.init(function() {


	getAccesspoints(function(err, list) {
		if(!err) {
			for (var index in list) {
				var ap = list[index];
				var name = String((ap.Name ? ap.Name : '*hidden*'));
				console.log('  ' + name, '  \t\t\t Strength: ' + ap.Strength + '%', '  \t\t\t Security: ' + ap.Security);
			}
			
			connectToAccesspoint('Doodle3D-wisp', function(err, res) {
				if(!err) {
					console.log('callback res: ' + res);
				} else {
					console.log('ERR ' + err);
				}
			})
		} else {
			console.log("error: " + err);
		}
	})
	
});

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

connectToAccesspoint = function(serviceName, cb) {
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
				cb(null, 'Connecting....');

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
						callback({ 'Passphrase': '12345' });
						return;
					}

					callback({});
				});

				agent.on('Cancel', function() {
					console.log('Cancel');
				});

				ap.on('PropertyChanged', function(name, value) {
					console.log(name + '=' + value);

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
							cb(null, 'Connected!');
							break;
						}
					}
				});
			});
		});
	});
}





































