const NOK_FORMATTER = new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNOK(amountInOre: number): string {
  const kroner = amountInOre / 100;
  return `${NOK_FORMATTER.format(kroner)} kr`;
}

export function formatNOKSigned(amountInOre: number): string {
  const kroner = amountInOre / 100;
  const formatted = NOK_FORMATTER.format(Math.abs(kroner));
  if (amountInOre < 0) {
    return `-${formatted} kr`;
  }
  if (amountInOre > 0) {
    return `+${formatted} kr`;
  }
  return `${formatted} kr`;
}

export function parseNOK(input: string): number {
  // Remove currency suffix, spaces, and convert comma to dot
  const cleaned = input
    .replace(/kr/gi, '')
    .replace(/NOK/gi, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const kroner = parseFloat(cleaned);
  if (isNaN(kroner)) {
    return 0;
  }
  return Math.round(kroner * 100);
}
