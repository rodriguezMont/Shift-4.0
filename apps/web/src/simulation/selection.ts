import { createContext, useContext } from 'react';

/** The operator the player clicked, shared by the 3D scene and the HUD. View state only. */
export interface Selection {
  readonly operatorId: number | null;
  readonly select: (operatorId: number | null) => void;
}

export const SelectionContext = createContext<Selection | null>(null);

export function useSelection(): Selection {
  const selection = useContext(SelectionContext);
  if (selection === null) throw new Error('useSelection must be used inside <SelectionContext>');
  return selection;
}
