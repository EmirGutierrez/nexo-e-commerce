import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

describe('Content Security Policy proxy', () => {
  it('issues a per-response nonce without allowing inline scripts or style attributes', () => {
    const first = proxy(new NextRequest('https://nexo.example/admin'));
    const second = proxy(new NextRequest('https://nexo.example/admin'));
    const firstPolicy = first.headers.get('content-security-policy') || '';
    const secondPolicy = second.headers.get('content-security-policy') || '';
    const firstNonce = firstPolicy.match(/script-src[^;]*'nonce-([^']+)'/)?.[1];
    const secondNonce = secondPolicy.match(/script-src[^;]*'nonce-([^']+)'/)?.[1];

    expect(firstNonce).toBeTruthy();
    expect(secondNonce).toBeTruthy();
    expect(firstNonce).not.toBe(secondNonce);
    expect(firstPolicy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(firstPolicy).not.toMatch(/style-src-attr[^;]*unsafe-inline/);
    expect(firstPolicy).toContain("object-src 'none'");
    expect(firstPolicy).toContain("frame-ancestors 'none'");
  });
});
