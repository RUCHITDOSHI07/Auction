export interface AuctionLedgerTransaction {
  transactionId?: string;
  reversesTransactionId?: string;
  type?: "purchase" | "reversal" | "correction";
}

export function getEffectiveAuctionPurchases<T extends AuctionLedgerTransaction>(
  transactions: T[],
  excludedTransactionId?: string,
): T[] {
  const reversedTransactionIds = new Set(
    transactions
      .filter((transaction) => transaction.type === "reversal" || transaction.type === "correction")
      .map((transaction) => transaction.reversesTransactionId)
      .filter((transactionId): transactionId is string => Boolean(transactionId)),
  );

  return transactions.filter((transaction) =>
    (transaction.type === undefined || transaction.type === "purchase" || transaction.type === "correction") &&
    transaction.transactionId !== excludedTransactionId &&
    (!transaction.transactionId || !reversedTransactionIds.has(transaction.transactionId)),
  );
}