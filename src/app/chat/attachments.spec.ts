import { checkFile, MAX_DOCUMENT_BYTES, toContentParts } from './attachments';

describe('checkFile', () => {
  it('accepts images by type and documents by extension', () => {
    expect(checkFile(new File(['x'], 'a.png', { type: 'image/png' }))).toEqual({
      ok: true,
      kind: 'image',
      mimeType: 'image/png',
    });
    expect(checkFile(new File(['# x'], 'Spec.MD'))).toEqual({
      ok: true,
      kind: 'document',
      mimeType: 'text/markdown',
    });
    expect(checkFile(new File(['<p>'], 'p.htm', { type: 'text/html' }))).toMatchObject({
      kind: 'document',
      mimeType: 'text/html',
    });
  });

  it('rejects other types and files over the limit', () => {
    expect(checkFile(new File(['x'], 'a.pdf', { type: 'application/pdf' })).ok).toBe(false);
    expect(checkFile(new File(['x'.repeat(MAX_DOCUMENT_BYTES + 1)], 'big.md')).ok).toBe(false);
  });
});

describe('toContentParts', () => {
  it('encodes files as AG-UI parts with the file name', async () => {
    const parts = await toContentParts([new File(['Привет'], 'a.md')]);
    expect(parts).toEqual([
      {
        type: 'document',
        source: {
          type: 'data',
          value: btoa(String.fromCharCode(...new TextEncoder().encode('Привет'))),
          mimeType: 'text/markdown',
        },
        metadata: { filename: 'a.md' },
      },
    ]);
  });
});
