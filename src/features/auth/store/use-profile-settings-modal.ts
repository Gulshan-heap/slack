import { atom, useAtom } from "jotai";

const modalState = atom(false);

export const useProfileSettingsModal = () => {
  return useAtom(modalState);
};
