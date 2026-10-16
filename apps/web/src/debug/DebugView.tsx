import { cellsOf, operatorPosition, type FurnitureKind, type Point, type Rect } from '@shift40/sim';
import { useEffect, useRef } from 'react';
import { useRunner } from '../simulation/context';
import type { SimulationRunner } from '../simulation/runner';
import { palette, slotColors } from '../palette';

/** Small enough for the whole 26 × 26 plan to fit beside the HUD on a laptop screen. */
const CELL = 22;

const FURNITURE_COLORS: Record<FurnitureKind, string> = {
  table: palette.furnitureWood,
  bistroTable: palette.furnitureWood,
  fridge: palette.furnitureLight,
  counter: palette.furnitureLight,
  coffeeMachine: palette.furnitureDark,
};

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
  const { floor, dockZoneColumns, staffRooms, robotArea } = warehouse;
  const center = (point: Point): [number, number] => [
    (point.x + 0.5) * CELL,
    (point.y + 0.5) * CELL,
  ];
  const fill = (color: string, { x, y, width, height }: Rect, inset = 0) => {
    context.fillStyle = color;
    context.fillRect(
      x * CELL + inset,
      y * CELL + inset,
      width * CELL - 2 * inset,
      height * CELL - 2 * inset,
    );
  };
  const cell = (point: Point): Rect => ({ ...point, width: 1, height: 1 });

  context.fillStyle = palette.wall;
  context.fillRect(0, 0, warehouse.grid.width * CELL, warehouse.grid.height * CELL);
  fill(palette.floor, floor);
  fill(palette.inboundZone, { ...floor, width: dockZoneColumns });
  fill(palette.outboundZone, {
    ...floor,
    x: floor.x + floor.width - dockZoneColumns,
    width: dockZoneColumns,
  });
  fill(palette.robotFloor, robotArea.bounds);
  for (const room of staffRooms) {
    fill(room.kind === 'canteen' ? palette.canteenFloor : palette.cafeFloor, room.bounds);
    for (const gap of room.doorway) {
      fill(room.kind === 'canteen' ? palette.canteenFloor : palette.cafeFloor, cell(gap));
    }
    for (const piece of room.furniture) {
      for (const part of cellsOf(piece.cells)) fill(FURNITURE_COLORS[piece.kind], cell(part), 2);
    }
    context.strokeStyle = palette.furnitureWood;
    context.lineWidth = 1.5;
    for (const place of room.places) {
      context.beginPath();
      context.arc(...center(place), CELL * 0.28, 0, Math.PI * 2);
      context.stroke();
    }
    // Queue spots beside the door, where people wait when every place is taken.
    context.setLineDash([3, 3]);
    for (const spot of room.queue) {
      context.strokeRect(spot.x * CELL + 4, spot.y * CELL + 4, CELL - 8, CELL - 8);
    }
    context.setLineDash([]);
  }
  for (const part of robotArea.conveyor) fill(palette.conveyorBelt, cell(part), 3);
  fill(palette.charge, cell(robotArea.capsule), 5);
  for (const pad of robotArea.chargingPads) fill(palette.charge, cell(pad), 6);

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
