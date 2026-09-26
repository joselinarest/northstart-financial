export function strategyForPurpose(purpose: string) {
  return ({Swing:'SWING',Options:'OPTIONS','Long-term':'LONG_TERM','Long-term ETF':'LONG_TERM_ETF',Retirement:'LONG_TERM','Dividend income':'DIVIDEND_INCOME',Mixed:'SWING'} as Record<string,string>)[purpose];
}

