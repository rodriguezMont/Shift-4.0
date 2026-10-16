import {
  dismissBlocker,
  hireBlocker,
  operatorById,
  shiftClock,
  type ActionError,
  type Operator,
} from '@shift40/sim';
import { useRunner, useSimState } from '../simulation/context';
import { useSelection } from '../simulation/selection';
import { formatMinuteOfDay } from './format';
import { Money } from './Money';

/** Player-facing reasons for a refused action. */
const BLOCKED_BECAUSE: Record<ActionError, string> = {
  invalidAction: 'Not a valid action',
  shiftOver: 'The shift is over',
  wrongTick: 'Try again',
  cannotAfford: 'Not enough cash',
  teamFull: 'Every place on the team is taken',
  unknownOperator: 'Not on the floor',
  alreadyLeaving: 'Already leaving',
  lastOperator: 'The last operator has to stay',
};

/** Hiring, who is on the way in or out, and the selected operator's card. */
export function Team() {
  const runner = useRunner();
  const state = useSimState();
  const { level } = runner.world;
  const { operatorId, select } = useSelection();
  const hireError = hireBlocker(runner.world, state);
  const selected = operatorId === null ? null : operatorById(state.operators, operatorId);
  const leaving = state.operators.filter((operator) => operator.leaving).length;
  const nextArrival = state.arrivals[0];

  return (
    <section className="hud-team" aria-label="Team">
      <h2>Team</h2>
      {(nextArrival !== undefined || leaving > 0) && (
        <p className="hud-next">
          {nextArrival !== undefined &&
            `${String(state.arrivals.length)} arriving · next ${formatMinuteOfDay(
              shiftClock(level, nextArrival.tick).minuteOfDay,
            )}`}
          {nextArrival !== undefined && leaving > 0 && ' · '}
          {leaving > 0 && `${String(leaving)} leaving`}
        </p>
      )}
      <button
        type="button"
        disabled={hireError !== null}
        onClick={() => {
          runner.act({ kind: 'hire' });
        }}
      >
        Hire · <Money amount={level.economy.hiringFee} />
      </button>
      {hireError !== null && hireError !== 'shiftOver' && (
        <p className="hud-hint">{BLOCKED_BECAUSE[hireError]}</p>
      )}
      {/* The keyboard path to the same selection a click on a figure makes. */}
      <select
        aria-label="Selected operator"
        value={selected === null ? '' : String(selected.id)}
        onChange={(event) => {
          select(event.target.value === '' ? null : Number(event.target.value));
        }}
      >
        <option value="">Click or choose an operator</option>
        {state.operators.map((operator) => (
          <option key={operator.id} value={operator.id}>
            Operator {operator.id + 1}
          </option>
        ))}
      </select>
      {selected !== null && <OperatorCard operator={selected} />}
    </section>
  );
}

function OperatorCard({ operator }: { readonly operator: Operator }) {
  const runner = useRunner();
  const state = useSimState();
  const { select } = useSelection();
  const error = dismissBlocker(runner.world, state, operator.id);

  return (
    <div className="hud-card" aria-label={`Operator ${String(operator.id + 1)}`}>
      <div className="hud-card-header">
        <strong>Operator {operator.id + 1}</strong>
        <button
          type="button"
          className="hud-close"
          aria-label="Clear selection"
          onClick={() => {
            select(null);
          }}
        >
          ×
        </button>
      </div>
      <p>
        {statusOf(operator)} · {Math.round(operator.energy * 100)}% energy
      </p>
      {/* Someone already on the way out needs no dismiss button. */}
      {!operator.leaving && (
        <>
          <button
            type="button"
            disabled={error !== null}
            onClick={() => {
              runner.act({ kind: 'dismiss', operatorId: operator.id });
            }}
          >
            Dismiss · <Money amount={runner.world.level.economy.dismissalCost} />
          </button>
          {error !== null && error !== 'shiftOver' && (
            <p className="hud-hint">{BLOCKED_BECAUSE[error]}</p>
          )}
        </>
      )}
    </div>
  );
}

function statusOf(operator: Operator): string {
  if (operator.leaving) return 'Leaving';
  if (operator.phase === 'resting' || operator.phase === 'toBreak') return 'On a break';
  if (operator.task?.kind === 'putaway') return 'Unloading a truck';
  if (operator.task?.kind === 'dispatch') return 'Picking an order';
  return 'Idle';
}
