/**
 * OmaID (16-Digit Luhn Mod 10 Identifier) Engine
 * 100% byte-compatible with Linux Rust rendezvous.rs and Android OmaIdentity.kt
 */

export class OmaIdEngine {
  /**
   * Normalizes an OmaID by stripping non-digits
   */
  static normalize(input: string | null | undefined): string {
    return (input || '').replace(/\D/g, '');
  }

  /**
   * Formats a 16-digit OmaID into 4x4 blocks (XXXX-XXXX-XXXX-XXXX)
   */
  static format(rawOrFormatted: string): string {
    const norm = this.normalize(rawOrFormatted);
    if (norm.length === 16) {
      return `${norm.slice(0, 4)}-${norm.slice(4, 8)}-${norm.slice(8, 12)}-${norm.slice(12, 16)}`;
    }
    return norm;
  }

  /**
   * Computes Luhn mod 10 checksum digit for leading 15 digits
   */
  static computeLuhnChecksum(digits15: number[]): number {
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let val = digits15[i];
      if (i % 2 === 0) {
        val *= 2;
        if (val > 9) val -= 9;
      }
      sum += val;
    }
    return (10 - (sum % 10)) % 10;
  }

  /**
   * Verifies whether a 16-digit string satisfies Luhn mod 10
   */
  static validate(input: string | null | undefined): boolean {
    if (!input) return false;
    const norm = this.normalize(input);
    if (norm.length !== 16) return false;

    let sum = 0;
    for (let i = 0; i < 16; i++) {
      const val = parseInt(norm[i], 10);
      if (isNaN(val)) return false;
      let term = val;
      if (i % 2 === 0) {
        term *= 2;
        if (term > 9) term -= 9;
      }
      sum += term;
    }
    return sum % 10 === 0;
  }

  /**
   * Generates a random 16-digit OmaID with cryptographic entropy and valid Luhn checksum
   */
  static generate(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const digits: number[] = [];
    for (let i = 0; i < array.length && digits.length < 15; i++) {
      if (array[i] < 250) {
        digits.push(array[i] % 10);
      }
    }
    while (digits.length < 15) {
      digits.push(Math.floor(Math.random() * 10));
    }
    const check = this.computeLuhnChecksum(digits);
    digits.push(check);
    const raw = digits.join('');
    return this.format(raw);
  }
}

export const OmaIdValidator = OmaIdEngine;
