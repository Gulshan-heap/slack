import { atom, useAtom } from "jotai";

const modalState = atom(false);

export const useInviteModal = () => {
  return useAtom(modalState);
};
