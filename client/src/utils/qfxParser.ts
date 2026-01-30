// QFX/OFX Parser
// QFX is Quicken's variant of OFX (Open Financial Exchange)
// It's an SGML-based format (not XML)

export interface ParsedTransaction {
  date: string;      // YYYY-MM-DD
  amount: number;    // In cents (integer)
  payee: string;
  memo: string;
  fitId: string;     // Financial Institution Transaction ID
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  accountId?: string;
  error?: string;
}

function parseOFXDate(dateStr: string): string {
  // OFX dates are in format YYYYMMDDHHMMSS or YYYYMMDD
  // Sometimes with timezone: YYYYMMDDHHMMSS[-5:EST]
  const cleanDate = dateStr.replace(/\[.*\]/, '').trim();
  const year = cleanDate.substring(0, 4);
  const month = cleanDate.substring(4, 6);
  const day = cleanDate.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function parseOFXAmount(amountStr: string): number {
  // OFX amounts are decimal strings like "123.45" or "-67.89"
  const amount = parseFloat(amountStr.trim());
  // Convert to cents
  return Math.round(amount * 100);
}

function extractTag(content: string, tagName: string): string | null {
  // OFX uses SGML-style tags without closing tags for simple values
  // e.g., <TRNAMT>-123.45
  const regex = new RegExp(`<${tagName}>([^<]+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractTransactions(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Find all STMTTRN blocks (statement transactions)
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>|$)/gi;
  let match;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];

    const datePosted = extractTag(block, 'DTPOSTED');
    const amount = extractTag(block, 'TRNAMT');
    const fitId = extractTag(block, 'FITID');
    const name = extractTag(block, 'NAME');
    const memo = extractTag(block, 'MEMO');
    const payee = extractTag(block, 'PAYEE');

    if (datePosted && amount && fitId) {
      transactions.push({
        date: parseOFXDate(datePosted),
        amount: parseOFXAmount(amount),
        payee: name || payee || '',
        memo: memo || '',
        fitId: fitId,
      });
    }
  }

  return transactions;
}

function extractAccountId(content: string): string | undefined {
  // Try to find account ID in the OFX
  const acctId = extractTag(content, 'ACCTID');
  return acctId || undefined;
}

export function parseQFX(content: string): ParseResult {
  try {
    // Basic validation - check if it looks like OFX/QFX
    if (!content.includes('<OFX>') && !content.includes('<ofx>')) {
      return {
        transactions: [],
        error: 'Invalid file format. Expected QFX/OFX file.',
      };
    }

    const transactions = extractTransactions(content);
    const accountId = extractAccountId(content);

    if (transactions.length === 0) {
      return {
        transactions: [],
        error: 'No transactions found in file.',
      };
    }

    // Sort by date descending (most recent first)
    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      transactions,
      accountId,
    };
  } catch (error) {
    return {
      transactions: [],
      error: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
