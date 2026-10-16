import { operatorPosition, type Point } from '@shift40/sim';
import { useEffect, useRef } from 'react';
import { useRunner } from '../simulation/context';
import type { SimulationRunner } from '../simulation/runner';
import { palette, slotColors } from '../palette';

const CELL = 28;

/** Flat top-down view of the raw simulation: the ground truth the 3D scene must match. */
export function DebugView() {
  const runner = useRunner();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const { width, height } = runner.warehouse.grid;
    const ratio = window.devicePixelRatio;
    canvas.width = width * CELL * ratio;
    canvas.height = height * CELL * ratio;
    canvas.style.width = `${String(width * CELL)}px`;
    canvas.style.height = `${String(height * CELL)}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    let frameId = 0;
    const render = () => {
      drawFrame(context, runner);
      frameId = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [runner]);

  return (
    <div className="debug-view">
      <canvas ref={canvasRef} aria-label="Top-down debug view of the warehouse simulation" />
    </div>
  );
}

function drawFrame(context: CanvasRenderingContext2D, runner: SimulationRunner): void {
  const { warehouse } = runner;
  const state = runner.getState();
  const { width, height } = warehouse.grid;
  const zone = warehouse.dockZoneColumns * CELL;
  const center = (point: Point): [number, number] => [
    (point.x + 0.5) * CELL,
    (point.y + 0.5) * CELL,
  ];

  context.fillStyle = palette.floor;
  context.fillRect(0, 0, width * CELL, height * CELL);
  context.fillStyle = palette.inboundZone;
  context.fillRect(0, 0, zone, height * CELL);
  context.fillStyle = palette.outboundZone;
  context.fillRect(width * CELL - zone, 0, zone, height * CELL);

  context.fillStyle = palette.dockMarker;
  for (const dock of [...warehouse.inboundDocks, ...warehouse.outboundDocks]) {
    context.fillRect(dock.x * CELL + 4, dock.y * CELL + 4, CELL - 8, CELL - 8);
  }

  for (const slot of warehouse.slots) {
    context.fillStyle = slotColors[state.slots[slot.id] ?? 'empty'];
    context.fillRect(slot.rack.x * CELL + 1, slot.rack.y * CELL + 1, CELL - 2, CELL - 2);
  }

  state.operators.forEach((operator) => {
    const position = runner.operatorAt(operator.id) ?? operatorPosition(operator);

    context.strokeStyle = palette.route;
    context.globalAlpha = 0.5;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(...center(position));
    for (const cell of [operator.to, ...operator.path]) context.lineTo(...center(cell));
    context.stroke();
    context.globalAlpha = 1;

    context.fillStyle = palette.operatorBody;
    context.beginPath();
    context.arc(...center(position), CELL * 0.32, 0, Math.PI * 2);
    context.fill();
    if (operator.carrying) {
      const [x, y] = center(position);
      context.fillStyle = palette.box;
      context.fillRect(x - 5, y - 5, 10, 10);
    }
  });
}
