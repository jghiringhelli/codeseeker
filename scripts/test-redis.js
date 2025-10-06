#!/usr/bin/env node

const Redis = require('ioredis');

async function testRedis() {
  console.log('Testing Redis connection...');
  
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000
  });

  try {
    console.log('Attempting to connect...');
    await redis.connect();
    
    console.log('Connected! Testing ping...');
    const pong = await redis.ping();
    console.log('Ping response:', pong);
    
    console.log('Testing set/get...');
    await redis.set('test', 'hello');
    const value = await redis.get('test');
    console.log('Test value:', value);
    
    await redis.del('test');
    console.log('✅ Redis test successful');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await redis.disconnect();
  }
}

testRedis();