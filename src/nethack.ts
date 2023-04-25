// @ts-ignore
import nethackLib from "../lib/nethack";
import { MENU_SELECT, STATUS_FIELD, WIN_TYPE } from "./generated";
import { Command, MenuItem, NetHackGodot, NetHackJS, Status } from "./models";

import { Subject, debounceTime, firstValueFrom, tap } from "rxjs";

declare global {
  interface Window {
    nethackCallback: any;

    nethackJS: NetHackJS;
    nethackGodot: NetHackGodot;

    nethackGlobal: {
      helpers: Record<string, Function>;
    };

    // For debugging
    windows: any;
  }
}

const ignored = [
  Command.INIT_WINDOW,
  Command.STATUS_INIT,
  Command.CLEAR_WINDOW,
];

let idCounter = 0;
let menu: MenuItem[] = [];
let menu_prompt = "";
let putStr = "";

const status: Status = {};
const selectedMenu$ = new Subject<any[]>();
const statusChange$ = new Subject<Status>();

const windowTypes: Record<number, WIN_TYPE> = {};
window.windows = windowTypes;

statusChange$
  .pipe(
    debounceTime(300),
    tap(() => console.log("Update status", status))
  )
  .subscribe(() => window.nethackGodot.updateStatus(status));

window.nethackJS = {
  selectMenu: (items) => selectedMenu$.next(items),
};

const statusMap: Partial<Record<STATUS_FIELD, (s: Status, v: any) => void>> = {
  [STATUS_FIELD.BL_TITLE]: (s, v) => (s.title = v),
  [STATUS_FIELD.BL_STR]: (s, v) => (s.str = v),
  [STATUS_FIELD.BL_DX]: (s, v) => (s.dex = v),
  [STATUS_FIELD.BL_CO]: (s, v) => (s.con = v),
  [STATUS_FIELD.BL_IN]: (s, v) => (s.int = v),
  [STATUS_FIELD.BL_WI]: (s, v) => (s.wis = v),
  [STATUS_FIELD.BL_CH]: (s, v) => (s.cha = v),
  [STATUS_FIELD.BL_ALIGN]: (s, v) => (s.align = v),
  [STATUS_FIELD.BL_SCORE]: (s, v) => (s.score = v),
  [STATUS_FIELD.BL_CAP]: (s, v) => (s.carryCap = v),
  [STATUS_FIELD.BL_GOLD]: (s, v) => (s.gold = v),
  [STATUS_FIELD.BL_ENE]: (s, v) => (s.power = v),
  [STATUS_FIELD.BL_ENEMAX]: (s, v) => (s.powerMax = v),
  [STATUS_FIELD.BL_XP]: (s, v) => (s.expLvl = v),
  [STATUS_FIELD.BL_AC]: (s, v) => (s.armor = v),
  [STATUS_FIELD.BL_HUNGER]: (s, v) => (s.hunger = v),
  [STATUS_FIELD.BL_HP]: (s, v) => (s.hp = v),
  [STATUS_FIELD.BL_HPMAX]: (s, v) => (s.hpMax = v),
  [STATUS_FIELD.BL_LEVELDESC]: (s, v) => (s.dungeonLvl = v),
  [STATUS_FIELD.BL_EXP]: (s, v) => (s.exp = v),
  [STATUS_FIELD.BL_CONDITION]: (s, v) => (s.condition = v),
};

const commandMap: Partial<Record<Command, (...args: any[]) => Promise<any>>> = {
  [Command.CREATE_WINDOW]: async (...args: any[]) => {
    const id = idCounter++;
    const type = args[0];
    windowTypes[id] = type;
    console.log("Create new window of type", type, "with id", id);
    return id;
  },
  [Command.MENU_START]: async (...args: any[]) => {
    menu = [];
  },
  [Command.MENU_ADD]: async (...args: any[]) => {
    menu.push({
      glyph: args[1],
      identifier: args[2],
      accelerator: args[3],
      groupAcc: args[4],
      attr: args[5],
      str: args[6],
    });
  },
  [Command.MENU_END]: async (...args: any[]) => {
    menu_prompt = args[1];
  },
  [Command.MENU_SELECT]: async (...args: any[]) => {
    const select = args[1] as MENU_SELECT;
    const selected = args[2] as any[];
    if (menu.length > 0 && select != MENU_SELECT.PICK_NONE) {
      if (select == MENU_SELECT.PICK_ANY) {
        window.nethackGodot.openMenuAny(menu_prompt, ...menu);
      } else if (select == MENU_SELECT.PICK_ONE) {
        window.nethackGodot.openMenuOne(menu_prompt, ...menu);
      }

      console.log(`Waiting for menu select (${select}): `, menu);
      const items = await firstValueFrom(selectedMenu$);
      items.forEach((x) => selected.push({ item: x, count: 1 }));
      return items.length;
    }

    return 0;
  },
  [Command.PRINT_TILE]: async (...args: any[]) => {
    window.nethackGodot.printTile(args[1], args[2], args[3]);
  },
  [Command.CURSOR]: async (...args: any[]) => {
    window.nethackGodot.moveCursor(args[1], args[2]);
  },
  [Command.CLIPAROUND]: async (...args: any[]) => {
    window.nethackGodot.centerView(args[0], args[1]);
  },
  [Command.STATUS_UPDATE]: async (...args: any[]) => {
    const type = args[0] as STATUS_FIELD;
    const mapper = statusMap[type];
    if (mapper) {
      const ptr = args[1];
      let value;
      if (type == STATUS_FIELD.BL_CONDITION) {
        value = window.nethackGlobal.helpers.getPointerValue("", ptr, "n");
      } else {
        // console.log("Values for pointer", ptr, STATUS_FIELD[type]);
        // ["s", "p", "c", "0", "1", "n", "f", "d", "o"].forEach((t) => {
        //   console.log(window.nethackGlobal.helpers.getPointerValue("", ptr, t));
        // });
        value = window.nethackGlobal.helpers.getPointerValue("", ptr, "n");
      }
      mapper(status, value);
      statusChange$.next(status);
    }
  },
  [Command.PUTSTR]: async (...args: any[]) => {
    putStr += args[1];
  },
  [Command.DISPLAY_WINDOW]: async (...args: any[]) => {
    if (putStr !== "") {
      const type = windowTypes[args[0]];
      if (type == WIN_TYPE.NHW_MENU) {
        console.log("Show Menu Text", putStr);
        window.nethackGodot.showMenuText(putStr);
      } else if (type == WIN_TYPE.NHW_TEXT) {
        console.log("Show Full Text", putStr);
        window.nethackGodot.showFullText(putStr);
      } else {
        console.warn("There was data for window type", type, "but no handler");
      }
      putStr = "";
    }
  },
};

window.nethackCallback = async (cmd: Command, ...args: string[]) => {
  if (ignored.includes(cmd)) {
    return 0;
  }

  const fn = commandMap[cmd];
  if (fn) {
    return await fn(...args);
  }

  // TODO: Unhandled commands
  console.log(cmd, args);
  switch (cmd) {
    case Command.GET_HISTORY:
      return "";
    case Command.YN_FUNCTION:
    case Command.MESSAGE_MENU:
      return 121; // y in ascii
  }

  return 0;
};

const Module: any = {
  onRuntimeInitialized: () => {
    Module.ccall(
      "shim_graphics_set_callback",
      null,
      ["string"],
      ["nethackCallback"],
      {
        async: true,
      }
    );
  },
};

nethackLib(Module);
