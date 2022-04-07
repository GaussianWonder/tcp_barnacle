import * as net from 'net';
import TcpSocketBuilder, { PayloadProcessor } from './ring';

// These can be different for all socket servers
//  pay attention to payload processors' types though
const portToUse = 1337;

interface PayloadType {
	value: number;
}
const payloadProcessor: PayloadProcessor<PayloadType, PayloadType> = {
	unpack: JSON.parse,
  filter: (data) => data.value <= 100,
  map: ({ value }) => ({
		value: value + 1,
	}),
  pack: JSON.stringify,
}

const A = new TcpSocketBuilder<PayloadType, PayloadType>()
	.listen({
		host: '127.0.0.1',
		port: portToUse,
	})
	.redirectPayload({
		host: '127.0.0.2',
		port: portToUse,
	})
	.processor(payloadProcessor)
	.build();

const B = new TcpSocketBuilder<PayloadType, PayloadType>()
	.listen({
		host: '127.0.0.2',
		port: portToUse,
	})
	.redirectPayload({
		host: '127.0.0.3',
		port: portToUse,
	})
	.processor(payloadProcessor)
	.build();

const C = new TcpSocketBuilder<PayloadType, PayloadType>()
	.listen({
		host: '127.0.0.3',
		port: portToUse,
	})
	.redirectPayload({
		host: '127.0.0.1',
		port: portToUse,
	})
	.processor(payloadProcessor)
	.build();

const initSocket = new net.Socket();
initSocket.connect(portToUse, '127.0.0.1', () => {
	// init the request by sending A a payload
	initSocket.write(payloadProcessor.pack({ value: 0 }), () => {
		initSocket.end(() => {
		});
	});
});

initSocket.on('end', function() {
	console.log('Initial payload request is finished');
	initSocket.destroy();
});
