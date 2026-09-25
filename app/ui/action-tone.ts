/** Literal Tailwind classes keep action colors available in production builds. */
export function actionTone(action: string) {
  const label = action.toUpperCase();
  if (/PUT/.test(label)) return {icon:"↘",classes:"border-fuchsia-400! bg-fuchsia-50! text-fuchsia-950!"};
  if (/CALL/.test(label)) return {icon:"↗",classes:"border-indigo-400! bg-indigo-50! text-indigo-950!"};
  if (/TRIM|REDUCE|TAKE_PROFIT/.test(label)) return {icon:"−",classes:"border-amber-400! bg-amber-50! text-amber-950!"};
  if (/SELL/.test(label)) return {icon:"↓",classes:"border-red-400! bg-red-50! text-red-950!"};
  if (/REBUY|RELOAD/.test(label)) return {icon:"↻",classes:"border-cyan-400! bg-cyan-50! text-cyan-950!"};
  if (/BUY|ADD/.test(label)) return {icon:"↑",classes:"border-emerald-400! bg-emerald-50! text-emerald-950!"};
  return {icon:"Ⅱ",classes:"border-slate-300! bg-slate-50! text-slate-900!"};
}
