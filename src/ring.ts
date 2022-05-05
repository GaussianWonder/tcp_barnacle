import * as net from 'net';
import TcpSocketBuilder, { PayloadProcessor } from './builder';

// These can be different for all socket servers
//  pay attention to payload processors' types though

interface PayloadType {
	value: number;
}
const payloadProcessor: PayloadProcessor<PayloadType, PayloadType> = {
	unpack: (buf) => JSON.parse(buf.toString()),
  filter: (data) => data.value <= 100,
  map: ({ value }) => ({
		value: value + 1,
	}),
  pack: JSON.stringify,
}

export default function() {
	const A = new TcpSocketBuilder<PayloadType, PayloadType>()
		.listen({
			host: '127.0.0.1',
			port: 1337,
		})
		.redirectPayload({
			host: '127.0.0.2',
			port: 1338,
		})
		.processor(payloadProcessor)
		.build();

	const B = new TcpSocketBuilder<PayloadType, PayloadType>()
		.listen({
			host: '127.0.0.2',
			port: 1338,
		})
		.redirectPayload({
			host: '127.0.0.3',
			port: 1339,
		})
		.processor(payloadProcessor)
		.build();

	const C = new TcpSocketBuilder<PayloadType, PayloadType>()
		.listen({
			host: '127.0.0.3',
			port: 1339,
		})
		.redirectPayload({
			host: '127.0.0.1',
			port: 1337,
		})
		.processor(payloadProcessor)
		.build();

	const initSocket = new net.Socket();
	initSocket.connect(1337, '127.0.0.1', () => {
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

	return [A, B, C, initSocket] as const;
}
