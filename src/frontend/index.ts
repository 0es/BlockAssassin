import { WebUI } from "https://deno.land/x/webui/mod.ts";

const win = new WebUI();
win.show('<html><script src="webui.js"></script> Hello World from Deno! </html>');
await WebUI.wait();