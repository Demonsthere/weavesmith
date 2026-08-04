/**
 * Hand a blob to the browser as a file. Shared by the JSON, SVG and PNG
 * exports — all three differ only in what they put in the blob.
 *
 * The object URL is revoked immediately after the click: the browser has
 * already taken its own reference by then, and leaving it alive pins the
 * whole blob in memory for the life of the document.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** A pattern name that is safe to hand to a filesystem, plus an extension. */
export function fileNameFor(patternName: string, extension: string): string {
  const stem = patternName.replace(/[^A-Za-z0-9 _-]/g, '').trim() || 'band';
  return `${stem}.${extension}`;
}
