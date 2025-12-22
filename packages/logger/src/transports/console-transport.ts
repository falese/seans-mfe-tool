/**
 * Console Transport
 * Writes log messages to console output
 */

import { Transport } from '../types';

export class ConsoleTransport implements Transport {
  write(message: string): void {
    console.log(message);
  }
}
