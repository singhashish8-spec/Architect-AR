import { describe, expect, it } from 'vitest'
import { buildShareHtml, buildShareText } from './projectShareText'

describe('buildShareText', () => {
  it('includes the project name, description, and link', () => {
    const text = buildShareText('Duplex Renovation', 'Kitchen walkthrough for client review', 'https://example.com/p/1')
    expect(text).toContain('Duplex Renovation')
    expect(text).toContain('Kitchen walkthrough for client review')
    expect(text).toContain('https://example.com/p/1')
  })

  it('omits the description entirely when none was given', () => {
    const text = buildShareText('Duplex Renovation', null, 'https://example.com/p/1')
    expect(text).toBe('Duplex Renovation\n\nhttps://example.com/p/1')
  })
})

describe('buildShareHtml', () => {
  it('renders the link as a real anchor tag', () => {
    const html = buildShareHtml('Duplex Renovation', 'Kitchen walkthrough', 'https://example.com/p/1')
    expect(html).toContain('<a href="https://example.com/p/1">https://example.com/p/1</a>')
    expect(html).toContain('Duplex Renovation')
    expect(html).toContain('Kitchen walkthrough')
  })

  it('escapes HTML special characters in the description so a client-provided blurb cannot break the markup', () => {
    const html = buildShareHtml('Test', '<script>alert(1)</script> & "quotes"', 'https://example.com')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;quotes&quot;')
  })

  it('omits the description paragraph entirely when none was given', () => {
    const html = buildShareHtml('Test', null, 'https://example.com')
    expect(html).not.toContain('<p></p>')
  })
})
