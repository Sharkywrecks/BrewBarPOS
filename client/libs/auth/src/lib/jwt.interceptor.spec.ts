import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpRequest, HttpHandlerFn, HttpResponse, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { jwtInterceptor } from './jwt.interceptor';

describe('jwtInterceptor', () => {
  let next: HttpHandlerFn;

  beforeEach(() => {
    localStorage.clear();
    next = vi.fn().mockReturnValue(of(new HttpResponse()));
  });

  it('should add Authorization header when token exists', () => {
    localStorage.setItem('brewbar_token', 'test-jwt');
    const req = new HttpRequest('GET', '/api/orders');

    jwtInterceptor(req, next);

    const passedReq = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as HttpRequest<unknown>;
    expect(passedReq.headers.get('Authorization')).toBe('Bearer test-jwt');
  });

  it('should not add Authorization header when no token', () => {
    const req = new HttpRequest('GET', '/api/orders');

    jwtInterceptor(req, next);

    const passedReq = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as HttpRequest<unknown>;
    expect(passedReq.headers.has('Authorization')).toBe(false);
  });

  it('should preserve existing headers', () => {
    localStorage.setItem('brewbar_token', 'test-jwt');
    const req = new HttpRequest('GET', '/api/orders', null, {
      headers: new HttpHeaders({ 'X-Custom': 'value' }),
    });

    jwtInterceptor(req, next);

    const passedReq = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as HttpRequest<unknown>;
    expect(passedReq.headers.get('X-Custom')).toBe('value');
    expect(passedReq.headers.get('Authorization')).toBe('Bearer test-jwt');
  });
});
