import { Fragment } from 'react';
import { useEconomy, useRunner } from '../simulation/context';
import { Money } from './Money';

/** Where the shift's money came from and went: the wallet from start to finish. */
export function Ledger() {
  const { world } = useRunner();
  const { ledger, wallet } = useEconomy();
  const changes: readonly (readonly [label: string, amount: number])[] = [
    ['Revenue', ledger.revenue],
    ['Salaries', -ledger.salaries],
    ['Hiring', -ledger.hiringFees],
    ['Dismissals', -ledger.dismissalCosts],
    ['Overdue orders', -ledger.overduePenalties],
    ['Trucks waiting', -ledger.truckWaitPenalties],
  ];

  return (
    <dl aria-label="Wallet breakdown">
      <dt>Starting wallet</dt>
      <dd>
        <Money amount={world.level.economy.startingWallet} />
      </dd>
      {changes.map(([label, amount]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>
            <Money amount={amount} signed />
          </dd>
        </Fragment>
      ))}
      <dt className="ledger-total">Final wallet</dt>
      <dd className="ledger-total">
        <Money amount={wallet} />
      </dd>
    </dl>
  );
}
