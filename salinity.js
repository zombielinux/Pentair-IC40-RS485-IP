#!/usr/bin/env node
const Influx = require('influx');
var net = require('net');

var secrets = require('./secrets.txt')

//Inputs 
// ARG 1 =  command (0=status, 1=version, 2=salt)
// ARG 2 =  salt percent


const influx = new Influx.InfluxDB({
  host: secrets.influxHost,
  database: secrets.influxDatabase,
  schema: [
    {
      measurement: 'pool',
      fields: {salt: Influx.FieldType.FLOAT, state: Influx.FieldType.FLOAT},
      tags: ['unit', 'location']
    }
  ]
});


var messageBuffer= Buffer.alloc(8)
messageBuffer[0] = 16;
messageBuffer[1] = 2;
messageBuffer[2] = 80;
switch (process.argv[2]){
	case '0':
		messageBuffer[3] = 0;
		messageBuffer[4] = 0;
	case '1':
		messageBuffer[3] = 20;
		messageBuffer[4] = 0;
	case '2':
		if (process.argv[3]<=100){
			messageBuffer[3] = 17;
			messageBuffer[4] = process.argv[3];
		}
		else {
			messageBuffer[3] = 21;
			messageBuffer[4] = process.argv[3]/10;
		}
	}
messageBuffer[5] = (messageBuffer[0] + messageBuffer[1] + messageBuffer[2] + messageBuffer[3] + messageBuffer[4])%256
messageBuffer[6] = 16;
messageBuffer[7] = 3;

const validCommands = Buffer.from([0, 17, 20, 21])
const validResponse = Buffer.from([1, 3, 18])

var recievedBuffs = 0
var totalBuffer = Buffer.from('');




//([16, 2, 80, saltCommand, saltPercentage, saltChecksum, 16, 3])


var client = new net.Socket();
client.connect(secrets.rsTcpPort, secrets.rsTcpHost, function() {
//	console.log(messageBuffer)
	client.write(messageBuffer);

});

client.on('data', function(data) {
	recievedBuffs++;
	var array = [totalBuffer , data]
	totalBuffer = Buffer.concat(array)

	setTimeout(function() {
		client.destroy(); // kill client after server's response
	}, 100);
});


client.on('close', function() {
	if (process.argv[2] == '2'){
//		console.log(parseInt(totalBuffer[11],10)*50 +"PPM")
		influx.writePoints([{
			measurement: 'pool',
			fields: {salt: parseInt(totalBuffer[11],10)*50, state: parseInt(totalBuffer[12],10)},
			tags: {unit: "IC40", location: "Pool_Filter"}
		}], {
			database: secrets.influxDatabase,
			precision: 's',
		});
	}
//	console.log(totalBuffer)
//	console.log(" ");
});


