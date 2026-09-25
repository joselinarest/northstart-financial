export function strategyForPurpose(purpose: string) {
  return ({Swing:'SWING',Options:'SWING','Long-term':'GROWTH_5_7',Retirement:'RETIREMENT','Dividend income':'DIVIDEND_INCOME',Mixed:'CUSTOM'} as Record<string,string>)[purpose];
}
