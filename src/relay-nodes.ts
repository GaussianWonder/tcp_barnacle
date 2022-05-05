import * as net from 'net';
import TcpSocketBuilder, { PayloadProcessor } from './builder';

type PayloadType = Uint8Array;
const payloadProcessor: PayloadProcessor<PayloadType, PayloadType> = {
	unpack: JSON.parse,
  filter: (data) => data.value <= 100,
  map: ({ value }) => ({
		value: value + 1,
	}),
  pack: JSON.stringify,
}

export default function() {

  const sender = new TcpSocketBuilder<PayloadType, PayloadType>()
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
}