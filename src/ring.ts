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
  unpack: (data: string) => T;
  filter: (data: T) => boolean;
  map: (data: T) => M;
  pack: (data: M) => string;
}

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
    return this.readableIdentifier(this.payloadReceiver);
  }

  get receiverServer(): net.Server | null {
    return serverMap.get(this.payloadReceiver) ?? null;
  }

  private endSocketConnection(s: net.Socket) {
    s.end(() => {
      s.destroy();
    });
  }

  // Create the server

  public build(): net.Server {
    if (this.payloadReceiver === null || this.identifier === null || this.payloadProcessor === null) {
      throw new Error("Server properties are not completely built. Make sure all properties are given value before calling build()!");
    }

    const server = net
      .createServer((socket) => {
        console.log(`${this.meIdentifier} received connection from ${socket.remoteAddress}:${socket.remotePort}`);

        let data: string = ''; // data received from `socket`
        const redirectSocket = new net.Socket(); // payload redirect node

        socket.on('data', (chunk: Buffer) => {
          console.log(`${this.meIdentifier} received ${chunk.byteLength} bytes from ${this.receiverIdentifier}`);

          data += chunk.toString();
        });

        socket.on('end', () => {
          console.log(`${socket.remoteAddress}:${socket.remotePort} finished sending ${this.meIdentifier} ${data}`);

          if (data) {
            redirectSocket.connect(this.payloadReceiver.port, this.payloadReceiver.host, () => {
              console.log(`${this.meIdentifier} successfully established a connection with the receiving end ${this.receiverIdentifier}`);

              const unpacked: T = this.payloadProcessor.unpack(data);
              if(this.payloadProcessor.filter(unpacked)) {
                const next: M = this.payloadProcessor.map(unpacked);
                const nextPacked: string = this.payloadProcessor.pack(next);

                redirectSocket.write(nextPacked, () => {
                  console.log(`${this.meIdentifier} finished writing to ${redirectSocket.remoteAddress}`);
                  this.endSocketConnection(redirectSocket);
                });
              } else {
                this.endSocketConnection(redirectSocket);
              }
            });

            redirectSocket.on('close', () => {
              console.log(`Connection between ${this.meIdentifier} and ${this.receiverIdentifier} is closed`);

              this.endSocketConnection(socket);
            });
          } else {
            this.endSocketConnection(socket);
          }
        });
      })
      .listen(this.identifier.port, this.identifier.host);

    serverMap.set(this.identifier, server);
    return server;
  }
}