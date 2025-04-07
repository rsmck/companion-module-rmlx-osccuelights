const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	// var stations = ['SL','SR','LX','FLYS'];
	var stations = [1,2,3,4,5,6,7,8,9,10,11,12];

    var presets = { 
		Clear_Selection: {
				type: 'button',
				category: 'Cue Light Selection',
				name: 'Clear Selection',
				style: {
					text: 'CLEAR',
					size: "18",
					color: 16777215,
					bgcolor: 9264944,
				},
				steps: [
					{
						down: [
							{
								actionId: 'select_del',
								options: {
									station: "*"
								} 
							}
						],
						up: []
					}
				],
			},
			
		Global_Clear_Selection: {
				type: 'button',
				category: 'Global Controls',
				name: 'Clear Selection',
				style: {
					text: 'CLEAR',
					size: "18",
					color: 16777215,
					bgcolor: 9264944,
				},
				steps: [
					{
						down: [
							{
								actionId: 'select_del',
								options: {
									station: "*"
								} 
							}
						],
						up: []
					}
				],
			},

		Global_SBY: {
				type: 'button',
				category: 'Global Controls',
				name: 'Global Standby',
				style: {
					text: "S/BY ALL",
					size: "18",
					color: 16777215,
					bgcolor: 13369344,
				},
				steps: [
					{
						down: [
							{
								actionId: 'send_stby',
								options: {
									station: "*"
								} 
							}
						],
						up: []
					}
				],
			},

		Global_GO: {
				type: 'button',
				category: 'Global Controls',
				name: 'Global Standby',
				style: {
					text: "GO ALL",
					color: 16777215,
					bgcolor: 39168,
				},
				steps: [
					{
						down: [
							{
								actionId: 'send_go',
								options: {
									station: "*"
								} 
							}
						],
						up: []
					}
				],
			}


    }; 

	stations.forEach( sid => {
	   presets['Select_'+sid] = {
				type: 'button',
				category: 'Cue Light Selection',
				name: 'Select',
				style: {
					text: 'SEL '+sid,
					color: 16777215,
					bgcolor: 9264944,
				},
				steps: [
					{
						down: [
							{
								actionId: 'select_toggle',
								options: {
									station: ''+sid
								}
							}
						],
						up: []
					}
				],
				feedbacks: [
					{
						feedbackId: 'is_selected',
						options: {
							station: ''+sid
						},
						style: {
							bgcolor: 16744448
						},
					}
				]
			};

	   presets['Standby_Ack_'+sid] = {
				type: 'button',
				category: 'Standby Buttons (With Ack)',
				name: 'Select',
				style: {
					text: 'S/BY '+sid,
					color: 16777215,
					bgcolor: 3342336,
				},
				steps: [
					{
						down: [
							{
								actionId: 'send_stby',
								options: {
									station: ''+sid,
									reqack: true
								}
							}
						],
						up: []
					}
				],
				feedbacks: [
					{
						feedbackId: 'station_status',
						options: {
							station: ''+sid,
							stationState: "standby"
						},
						style: {
							bgcolor: 13369344
						},
					},
					{
						feedbackId: 'station_status',
						options: {
							station: ''+sid,
							stationState: "standby_c"
						},
						style: {
							bgcolor: 16711680
						},
					}
				]
			};

	   presets['Standby_NoAck_'+sid] = {
				type: 'button',
				category: 'Standby Buttons (no Ack)',
				name: 'Select',
				style: {
					text: 'S/BY '+sid,
					color: 16777215,
					bgcolor: 3342336,
				},
				steps: [
					{
						down: [
							{
								actionId: 'send_stby',
								options: {
									station: ''+sid,
									reqack: false
								}
							}
						],
						up: []
					}
				],
				feedbacks: [
					{
						feedbackId: 'station_status',
						options: {
							station: ''+sid,
							stationState: "standby"
						},
						style: {
							bgcolor: 13369344
						},
					},
					{
						feedbackId: 'station_status',
						options: {
							station: ''+sid,
							stationState: "standby_c"
						},
						style: {
							bgcolor: 16711680
						},
					}
				]
			};

	   presets['GO_'+sid] = {
				type: 'button',
				category: 'GO Buttons',
				name: 'Select',
				style: {
					text: 'GO '+sid,
					color: 16777215,
					bgcolor: 13056,
				},
				steps: [
					{
						down: [
							{
								actionId: 'send_go',
								options: {
									station: ''+sid,
								}
							}
						],
						up: []
					}
				],
				feedbacks: [
					{
						feedbackId: 'station_status',
						options: {
							station: ''+sid,
							stationState: "go"
						},
						style: {
							bgcolor: 52224
						},
					},
					{
						feedbackId: 'station_status',
						options: {
							station: ''+sid,
							stationState: "go_c"
						},
						style: {
							bgcolor: 4259648
						},
					}
				]
			};


	});	


    self.setPresetDefinitions(presets)
}