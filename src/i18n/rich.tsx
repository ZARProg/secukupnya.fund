import { Fragment, type ReactNode } from 'react';

/**
 * Ubah teks terjemahan yang memuat tag sederhana menjadi elemen React.
 * Contoh: rich('Pasang <b>versi {v}</b>', { b: (c) => <strong>{c}</strong> }) setelah {v} diisi lewat t().
 * Tag tidak boleh bersarang. Tag yang tidak ada di `tags` ditampilkan apa adanya sebagai teks.
 */
export function rich(text: string, tags: Record<string, (children: string) => ReactNode>): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    const [whole, tag, inner] = match;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(tags[tag] ? <Fragment key={i++}>{tags[tag](inner)}</Fragment> : whole);
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, index) => (typeof part === 'string' ? <Fragment key={`t${index}`}>{part}</Fragment> : part));
}
