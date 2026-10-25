/**
 * Read a folder dropped onto the page into a file list.
 *
 * Two traps, both only visible on big worlds:
 *   - `readEntries` returns at most 100 entries per call and must be called until it
 *     returns an empty array. Calling it once means worlds with many players **silently
 *     miss** some player files.
 *   - Dropped `File`s always have an empty `webkitRelativePath`, while finding and reading
 *     worlds both rely on it to find their way. Filling in the real path makes the picker
 *     and drag-and-drop go through the same code afterwards.
 */

function readDirEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

/** Recursively read a dropped directory, with the path filled in on `webkitRelativePath`. */
async function walkEntry(entry: FileSystemEntry, prefix: string, out: File[]): Promise<void> {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    Object.defineProperty(file, "webkitRelativePath", { value: path });
    out.push(file);
    return;
  }

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await readDirEntries(reader);
    if (batch.length === 0) break;
    await Promise.all(batch.map((e) => walkEntry(e, path, out)));
  }
}

/**
 * Turn a drop event into a file list. A `DataTransferItemList` becomes invalid once the
 * event handler yields, so entries must be collected **synchronously** before recursing.
 */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of dt.items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  // Without webkitGetAsEntry, fall back to the flat file list: users can still select every
  // file inside the world directory and drop them, they just have to go into it first.
  if (entries.length === 0) return [...dt.files];

  const out: File[] = [];
  await Promise.all(entries.map((entry) => walkEntry(entry, "", out)));
  return out;
}
