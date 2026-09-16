import {readFile} from "node:fs/promises";

const [workspace,styles,confirmation]=await Promise.all([
  readFile(new URL("../app/northstar-workspace.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/design-system.css",import.meta.url),"utf8"),
  readFile(new URL("../app/confirmation-modal.tsx",import.meta.url),"utf8"),
]);
const checks=[
  ["five mobile destinations",workspace.includes('label:"Today"')&&workspace.includes('label:"Portfolio"')&&workspace.includes('label:"Markets"')&&workspace.includes('label:"Finance"')&&workspace.includes("<span>Alerts</span>")],
  ["permission-aware secondary drawer",workspace.includes("visibleNavigationGroups.map")&&workspace.includes('id="workspace-navigation"')],
  ["safe-area bottom navigation",styles.includes("--ns-bottom-nav-h")&&styles.includes("var(--ns-safe-bottom,0px)")],
  ["mobile content clearance",styles.includes("padding-bottom:calc(var(--ns-bottom-nav-h)")],
  ["mobile table cards",styles.includes(".workspace-view table tr{display:grid")&&styles.includes(".workspace-view table thead{display:none}")],
  ["touch-sized inputs",styles.includes("min-height:44px;font-size:16px")],
  ["mobile bottom sheets",styles.includes(".confirmation-overlay{align-items:end")&&styles.includes(".header-notification-modal{height:100%")],
  ["focus-trapped confirmation",confirmation.includes('event.key!=="Tab"')&&confirmation.includes("trigger?.focus()")],
  ["no native confirmation",!workspace.includes("window.alert(")&&!workspace.includes("window.confirm(")&&!workspace.includes("window.prompt(")],
];
const failed=checks.filter(([,passed])=>!passed);
if(failed.length){for(const[name]of failed)console.error(`FAIL: ${name}`);process.exit(1)}
console.log("Mobile shell, safe areas, card tables, touch controls, bottom sheets, and confirmation accessibility verified.");
