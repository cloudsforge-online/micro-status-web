/**
 * Host resolution.
 *
 * This app's API is not its own host, which is the one way it differs from every other frontend in
 * the estate — so the resolution is tested against the REGISTRY rather than against a hard-coded
 * string, and in every environment the bundle can be opened in.
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { cloudsforgeHosts } from '@cloudsforge/ui'
import { installWindow, removeWindow } from './browser-stubs.ts'
import { APP_NAME, PRODUCT, UPSTREAM, pageOrigin, resolveStatusBase, statusBase } from '../src/lib/hosts.ts'

afterEach(() => {
  removeWindow()
})

describe('the surface this app is, and the one it reads', () => {
  it('is the registry key `status`, which exists', () => {
    installWindow('https://status.cloudsforge.online/')
    assert.equal(PRODUCT, 'status')
    // Throws if the key is not in the registry, which is the point of asserting it here.
    assert.ok(cloudsforgeHosts()[PRODUCT])
  })

  it('reads Beacon, deliberately not itself', () => {
    installWindow('https://status.cloudsforge.online/')
    assert.equal(UPSTREAM, 'beacon')
    assert.notEqual(UPSTREAM, PRODUCT)
    assert.ok(cloudsforgeHosts()[UPSTREAM])
  })

  it('reports a name to the observability ingest', () => {
    assert.equal(APP_NAME, 'status-web')
  })
})

describe('resolveStatusBase', () => {
  it('is relative when the page is on the status surface', () => {
    installWindow('https://status.cloudsforge.online/history')
    const hosts = cloudsforgeHosts()
    assert.equal(resolveStatusBase('https://status.cloudsforge.online', hosts), '')
  })

  it('is relative when the page is on Beacon itself', () => {
    installWindow('https://beacon.cloudsforge.online/')
    const hosts = cloudsforgeHosts()
    assert.equal(resolveStatusBase('https://beacon.cloudsforge.online', hosts), '')
  })

  it('is Beacon absolute under `pnpm dev`, where nothing proxies', () => {
    installWindow('http://localhost:5180/')
    const hosts = cloudsforgeHosts()
    assert.equal(resolveStatusBase('http://localhost:5180', hosts), hosts.beacon)
    assert.equal(hosts.beacon, 'http://localhost:4011')
  })

  it('is Beacon absolute when there is no page origin at all', () => {
    installWindow('http://localhost:5180/')
    const hosts = cloudsforgeHosts()
    assert.equal(resolveStatusBase('', hosts), hosts.beacon)
  })

  it('is Beacon absolute from an unrelated origin, rather than guessing relative', () => {
    installWindow('https://example.test/')
    const hosts = cloudsforgeHosts()
    assert.equal(resolveStatusBase('https://example.test', hosts), hosts.beacon)
  })

  it('never returns the status surface itself as an API base', () => {
    // The bug this function exists to avoid: the template's resolveApiBase would answer
    // `hosts.status` here, and nothing serves an API on the status host.
    for (const origin of ['http://localhost:5180', 'https://example.test', '']) {
      installWindow('http://localhost:5180/')
      const hosts = cloudsforgeHosts()
      assert.notEqual(resolveStatusBase(origin, hosts), hosts.status)
    }
  })
})

describe('statusBase and pageOrigin read the live window', () => {
  it('follows the window it is called under, not a cached value', () => {
    installWindow('http://localhost:5180/')
    assert.equal(statusBase(), 'http://localhost:4011')
    removeWindow()
    installWindow('https://status.cloudsforge.online/')
    assert.equal(statusBase(), '')
  })

  it('is empty with no window, which is what makes the absolute branch correct', () => {
    assert.equal(pageOrigin(), '')
  })
})
