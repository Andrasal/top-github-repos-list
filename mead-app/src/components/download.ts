/** Save a generated file: via the Claude artifact `downloads` capability when hosted there, else a normal browser download. */
type DownloadsApi = { save: (r: { filename: string; data: Blob | ArrayBuffer | string }) => Promise<{ status: string }> };
type ClaudeGlobal = { use: (name: string) => Promise<unknown> };

export async function saveFile(filename: string, data: Blob): Promise<'saved' | 'declined' | 'failed'> {
  const claude = (window as unknown as { claude?: ClaudeGlobal }).claude;
  if (claude?.use) {
    const dl = (await claude.use('downloads').catch(() => null)) as DownloadsApi | null;
    if (dl) {
      try {
        await dl.save({ filename, data });
        return 'saved';
      } catch (e) {
        return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed';
      }
    }
  }
  try {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

export async function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallback) {
      fallback.hidden = false;
      fallback.value = text;
      fallback.select();
    }
    return false;
  }
}
