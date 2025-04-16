## OSC Cue Lights

**Configuration**

- Target IP(s)
   -  One or more IP addresses (separated by commas)
   -  You can use Broadcast IP address here, or a comma-separated list of all cue light stations.
   -  You can also enter a Multicast Group address here if supported by your network.
- Target Port
   -  Listening port on the Cue Light Station or Multicast Group
- Listen For Feedback
   -  Required to use confirmed display and remote Ack
- Feedback Port
   -  Recommended to be set the same as Target Port
   -  If using Multicast, set the PORT in the OSC Cue Light App to this port
- Remember Last Station IP
   -  Improve delivery performance when using Broadcast by sending messages 
      directly to the IP the cue light station replied from previously
   -  Has no effect when using Multicast or Dedicated IPs  
   
**Available actions for OSC Cue Lights:**

- Toggle Cue Light
- Select Cue Light 
- Deselect Cue Light
- Send S/BY (With Optional Message)
   -  (If no station is specified, or '\*' is specified will send Standby to all selected stations)
- Send GO (With Optional Message)
   -  (If no station is specified, or '\*' is specified will send Standby to all selected stations)
- Send Clear

**Available feedback for OSC Cue Lights:**

- Is Acknowledged
- Is Selected
- Station Status

**Available variables for OSC Cue Lights:**
- Selected Cue Lights: `${osc_cue_light:selected_stations}`
- Current Cue Light Status: `${osc_cue_light:station_status}`
