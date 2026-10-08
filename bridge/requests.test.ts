import { describe, expect, it } from 'vitest';
import { addressedHere, allowsOrigin, connectionOf } from './requests.ts';

const ENGINES = ['PostgreSQL', 'MySQL'];
const request = (changes: Record<string, unknown> = {}) =>
  JSON.stringify({ engine: 'PostgreSQL', host: 'localhost', port: 5432, database: 'shop', user: 'reader', password: 'secret', ...changes });

describe('allowsOrigin', () => {
  it('answers pages served from this machine, on any port', () => {
    expect(allowsOrigin('http://localhost:5173')).toBe(true);
    expect(allowsOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(allowsOrigin('http://[::1]:5173')).toBe(true);
    expect(allowsOrigin('http://localhost')).toBe(true);
  });

  it('does not answer pages from anywhere else', () => {
    expect(allowsOrigin('https://example.com')).toBe(false);
    expect(allowsOrigin('http://localhost.example.com')).toBe(false);
    expect(allowsOrigin('http://127.0.0.1.example.com:5173')).toBe(false);
    expect(allowsOrigin('http://192.168.1.20:5173')).toBe(false);
    // A page opened from a file, or in a sandbox, has no origin to trust.
    expect(allowsOrigin('null')).toBe(false);
    expect(allowsOrigin('')).toBe(false);
  });

  it('answers the origins it is started with, and a tool that is no page', () => {
    expect(allowsOrigin('https://studio.example.com', new Set(['https://studio.example.com']))).toBe(true);
    expect(allowsOrigin('https://other.example.com', new Set(['https://studio.example.com']))).toBe(false);
    expect(allowsOrigin(undefined)).toBe(true);
  });
});

describe('addressedHere', () => {
  it('holds for the names of this machine', () => {
    expect(addressedHere('127.0.0.1:4577')).toBe(true);
    expect(addressedHere('localhost:4577')).toBe(true);
    expect(addressedHere('[::1]:4577')).toBe(true);
  });

  it('does not hold for a name that only resolves to this machine, or for none', () => {
    expect(addressedHere('rebind.example.com:4577')).toBe(false);
    expect(addressedHere('127.0.0.1.example.com')).toBe(false);
    expect(addressedHere(undefined)).toBe(false);
    expect(addressedHere('')).toBe(false);
  });
});

describe('connectionOf', () => {
  it('reads a connection, with its schema and SSL when they are asked for', () => {
    expect(connectionOf(request(), ENGINES)).toEqual({ engine: 'PostgreSQL', host: 'localhost', port: 5432, database: 'shop', user: 'reader', password: 'secret' });
    expect(connectionOf(request({ schema: 'audit', ssl: true, password: '' }), ENGINES)).toMatchObject({ schema: 'audit', ssl: true, password: '' });
  });

  it('keeps nothing but the fields of a connection', () => {
    const connection = connectionOf(request({ sql: 'DROP TABLE users', ssl: 'yes', options: '-c x=y' }), ENGINES);
    expect(Object.keys(connection ?? {}).sort()).toEqual(['database', 'engine', 'host', 'password', 'port', 'user']);
  });

  it('takes nothing that is not a connection to an engine it reads', () => {
    for (const body of [
      'not json',
      'null',
      '[]',
      request({ engine: 'SQLite' }),
      request({ engine: undefined }),
      request({ host: ' ' }),
      request({ database: '' }),
      request({ user: 7 }),
      request({ password: undefined }),
      request({ port: '5432' }),
      request({ port: 0 }),
      request({ port: 70000 }),
      request({ port: 54.32 }),
      request({ schema: 5 }),
    ]) {
      expect(connectionOf(body, ENGINES)).toBeNull();
    }
  });
});
