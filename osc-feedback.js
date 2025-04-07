const osc = require('osc');

function getCompleteMessageLength(buffer) {
    try {
        const packet = osc.readPacket(buffer, {});
        return osc.writePacket(packet).length;
    } catch (err) {
        // Handle incomplete message
        return buffer.length + 1; // Ensure the message length exceeds buffer length to wait for more data
    }
}

async function parseOscMessages(root, buffer) {
    const packets = [];

    while (buffer.length > 0) {
        const messageLength = getCompleteMessageLength(buffer);
        if (messageLength <= buffer.length) {
            const message = buffer.slice(0, messageLength);
            buffer = buffer.slice(messageLength);

            try {
                let packet = osc.readPacket(message, { metadata: true });
                packets.push(packet);
            } catch (err) {
                root.log('error', `Error parsing OSC message: ${err.message}. Data: ${message}`);
            }
        } else {
            break; // Wait for more data
        }
    }

    return { remainingBuffer: buffer, packets };
}

async function onDataHandler(root, addr, data) {
    try {
        let buffer = Buffer.alloc(0);
        buffer = Buffer.concat([buffer, data]);
        root.log('trace', `Buffer length: ${buffer.length}`);

        // Parse the OSC messages
        const { remainingBuffer, packets } = await parseOscMessages(root, buffer);
        buffer = remainingBuffer;

        root.log('debug', `Raw: ${JSON.stringify(data)}`);

        // Handle the parsed packets
        for (const packet of packets) {
            if (packet.address) {
                root.onDataReceived[packet.address] = packet.args;
                const args_json = JSON.stringify(packet.args);
                const args_string = packet.args.map(item => item.value).join(" ");
                root.log('debug', `OSC message: ${packet.address}, args: ${args_json}`);
                // update the state based on the received live messages
                if (packet.address.match(/^\/cuelight\/state/)) {
					parts = packet.address.split("/")
					station = parts[3]
					state = parts[4]
					root.stationIPs[''+station] = addr;
					root.setLocalStatus(station,state+'_c');
				}
                await root.checkFeedbacks();
            } else if (packet.packets) {
                for (const element of packet.packets) {
                    if (element.address) {
						if (element.address.match(/^\/cuelight\/state/)) {
							parts = packet.address.split("/")
							station = parts[3]
							state = parts[4]
							root.setLocalStatus(station,state+'_c');
						}
                    }
                }
            }
        }
        root.log('trace', `Remaining buffer length: ${buffer.length}`);
    } catch (err) {
        root.log('error', `Error handling incoming data: ${err.message}`);
    }
}

module.exports = { onDataHandler };
