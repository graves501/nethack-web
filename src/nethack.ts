import { selectItems, toTile } from "./helper/nethack-util";
import { NetHackWrapper } from "./nethack-wrapper";

const options = [
  "showexp",
  "perm_invent",
  "autopickup",
  "pickup_types:$",
  "pickup_thrown",
  "pickup_burden:S",
  "autoopen",
  "!cmdassist",
  "sortloot:full",
  "time",
];

const Module: any = {};
Module.onRuntimeInitialized = () => {
  Module.ccall("shim_graphics_set_callback", null, ["string"], ["nethackCallback"], {
    async: true,
  });
};
Module.preRun = [
  () => {
    // Module.ENV["USER"] = "web_user"; // TODO: get name
    Module.ENV.NETHACKOPTIONS = options.join(",");
  },
];

window.module = Module;
window.nethackJS = new NetHackWrapper(true, Module, { selectItems, toTile });
