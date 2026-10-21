import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection } from '../core/introspect/catalog';
import { db } from './db';
import { connectionFromProfile, connectionRecord, getConnection, saveConnection } from './connections';
import { createSchema, deleteSchema } from './schemas';
import { resetDatabase } from './testing';

const ecommerce = { name: 'ecommerce', engine: 'MySQL' };

const connection: Connection = {
  engine: 'MySQL',
  host: 'db.internal',
  port: 3306,
  database: 'atad5s',
  user: 'reader',
  password: 's3cret-db',
  ssl: true,
  ssh: {
    host: 'bastion.internal',
    port: 22,
    user: 'deploy',
    auth: 'key',
    keyPath: '~/.ssh/id_ed25519',
    passphrase: 's3cret-key',
    password: 's3cret-ssh',
  },
};

beforeEach(resetDatabase);

describe('connectionRecord', () => {
  it('keeps the profile and leaves every secret out of the stored record', async () => {
    const schema = await createSchema(ecommerce, { tables: [], positions: {} });
    const record = connectionRecord(schema.id, connection);
    expect(record).not.toBeNull();
    await saveConnection(record!);

    const stored = await getConnection(schema.id);
    expect(stored).toEqual({
      schemaId: schema.id,
      engine: 'MySQL',
      host: 'db.internal',
      port: 3306,
      database: 'atad5s',
      user: 'reader',
      ssl: true,
      ssh: { host: 'bastion.internal', port: 22, user: 'deploy', auth: 'key', keyPath: '~/.ssh/id_ed25519' },
    });
    const text = JSON.stringify(await db.connections.toArray());
    expect(text).not.toContain('s3cret-db');
    expect(text).not.toContain('s3cret-key');
    expect(text).not.toContain('s3cret-ssh');
    expect(stored).not.toHaveProperty('password');
    expect(stored?.ssh).not.toHaveProperty('password');
    expect(stored?.ssh).not.toHaveProperty('passphrase');
  });

  it('stores nothing for an engine whose rows are not read', () => {
    expect(connectionRecord(1, { ...connection, engine: 'PostgreSQL' })).toBeNull();
  });

  it('is removed with the schema', async () => {
    const schema = await createSchema(ecommerce, { tables: [], positions: {} });
    await saveConnection(connectionRecord(schema.id, connection)!);
    await deleteSchema(schema.id);
    expect(await db.connections.count()).toBe(0);
  });
});

describe('connectionFromProfile', () => {
  it('puts the session secrets back on the connection the bridge is asked with', async () => {
    const schema = await createSchema(ecommerce, { tables: [], positions: {} });
    const record = connectionRecord(schema.id, connection)!;
    const restored = connectionFromProfile(record, { password: 's3cret-db', sshPassphrase: 's3cret-key' }, 'SHA256:abc');
    expect(restored.password).toBe('s3cret-db');
    expect(restored.ssh).toMatchObject({ auth: 'key', keyPath: '~/.ssh/id_ed25519', passphrase: 's3cret-key', hostKey: 'SHA256:abc' });
    expect(restored.ssh).not.toHaveProperty('password');
  });
});
