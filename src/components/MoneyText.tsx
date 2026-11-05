/** Angka rupiah dengan "Rp" lebih kecil di depan (gaya kartu saldo). Teks lain (mis. angka disamarkan) tampil apa adanya. */
export function MoneyText({ value, className = '' }: { value: string; className?: string }) {
  const m = /^([−-]?)Rp\s*(.*)$/.exec(value);
  if (!m) return <span className={className}>{value}</span>;
  return (
    <span className={className}>
      {m[1]}
      <span className="align-baseline text-[0.5em] font-semibold opacity-80">Rp</span>{' '}
      {m[2]}
    </span>
  );
}
