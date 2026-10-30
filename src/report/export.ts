import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { dayKey } from '../lib/dates';

async function ensureSharing(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device, so the report cannot be exported.');
  }
}

function cachePath(fileName: string): string {
  return `${FileSystem.cacheDirectory ?? ''}${fileName}`;
}

export function reportFileName(childName: string, from: Date, to: Date, ext: 'pdf' | 'csv'): string {
  const safe = childName.replace(/[^A-Za-z0-9_-]/g, '') || 'child';
  return `seizure-log_${safe}_${dayKey(from)}_${dayKey(to)}.${ext}`;
}

export async function exportPdf(html: string, fileName: string): Promise<void> {
  await ensureSharing();
  const { uri } = await Print.printToFileAsync({ html });
  const dest = cachePath(fileName);
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share seizure log report',
  });
}

export async function exportCsv(csv: string, fileName: string): Promise<void> {
  await ensureSharing();
  const dest = cachePath(fileName);
  await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(dest, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Share seizure log CSV',
  });
}
