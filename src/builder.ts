import * as net from "net";

export interface TcpSocketIdentifier {
  host: string;
  port: number;
}

export interface TcpSocketBuilderInterface {
  payloadReceiver: TcpSocketIdentifier;
  identifier: TcpSocketIdentifier;
}

export interface PayloadProcessor<T, M> {
  unpack: (data: Buffer) => T;
  filter: (data: T, ctx: TcpSocketBuilderInterface) => boolean;
  map: (data: T) => M;
  pack: (data: M) => string | Uint8Array;
}

export type ForwardingProcessor<T> = PayloadProcessor<T, T>;

export const serverMap: Map<TcpSocketIdentifier, net.Server> = new Map();

export default class TcpSocketBuilder<T, M> implements TcpSocketBuilderInterface {
  payloadReceiver: TcpSocketIdentifier | null;
  identifier: TcpSocketIdentifier | null;
  payloadProcessor: PayloadProcessor<T, M> | null;
  
  constructor(init?: TcpSocketBuilderInterface) {
    if (init) {
      this.identifier = init.identifier;
      this.payloadReceiver = init.payloadReceiver;
    } else {
      this.payloadReceiver = null;
      this.identifier = null;
    }
    this.payloadProcessor = null;
  }

  public listen(identifier: TcpSocketIdentifier) {
    this.identifier = identifier;
    return this;
  }

  public redirectPayload(payloadReceiver: TcpSocketIdentifier) {
    this.payloadReceiver = payloadReceiver;
    return this;
  }

  public processor(payloadProcessor: PayloadProcessor<T, M>) {
    this.payloadProcessor = payloadProcessor;
    return this;
  }

  // Utility methods

  private readableIdentifier(identifier: TcpSocketIdentifier): string {
    return `${identifier.host}:${identifier.port}`;
  }

  get meIdentifier(): string {
    return this.readableIdentifier(this.identifier);
  }

  get receiverIdentifier() {
    if (!this.payloadReceiver) return '<no receiver>';
    return this.readableIdentifier(this.payloadReceiver);
  }

  get receiverServer(): net.Server | null {
    if (!this.payloadReceiver) return null;
    return serverMap.get(this.payloadReceiver) ?? null;
  }

  private endSocketConnection(s: net.Socket) {
    s.end(() => {
      s.destroy();
    });
  }

  // Create the server

  public build(): net.Server {
    if (this.identifier === null || this.payloadProcessor === null) {
      throw new Error("Server properties are not completely built. Make sure all properties are given value before calling build()!");
    }

    const server = net
      .createServer((socket) => {
        console.log(`${this.meIdentifier} received connection from ${socket.remoteAddress}:${socket.remotePort}`);

        const chunks: Buffer[] = [];

        socket.on('data', (chunk: Buffer) => {
          console.log(`${this.meIdentifier} received ${chunk.byteLength} bytes from ${socket.remoteAddress}:${socket.remotePort}`);
          chunks.push(chunk);
        });

        socket.on('end', () => {
          console.log(`${socket.remoteAddress}:${socket.remotePort} finished sending ${this.meIdentifier} ${chunks.length} chunks`);
          if (!this.payloadReceiver) {
            console.log(`${this.meIdentifier} has no payload receiver. Exit.`);
            return;
          }

          const redirectSocket = net.createConnection(
            {
              host: this.payloadReceiver.host,
              port: this.payloadReceiver.port,
              localAddress: this.identifier.host,
            },
            () => {
              console.log(`${this.meIdentifier} successfully established a connection with the receiving end ${this.receiverIdentifier}`);

              if (chunks && chunks.length) {
                const data: Buffer = Buffer.concat(chunks);
                chunks.splice(0, chunks.length); // remove the contents of the chunks array

                const unpacked: T = this.payloadProcessor.unpack(data);
                if(this.payloadProcessor.filter(unpacked, this)) {
                  const next: M = this.payloadProcessor.map(unpacked);
                  const nextPacked = this.payloadProcessor.pack(next);

                  redirectSocket.write(nextPacked, () => {
                    console.log(`${this.meIdentifier} finished writing to ${redirectSocket.remoteAddress}`);
                    this.endSocketConnection(redirectSocket);
                  });
                } else {
                  this.endSocketConnection(redirectSocket);
                }
              } else {
                this.endSocketConnection(socket);
              }
            }
          );

          redirectSocket.on('close', () => {
            console.log(`Connection between ${this.meIdentifier} and ${this.receiverIdentifier} is closed`);

            this.endSocketConnection(socket);
          });
        });
      })
      .listen(this.identifier.port, this.identifier.host);

    serverMap.set(this.identifier, server);
    return server;
  }
}
