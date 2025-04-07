const dns = require('dns');
const net = require('net');
const OSCUDPClient = require('./osc-udp.js');

function isValidIPAddress(ip) {
  const result = net.isIP(ip);
  return result === 4 || result === 6; // Return true if it's either IPv4 or IPv6
}

function parseArguments(argsStr) {
  const rawArgs = (argsStr + '').replace(/“/g, '"').replace(/”/g, '"').split(' ');
  const args = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === undefined || rawArgs[i].length === 0) continue;
    if (isNaN(rawArgs[i])) {
      let str = rawArgs[i];
      if (str.startsWith('"')) {
        // Ensure the string is complete
        while (i < rawArgs.length - 1 && !rawArgs[i].endsWith('"')) {
          i++;
          str += ' ' + rawArgs[i];
        }
        if (!str.endsWith('"')) {
          return { error: `Unmatched quote in arguments: ${str}` };
        }
      }
      args.push(str.replace(/"/g, '').replace(/'/g, ''));
    } else if (rawArgs[i].indexOf('.') > -1) {
      args.push(parseFloat(rawArgs[i]));
    } else {
      args.push(parseInt(rawArgs[i]));
    }
  }
  return { args };
}


function setupOSC(instance) {
  // this only suppports UDP for now
  var targetHost = '';
  
  if (instance.config.protocol === 'udp') {
  	if (instance.targetHost.indexOf(',') > 0) {
		// there is more than one host to send to, but just initialise with the first!
		targetHost = instance.targetHost.split(',')[0];
	} else {
		targetHost = instance.targetHost
	}
    instance.client = new OSCUDPClient(instance, targetHost, instance.config.feedbackPort, instance.config.listen);
  } else {
    instance.client = null;
    instance.updateStatus('bad_config');
  }
}

module.exports = { isValidIPAddress, parseArguments, setupOSC };