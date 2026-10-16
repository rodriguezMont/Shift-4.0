import type { SlotStatus } from '@shift40/sim';

/** Placeholder palette shared by the 3D scene and the 2D debug view, until branding lands. */
export const palette = {
  background: '#eef0f3',
  floor: '#d9dce1',
  inboundZone: '#f2e3c4',
  outboundZone: '#cfe3d6',
  dockMarker: '#f5c242',
  rackUpright: '#e0662f',
  rackShelf: '#9aa3ae',
  box: '#d9a066',
  operatorBody: '#2f6fb0',
  operatorLegs: '#1f3550',
  operatorSkin: '#f1c7a1',
  helmet: '#f5c242',
  truckTrailer: '#f4f5f7',
  truckCab: '#2b3340',
  truckDoor: '#b9c0c9',
  truckInterior: '#1a1d22',
  dockFrame: '#5b6575',
  route: '#2f6fb0',
  wall: '#aeb5bf',
  canteenFloor: '#e6d2b5',
  cafeFloor: '#e3d8cc',
  robotFloor: '#c7d0da',
  furnitureWood: '#b07a4a',
  furnitureLight: '#f2f3f5',
  furnitureDark: '#3a3f47',
  conveyorBelt: '#2b3038',
  conveyorFrame: '#8a939e',
  charge: '#38bdf8',
} as const;

export const slotColors: Record<SlotStatus, string> = {
  empty: palette.rackShelf,
  incoming: '#f1d9b5',
  stored: palette.box,
  outgoing: '#a8743f',
};
