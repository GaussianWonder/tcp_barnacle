import { TcpSocketIdentifier } from "./builder";

export function sameHostIdentifier(a: TcpSocketIdentifier, b: TcpSocketIdentifier): boolean {
  return a.host === b.host && a.port === b.port;
}

export function forwardMapper<T>(data: T): T {
  return data;
}
