import { describe, it, expect } from 'vitest';
import { CLIENT_TOKEN } from './client-token';
import { Client, API_BASE_URL } from './generated/client.api';

describe('api-client library', () => {
  it('should export CLIENT_TOKEN injection token', () => {
    expect(CLIENT_TOKEN).toBeDefined();
    expect(CLIENT_TOKEN.toString()).toContain('CLIENT_TOKEN');
  });

  it('should export Client class', () => {
    expect(Client).toBeDefined();
    expect(typeof Client).toBe('function');
  });

  it('should export API_BASE_URL injection token', () => {
    expect(API_BASE_URL).toBeDefined();
  });
});
