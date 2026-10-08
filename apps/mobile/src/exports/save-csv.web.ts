export async function saveCsv(content: string, filename: string): Promise<'saved'> {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  try {
    document.body.appendChild(link);
    link.click();
    return 'saved';
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
