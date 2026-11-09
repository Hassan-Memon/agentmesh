// Tiny shared flag: is the RabbitMQ relay active? When it is, WebSocket fan-out happens in
// the bus consumer (so any gateway replica relays events for any run). When it is not, the
// gRPC stream consumer in RunsService emits to WebSocket clients directly. One source of
// truth prevents clients from seeing every event twice.
import { Injectable } from '@nestjs/common';

@Injectable()
export class BusState {
  private _relayEnabled = false;

  get relayEnabled(): boolean {
    return this._relayEnabled;
  }

  set relayEnabled(value: boolean) {
    this._relayEnabled = value;
  }
}
