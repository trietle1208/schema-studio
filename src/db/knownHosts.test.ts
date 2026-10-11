import { beforeEach, describe, expect, it } from 'vitest';
import { forgetHost, hostId, knownHostKey, trustHost } from './knownHosts';
import { resetDatabase } from './testing';

const KEY = `SHA256:${'A'.repeat(43)}`;
const OTHER = `SHA256:${'B'.repeat(43)}`;

beforeEach(resetDatabase);

describe('hostId', () => {
  it('names a server by where it is, without regard to case or stray spaces', () => {
    expect(hostId(' Bastion.Example.com ', 22)).toBe('bastion.example.com:22');
  });
});

describe('known hosts', () => {
  it('knows no key for a server nobody trusted', async () => {
    expect(await knownHostKey('bastion.example.com', 22)).toBeUndefined();
  });

  it('knows the key that was trusted, for that server and port only', async () => {
    await trustHost('Bastion.example.com', 22, KEY);
    expect(await knownHostKey('bastion.example.com', 22)).toBe(KEY);
    expect(await knownHostKey('bastion.example.com', 2222)).toBeUndefined();
    expect(await knownHostKey('other.example.com', 22)).toBeUndefined();
  });

  it('replaces a key that was trusted before', async () => {
    await trustHost('bastion.example.com', 22, KEY);
    await trustHost('bastion.example.com', 22, OTHER);
    expect(await knownHostKey('bastion.example.com', 22)).toBe(OTHER);
  });

  it('forgets a server, and does not mind one it never knew', async () => {
    await trustHost('bastion.example.com', 22, KEY);
    await forgetHost('bastion.example.com', 22);
    await forgetHost('bastion.example.com', 22);
    expect(await knownHostKey('bastion.example.com', 22)).toBeUndefined();
  });
});
