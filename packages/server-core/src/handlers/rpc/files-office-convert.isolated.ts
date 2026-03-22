import { describe, expect, it } from 'bun:test'
import { writeFile, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { convertOfficeToMarkdown } from './files'

/**
 * Create a minimal valid .docx file programmatically.
 * A .docx is a ZIP archive with specific XML parts. We use JSZip (already in the dep tree via mammoth).
 */
async function createTestDocx(text: string): Promise<Buffer> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`)

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Test Heading</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>${text}</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`)

  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  return buf
}

describe('convertOfficeToMarkdown', () => {
  it('converts a .docx file to markdown via mammoth + turndown', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'depot-test-'))
    const docxPath = join(tmpDir, 'test.docx')

    try {
      const docxBuffer = await createTestDocx('Hello from the security audit test')
      await writeFile(docxPath, docxBuffer)

      const result = await convertOfficeToMarkdown(docxPath)

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      // mammoth extracts text, turndown converts HTML to markdown
      expect(result).toContain('Hello from the security audit test')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('converts headings to markdown ATX style', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'depot-test-'))
    const docxPath = join(tmpDir, 'heading.docx')

    try {
      const docxBuffer = await createTestDocx('Body text')
      await writeFile(docxPath, docxBuffer)

      const result = await convertOfficeToMarkdown(docxPath)

      // Heading1 style should produce a markdown heading with ATX '#' prefix
      expect(result).toMatch(/^#\s+Test Heading/m)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('throws on non-existent .docx file', async () => {
    await expect(
      convertOfficeToMarkdown('/tmp/nonexistent-file-12345.docx')
    ).rejects.toThrow()
  })

  it('routes .xlsx through Python CLI path (succeeds or throws clear error)', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'depot-test-'))
    const fakePath = join(tmpDir, 'test.xlsx')

    try {
      await writeFile(fakePath, 'not a real xlsx')
      // The Python CLI path either succeeds (uv + markitdown installed) or
      // throws with a clear error message — both are acceptable
      try {
        const result = await convertOfficeToMarkdown(fakePath)
        // If it succeeded, verify we got a string back
        expect(typeof result).toBe('string')
      } catch (err) {
        // If it failed, verify the error is meaningful
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toMatch(/conversion failed|uv/i)
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})
