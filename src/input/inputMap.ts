import { keycode } from "use-control";
import KEYS from "use-control/lib/keys";

export { KEYS };

export const inputMap = {
  buttons: {
    finish: [keycode(KEYS.enter)],
    cancel: [keycode(KEYS.escape)],
    deleteItem: [keycode(KEYS.backspace), keycode(KEYS.delete)],
  },
  axes: {},
};
