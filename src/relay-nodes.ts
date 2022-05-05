import * as net from 'net';
import TcpSocketBuilder, { ForwardingProcessor, TcpSocketIdentifier } from './builder';
import { forwardMapper, sameHostIdentifier } from './helpers';

interface PrivatePayload<T> {
  destination: TcpSocketIdentifier,
  payload: T,
}

interface SecretData {
  value: number;
}

type PayloadType = PrivatePayload<SecretData>

function bufferParser(buf: Buffer): PayloadType {
  const [h1, h2, h3, h4] = [0, 1, 2, 3].map(index => buf.readUInt8(index));
  const host = `${h1}.${h2}.${h3}.${h4}`;
  const port = buf.readUInt16LE(4);
  const value = buf.readUInt32LE(6);
  return {
    destination: { host, port },
    payload: { value },
  };
}

function payloadToUint8Array(data: PayloadType): Uint8Array {
  const buf = Buffer.alloc(10); // 4 (host) + 2 (port) + 4 (32bit value)

  const { destination: { host, port }, payload: { value } } = data;
  host
    .split('.')
    .map(Number)
    .forEach((byte, index) => buf.writeUInt8(byte, index));
  buf.writeUInt16LE(port, 4);
  buf.writeUInt32LE(value, 6);

  return new Uint8Array(buf);
}

const clientPacketConsumer: ForwardingProcessor<PayloadType> = {
	unpack: bufferParser,
  filter: (data, ctx) => !sameHostIdentifier(ctx.identifier, data.destination),
  map: forwardMapper,
  pack: payloadToUint8Array,
}

export default function() {
  const destination1 = new TcpSocketBuilder<PayloadType, PayloadType>()
    .listen({ host: '127.0.0.1', port: 1337 })
    .redirectPayload({ host: '127.0.0.2', port: 1337 })
    .processor(clientPacketConsumer)
    .build();

  const destination2 = new TcpSocketBuilder<PayloadType, PayloadType>()
    .listen({ host: '127.0.0.2', port: 1337 })
    .redirectPayload({ host: '127.0.0.3', port: 1337 })
    .processor(clientPacketConsumer)
    .build();

  const destination3 = new TcpSocketBuilder<PayloadType, PayloadType>()
    .listen({ host: '127.0.0.3', port: 1337 })
    .processor(clientPacketConsumer)
    .build();

  const repeatHandler = setInterval(() => {
    const hosts = ['127.0.0.1', '127.0.0.2', '127.0.0.3'];
    const port = 1337;
    const payload: PayloadType = {
      destination: {
        host: hosts[Math.floor(Math.random() * hosts.length)],
        port: port,
      },
      payload: {
        value: Math.floor(Math.random() * 10000),
      },
    };

    console.debug(`\nSending ${payload.payload.value} to ${payload.destination.host}:${payload.destination.port}\n`);

    const sender = new net.Socket();

    sender.connect(
      {
        host: '127.0.0.1',
        port: 1337,
        localAddress: '127.0.0.15',
        localPort: 1337,
      },
      () => {
        sender.write(payloadToUint8Array(payload), () => {
          sender.end(() => {});
        });
      }
    );

    sender.on('end', function() {
      console.log('Initial payload request is finished');
      sender.destroy();
    });
  }, 5000);

  return [destination1, destination2, destination3, repeatHandler];
}