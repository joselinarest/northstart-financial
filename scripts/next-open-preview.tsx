import React from 'react';import {createRoot} from 'react-dom/client';import AccountNextOpenSummary from '../app/account-next-open-summary';
createRoot(document.getElementById('root')!).render(<div><AccountNextOpenSummary accountId="retirement" accountName="Retirement" accessToken=""/><AccountNextOpenSummary accountId="swing" accountName="Swing" accessToken=""/></div>);
