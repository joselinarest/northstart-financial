import {readFile} from "node:fs/promises";

const [workspace,styles,confirmation,predictionStyles,responsiveStyles,layoutStyles]=await Promise.all([
  readFile(new URL("../app/northstar-workspace.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/design-system.css",import.meta.url),"utf8"),
  readFile(new URL("../app/confirmation-modal.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/professional-prediction-overlay.css",import.meta.url),"utf8"),
  readFile(new URL("../app/responsive-mobile.css",import.meta.url),"utf8"),
  readFile(new URL("../app/layout-system.css",import.meta.url),"utf8"),
]);
const checks=[
  ["five mobile destinations",/["']Today["']/.test(workspace)&&/["']Portfolio["']/.test(workspace)&&/["']Markets["']/.test(workspace)&&/["']Finance["']/.test(workspace)&&workspace.includes("<span>Alerts</span>")],
  ["permission-aware secondary drawer",workspace.includes("visibleNavigationGroups.map")&&workspace.includes('id="workspace-navigation"')],
  ["safe-area bottom navigation",styles.includes("--ns-bottom-nav-h")&&styles.includes("var(--ns-safe-bottom,0px)")],
  ["mobile content clearance",styles.includes("padding-bottom:calc(var(--ns-bottom-nav-h)")],
  ["mobile table cards",styles.includes(".workspace-view table tr{display:grid")&&styles.includes(".workspace-view table thead{display:none}")],
  ["touch-sized inputs",styles.includes("min-height:44px;font-size:16px")],
  ["mobile bottom sheets",styles.includes(".confirmation-overlay{align-items:end")&&styles.includes(".header-notification-modal{height:100%")],
  ["focus-trapped confirmation",confirmation.includes('event.key!=="Tab"')&&confirmation.includes("trigger?.focus()")],
  ["no native confirmation",!workspace.includes("window.alert(")&&!workspace.includes("window.confirm(")&&!workspace.includes("window.prompt(")],
  ["projected future candles",workspace.includes("prediction-candles")&&workspace.includes("PROJECTED CANDLES")],
  ["mobile chart reserves forecast region",predictionStyles.includes("inset:18px 44% 0 32px!important")&&!responsiveStyles.includes(".candle-field{min-width:0!important;width:100%!important")],
  ["native mobile document scrolling",styles.includes("body:has(>.workspace-view){height:auto!important")&&styles.includes("overflow-y:visible!important")&&responsiveStyles.includes("overflow-y:visible")],
  ["live mobile market countdown",workspace.includes('className="mobile-market-countdown"')&&/marketClock\.isOpen\s*\?\s*"CLOSES"\s*:\s*"OPENS"/.test(workspace)&&/mobile-market-countdown\{display:block!important/.test(styles)],
  ["single mobile account selector",layoutStyles.includes(".workspace-view .account-scope-switcher{display:none!important}")],
  ["no page-level horizontal scrolling",layoutStyles.includes("html,body,.workspace-view{overflow-x:clip}")],
];
const failed=checks.filter(([,passed])=>!passed);
if(failed.length){for(const[name]of failed)console.error(`FAIL: ${name}`);process.exit(1)}
console.log("Mobile shell, safe areas, card tables, touch controls, bottom sheets, and confirmation accessibility verified.");
