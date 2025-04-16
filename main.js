const { InstanceBase, Regex, runEntrypoint } = require('@companion-module/base')
const UpdatePresets = require('./presets');
const { isValidIPAddress, parseArguments, evaluateComparison, setupOSC } = require('./helpers.js');

class OSCInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	//Initialization
	async init(config) {
		this.config = config;
		this.stationIPs = {};
		this.targetHost;
		this.client;
		this.flashStateToggle = false;
		this.onDataReceived = {};
		
		// FIXME: this is probably really inefficient but it works... 
		// make this work better, maybe using requestAnimationFrame or
		// ensuring that it's only running when needed rather than constantly!
		this.flashTimer = setInterval(() => {
			this.flashStateToggle = !this.flashStateToggle;
			this.checkFeedbacks();
		}, 500);
		

		let validate = false;

		if (this.config.host) {
			// FIXME: add validation here for comma-separated list of IPs
			this.targetHost = this.config.host;
			validate = true;
		}

		if (this.config.listen) {
			if (this.targetHost && (this.config.targetPort || this.config.feedbackPort)) {
				setupOSC(this);
				if (validate) { this.setupListeners(); }
			}
		} else {
			this.updateStatus('ok');
		}

		this.updateActions(); // export actions
		this.updateFeedbacks(); // export feedback
		this.updateVariables(); // export variables
		this.updatePresets(); // export presets
		
	}
	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
	}
	  
	async configUpdated(config) {
		this.config = config;

		if (this.client && this.client.isConnected()) {
			await this.client.closeConnection()
			.then (() => {
				this.client = null;
			})
			.catch(err => {
				this.log('error', `${this.config.protocol} close error: ${err.message}`);
			});
		}

		let validate = false;
		if (!this.config.host) {
			this.updateStatus('bad_config');
			this.log('warn', 'No host specified in config (null)');
		} else if (!this.config.targetPort) {
			this.updateStatus('bad_config');
			this.log('warn', 'No targetPort specified in config (null)');
		} else {
			this.targetHost = this.config.host;
			validate = true;
		}

		if (!validate) { return; }

		setupOSC(this);

		this.setupListeners();
		this.updatePresets();
	}

	async setupListeners() {
		this.log('info', `Resetting Listeners..`);

		if (this.config.listen) {
			if (this.config.protocol && this.client && !this.client.isConnected()) {
				await this.client.openConnection()
				.catch(err => {
					this.log('error', err.message);
				});

			}
		} else {
			this.updateStatus('ok');
		}
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP(s) or Multicast Address',
				width: 16,
				regex:  /^(\s*(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\s*)(,\s*(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\s*)*$/,
				required: true
			},
			{
				type: 'textinput',
				id: 'targetPort',
				label: 'Target Port',
				width: 4,
				regex: Regex.PORT,
				required: true
			},
			{
				type: 'dropdown',
				id: 'protocol',
				label: 'Protocol',
				choices: [
					{ id: 'udp', label: 'UDP (Default)' },
				],
				default: 'udp',
				width: 4,
				required: true
			},
			{
				type: 'checkbox',
				id: 'listen',
				label: 'Listen for Feedback',
				width: 4,
				default: false,
				required: true
			},
			{
				type: 'checkbox',
				id: 'stickyip',
				label: 'Remember Last Station IPs',
				width: 4,
				default: false,
				required: true
			},
			{
				type: 'textinput',
				id: 'feedbackPort',
				label: 'Feedback Port',
				width: 4,
				regex: Regex.PORT,
				isVisible: (options, data) => (options.listen && options.protocol === 'udp'),
			}
		]
	}

	async updatePresets() {
		await UpdatePresets(this)
	}

	updateActions() {
		const sendOscMessage = async (path, args, type) => {
			const args_json = JSON.stringify(args);
			const args_string = args.map(item => item.value).join(" ");

			this.log('debug', `Sending OSC [${this.config.protocol}] ${this.targetHost}:${this.config.targetPort} ${path}`)
			this.log('debug', `Sending Args ${args_json}`)

			this.oscSend(this.targetHost, this.config.targetPort, path, args);

			if (this.targetHost.indexOf(',') > 0) {
				// there is more than one host to send to
				this.targetHost.split(',').forEach((h) => {
					this.log('debug', ` => to ${h}:${this.config.targetPort} ${path}`)
					this.oscSend(h, this.config.targetPort, path, args);
				}); 
			} else {
				this.oscSend(this.targetHost, this.config.targetPort, path, args);
			}
		}

		const sendOscMessageToStation = async (station, path, args, type) => {
			if (!this.config.stickyip) {
				return;
			}

			const args_json = JSON.stringify(args);
			const args_string = args.map(item => item.value).join(" ");

			if (this.stationIPs[''+station] === undefined) { return; }
			
			const stationIP = this.stationIPs[''+station];
						
			this.log('debug', `Sending OSC to Cached Station IP [${this.config.protocol}] ${stationIP}:${this.config.targetPort} ${path}`)
			this.log('debug', `Sending Args ${args_json}`)

			this.oscSend(stationIP, this.config.targetPort, path, args);
		}

		this.setActionDefinitions({
			// TOGGLE
			select_toggle: {
				name: 'Toggle Selection',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					},
				],
				callback: async (event) => {
					var selected = this.getSelectedStations();
				
					if (!selected.includes(event.options.station)) {
						selected.push(event.options.station);
					} else {
						const index = selected.indexOf(event.options.station);
						if (index !== -1) {
							selected.splice(index, 1);
						}
					}

					var selectedJson = JSON.stringify(selected);
					this.setVariableValues({
						'selected_stations': selectedJson
					});
					
					this.checkFeedbacks();
				},
			},
			
			// SELECT
			select_add: {
				name: 'Select',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					},
				],
				callback: async (event) => {
					// this doesn't work, not sure how to get something that was inserted
					// into a variable with setVariableValues
					var selected = this.getSelectedStations();
				
					if (!selected.includes(event.options.station)) {
						selected.push(event.options.station);
					}

					console.log(selected);

					this.setVariableValues({
						'selected_stations': JSON.stringify(selected)
					});
					
					this.checkFeedbacks();
				},
			},
			
			// DESELECT
			select_del: {
				name: 'Deselect',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					},
				],
				callback: async (event) => {
					console.log('DESELECT '+event.options.station)

					if (event.options.station === undefined || event.options.station == '' || event.options.station == '*') {
						this.setVariableValues({
							'selected_stations': '[]'
						});
						this.checkFeedbacks();
						return;
					} else {
						var selectedJson = this.getVariableValue('selected_stations');
						var selected = JSON.parse(selectedJson);
						const index = selected.indexOf(event.options.station);
						if (index !== -1) {
							selected.splice(index, 1);
						}
					}

					this.setVariableValues({
						'selected_stations': JSON.stringify(selected)
					});

					this.checkFeedbacks();
				},
			},

			// OFF
			send_off: {
				name: 'Clear / OFF',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					}
				],
				callback: async (event) => {
					if (event.options.station === undefined || event.options.station == '' || event.options.station == '*') {
						var selectedJson = this.getVariableValue('selected_stations');
						if (selectedJson.length > 1) {
							var selected = JSON.parse(selectedJson);
						}
						var this_station = selected.join(',');
					} else {
						var this_station = event.options.station;
					}

					this.setLocalStatus(this_station,'off');

					const path = '/cuelight/'+this_station+'/off'
					sendOscMessageToStation(this_station, path, [])
					sendOscMessage(path, [])
				},
			},

			// GO
			send_go: {
				name: 'GO',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					},
					{
						type: 'textinput',
						label: 'Message (Optional)',
						id: 'msg',
						default: '',
						useVariables: true,
					},
				],
				callback: async (event) => {
					if (event.options.station === undefined || event.options.station == '' || event.options.station == '*') {
						var selectedJson = this.getVariableValue('selected_stations');
						if (selectedJson.length > 1) {
							var selected = JSON.parse(selectedJson);
						}
						var this_station = selected.join(',');
					} else {
						var this_station = event.options.station;
					}

					// toggle!
					const currentState = this.getLocalStatus(this_station);
					if (currentState == 'go' || currentState == 'go_c') {
						// cancel instead
						this.setLocalStatus(this_station,'off');	
						const path = '/cuelight/'+this_station+'/off'
						sendOscMessageToStation(this_station, path, [])
						sendOscMessage(path, [])
						return true;
					}

					this.setLocalStatus(this_station,'go');

					const path = '/cuelight/'+this_station+'/go'
					if (event.options.msg != '') {
						const msg = await this.parseVariablesInString(event.options.msg)
						sendOscMessageToStation(this_station, path, [
							{
								type: 's',
								value: '' + msg,
							},
						])
						sendOscMessage(path, [
							{
								type: 's',
								value: '' + msg,
							},
						])
					} else {
						sendOscMessageToStation(this_station, path, [])
						sendOscMessage(path, [])
					}
				},
			},
			
			// STANDBY
			send_stby: {
				name: 'Standby',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					},
					{
						type: 'textinput',
						label: 'Message (Optional)',
						id: 'msg',
						default: '',
						useVariables: true,
					},
					{
						type: 'checkbox',
						label: 'Request Ack',
						id: 'reqack',
						default: false,
						useVariables: true,
					},
				],
				callback: async (event) => {
					if (event.options.station === undefined || event.options.station == '' || event.options.station == '*') {
						var selectedJson = this.getVariableValue('selected_stations');
						if (selectedJson.length > 1) {
							var selected = JSON.parse(selectedJson);
						}
						var this_station = selected.join(',');
					} else {
						var this_station = event.options.station;
					}
					
					// toggle!
					const currentState = this.getLocalStatus(this_station);
					if (currentState == 'standby' || currentState == 'standby_c' || currentState == 'standby_acked') {
						// cancel instead
						this.setLocalStatus(this_station,'off');	
						const path = '/cuelight/'+this_station+'/off'
						sendOscMessageToStation(this_station, path, [])
						sendOscMessage(path, [])
						return true;
					}

					this.setLocalStatus(this_station,'standby');

					var path = '/cuelight/'+this_station+'/standby'
					if (event.options.reqack === true) {
						path = path+'_ack';
						this.setLocalStatus(this_station,'standby');
					}
					console.log(path);
					if (event.options.msg != '') {
						const msg = await this.parseVariablesInString(event.options.msg)
						sendOscMessage(path, [
							{
								type: 's',
								value: '' + msg,
							},
						])
						sendOscMessageToStation(this_station, path, [
							{
								type: 's',
								value: '' + msg,
							},
						])
					} else {
						sendOscMessageToStation(this_station, path, [])
						sendOscMessage(path, [])
					}
				},
			},
		})
	}
	
	getSelectedStations() {
		var selectedJson = this.getVariableValue('selected_stations');
		if (selectedJson !== undefined && selectedJson.length > 1) {
			var selected = JSON.parse(selectedJson);
		} else {
			var selected = [];
		}
		return selected;
	}
	
	setLocalStatus(this_station,status) {
		var stationStatusJson = this.getVariableValue('station_status');
		if (stationStatusJson.length > 1) {
			var stationStatus = JSON.parse(stationStatusJson);
		} else {
			var stationStatus = {}
		}
		
		// this_station can be a comma-delimited list, so split it and update
		// them all (FIXME: can maybe improve how this works)
		if (this_station.indexOf(',')) {
			this_station.split(',').forEach((station) => stationStatus[''+station] = status);
		} else {
			stationStatus[''+this_station] = status;
		}
		this.setVariableValues({ 'station_status': JSON.stringify(stationStatus) });
		this.checkFeedbacks();
	}

	getLocalStatus(this_station) {
		console.log('Get status for '+this_station)
		var stationStatusJson = this.getVariableValue('station_status');
		if (stationStatusJson.length > 1) {
			var stationStatus = JSON.parse(stationStatusJson);
		} else {
			return '';
		}
		if (stationStatus[''+this_station] !== undefined && stationStatus[''+this_station] !== null) {
			return stationStatus[''+this_station];
		} 
		return '';
	}

	updateFeedbacks() {
		this.setFeedbackDefinitions({
			is_selected: {
				type: 'boolean',
				name: 'Is Selected',
				description: 'Cue Station is Selected',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					}
				],
				callback: async (feedback, context) => {
					/// This doesn't work
					console.log("Feedback "+feedback.options.station);
					var selectedJson = this.getVariableValue('selected_stations');
					if (selectedJson.length > 1) {
						var selected = JSON.parse(selectedJson);
						
						if (feedback.options.station === undefined || feedback.options.station == '' || feedback.options.station == '*') {
							if (selected.length > 0) {
								return true;
							} else {
								return false;
							}
						}
	  
						const index = selected.indexOf(feedback.options.station);
						if (index !== -1) {
							return true;
						}
					}
					return false;	
				}
			},
			is_stby_ack: {
				type: 'boolean',
				name: 'Is Acknowledged',
				description: 'Cue Station has Acknowledged the Standby.',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					}
				],
				callback: async (feedback, context) => {
					if (this.getLocalStatus(feedback.options.station) == 'ack_c') {
						// acked
						return true;
					}
					return false;
				}
			},
			station_status: {
				type: 'boolean',
				name: 'Station Status',
				description: 'Cue Station Confirmed Status Feedback.',
				options: [
					{
						type: 'textinput',
						label: 'Station',
						id: 'station',
						default: '1',
						useVariables: true,
					},
					{
						type: 'dropdown',
						label: 'Station State',
						id: 'stationState',
						tooltip: 'Select the station state',
						default: 0,
						choices: [
							{ id: 'off', label: 'Off' },
							{ id: 'standby', label: 'S/By' },
							{ id: 'go', label: 'Go' },
							{ id: 'off_c', label: 'Off (Confirmed)' },
							{ id: 'standby_c', label: 'S/By (Confirmed)' },
							{ id: 'go_c', label: 'Go (Confirmed)' },
						],
						minChoicesForSearch: 0,
					},
				],
				callback: async (feedback, context) => {
					console.log('looking for '+feedback.options.stationState+' got '+this.getLocalStatus(feedback.options.station));
					if (this.getLocalStatus(feedback.options.station) == feedback.options.stationState) {
						// hacky approach to flashing the button 
						if ((feedback.options.stationState == 'standby') && this.flashStateToggle) return false;
						if ((feedback.options.stationState == 'standby_c') && this.flashStateToggle) return false;
						return true;
					}
					if (feedback.options.stationState == 'standby_c' && this.getLocalStatus(feedback.options.station) == 'ack_c') {
						// acked
						return true;
					}
					return false;
				}
			}
		});
	}

	updateVariables() {
		this.setVariableDefinitions([
			{ variableId: 'selected_stations', name: 'Selected Stations' },
			{ variableId: 'station_status', name: 'Station Status' },
		]);
	}
	
	
}

runEntrypoint(OSCInstance);
