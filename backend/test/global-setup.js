import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function setup() {
  mongod = await MongoMemoryServer.create();
  // Workers are forked after globalSetup, so they inherit this.
  process.env.MONGO_TEST_URI = mongod.getUri();
}

export async function teardown() {
  if (mongod) await mongod.stop();
}
