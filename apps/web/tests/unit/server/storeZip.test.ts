import { describe, expect, it } from 'vitest'
import { buildStoreZip } from '../../../server/utils/storeZip'

describe('storeZip', () => {
  it('creates a readable store ZIP', () => {
    const zip = buildStoreZip([
      { name: 'readme.txt', data: Buffer.from('hello remediation') },
      { name: 'summary.json', data: Buffer.from('{"ok":true}') }
    ])
    expect(zip.slice(0, 2).toString('utf8')).toBe('PK')
    expect(zip.length).toBeGreaterThan(40)
  })

  it('supports nested markdown paths for content export', () => {
    const zip = buildStoreZip([
      { name: 'blog/post-a.md', data: Buffer.from('# Post A') },
      { name: 'about.md', data: Buffer.from('# About') }
    ])
    expect(zip.slice(0, 2).toString('utf8')).toBe('PK')
    expect(zip.length).toBeGreaterThan(60)
  })

  it('builds an AI handoff pack ZIP with task, TREE, and pages', () => {
    const zip = buildStoreZip([
      { name: 'task.md', data: Buffer.from('# AI handoff task\n') },
      { name: 'TREE.md', data: Buffer.from('# Selected pages\n\n- [About](pages/about.md)\n') },
      { name: 'pages/about.md', data: Buffer.from('---\nurl: "https://example.com/about"\n---\n# About\n') }
    ])
    const asText = zip.toString('binary')
    expect(zip.slice(0, 2).toString('utf8')).toBe('PK')
    expect(asText).toContain('task.md')
    expect(asText).toContain('TREE.md')
    expect(asText).toContain('pages/about.md')
  })
})
