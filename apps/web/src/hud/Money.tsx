import { formatMoney } from './format';

interface MoneyProps {
  readonly amount: number;
  /** Also mark gains with a plus sign, e.g. ledger lines. */
  readonly signed?: boolean;
}

/** A dollar amount, in red when it is a loss or a debt. */
export function Money({ amount, signed = false }: MoneyProps) {
  // Judged on the displayed whole dollars, so an amount that rounds to $0 is not red.
  const negative = Math.round(amount) < 0;
  return (
    <span className={negative ? 'money-negative' : undefined}>
      {formatMoney(amount, { signed })}
    </span>
  );
}
