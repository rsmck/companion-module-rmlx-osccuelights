const osc = require('osc');
const dgram = require('dgram');
const { onDataHandler } = require('./osc-feedback.js');

class OSCUDPClient {
	constructor(root, host, port, listen) {
		this.root = root;
		this.host = host;
		this.port = port;
		this.listen = listen;
		this.udpPort = null;
		this.connected = false;
		this.socket = null;
	}

	openConnection() {
		if (this.connected) {
			this.root.log('info', 'UDP connection is already open');
			return;
		}

		return new Promise((resolve, reject) => {
			this.root.updateStatus('connecting');
			this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

			this.socket.on('error', (err) => {
				this.root.log('warn', `Socket error: ${err.message}`);
				this.socket.close();
				this.connected = false;
				this.root.updateStatus('connection_failure');
				reject(new Error(`Socket error: ${err.message}`));
			});

			this.socket.on('message', (msg, rinfo) => {
				this.root.log('debug', `Received UDP message from ${rinfo.address}:${rinfo.port}`);

				if (this.listen) {
					onDataHandler(this.root, rinfo.address, msg);
				}
			});

			this.socket.bind({ address: "0.0.0.0", port: this.port }, () => {
				this.root.log('info', `Listening for OSC messages on port ${this.port} with SO_REUSEPORT`);
				this.connected = true;

				// Join multicast group if this.host is a multicast address
				if (this.host && this.isMulticastAddress(this.host)) {
					try {
						this.socket.addMembership(this.host);
						this.root.log('info', `Joined multicast group ${this.host}`);
					} catch (err) {
						this.root.log('warn', `Failed to join multicast group ${this.host}: ${err.message}`);
					}
				}

				this.root.updateStatus('ok');
				resolve();
			});
		});
	}

	// Helper method to check if an address is a multicast address
	isMulticastAddress(address) {
		const parts = address.split('.');
		if (parts.length !== 4) return false;
		const firstOctet = parseInt(parts[0], 10);
		return firstOctet >= 224 && firstOctet <= 239; // Multicast range: 224.0.0.0 - 239.255.255.255
	}

	closeConnection() {
        if (!this.socket || !this.connected) {
            this.root.log('debug', 'No UDP connection to close');
            return;
        }

        return new Promise((resolve, reject) => {
            this.socket.close();
            this.connected = false;
            this.root.log('info', 'UDP connection closed manually');

			if (this.listen) {
				this.root.updateStatus('disconnected');
			}
			
            resolve();
        }); 
	}

	isConnected() {
		return this.connected;
	}
}

module.exports = OSCUDPClient;
