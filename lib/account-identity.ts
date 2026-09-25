type AccountIdentity = Record<string, unknown>;
export function accountIdentity(account: AccountIdentity) {
  const text = (value: unknown) => String(value ?? '').trim();
  const names = [account.nickname, account.name, account.official_name].map(text).filter(Boolean);
  const name = names.find(value => !/^(investment|investment account|brokerage|account)$/i.test(value)) || names[0] || 'Investment account';
  const mask = text(account.mask).slice(-4);
  const reference = mask ? `Ending ${mask}` : `Northstar ref ${text(account.id).slice(-8)}`;
  const source = text(account.institution_name) || (account.connection_id ? 'Connected account' : 'Manual account');
  return { name, detail: [source, reference, text(account.subtype || account.type), text(account.owner_name || account.manual_owner_name || account.entity_name)].filter(Boolean).join(' · ') };
}
