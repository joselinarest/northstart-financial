/** Legacy goal-as-strategy values remain readable; new edits separate both fields. */
export function accountProfile(account: Record<string, any>) {
  const legacy: Record<string, string> = {RETIREMENT:'Retirement', CHILD_GROWTH:'Future Wealth', COLLEGE:'Education', HOUSE_FUND:'House Purchase'};
  const raw = String(account.strategy_type || account.strategyType || 'LONG_TERM');
  let policy: Record<string, any> = {};
  try { policy = typeof account.policy_json === 'string' ? JSON.parse(account.policy_json) : account.policy_json || account.policy || {}; } catch {}
  return {strategy: legacy[raw] || raw === 'GROWTH_5_7' ? 'LONG_TERM' : raw,
    goal: account.goal_name || account.goalName || legacy[raw] || 'Build wealth',
    taxWrapper: policy.taxWrapper || ''};
}
export const accountStrategies = [['SWING','Swing'],['OPTIONS','Options'],['LONG_TERM','Long-Term'],['LONG_TERM_ETF','Long-Term ETF'],['AGGRESSIVE_GROWTH','Aggressive Growth'],['DIVIDEND_INCOME','Dividend Income'],['CAPITAL_PRESERVATION','Capital Preservation'],['CUSTOM','Custom']];
export const taxWrappers = ['','ROTH_IRA','TRADITIONAL_IRA','401K','529','UTMA','UGMA','TAXABLE'];
