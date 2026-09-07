import { atom, useAtom } from "jotai";

const paletteState = atom(false);

export const useCommandPalette = () => {
  return useAtom(paletteState);
};
