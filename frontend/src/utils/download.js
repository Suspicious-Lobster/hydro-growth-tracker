// Trigger a browser download of in-memory content as a file. Centralizes the
// Blob -> object URL -> anchor click -> revoke dance used by the CSV exporters.
export function downloadBlob(filename, content, mime = 'text/csv;charset=utf-8;') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
