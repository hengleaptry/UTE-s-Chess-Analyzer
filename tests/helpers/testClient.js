// tests/helpers/testClient.js
//
// A tiny cookie-aware fetch wrapper. Node's global fetch (undici) doesn't
// persist cookies across requests the way a browser does, and this app's
// auth is a session cookie — so tests need something that remembers the
// Set-Cookie from login/register and replays it, the same way a real
// browser tab would.

class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = null;
  }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookie) headers.Cookie = this.cookie;

    const res = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (setCookies.length > 0) {
      this.cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    }

    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      // non-JSON or empty body — fine, callers check status for those cases
    }

    return { status: res.status, body: json };
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  del(path) { return this.request('DELETE', path); }

  clearCookie() { this.cookie = null; }
}

module.exports = { TestClient };
