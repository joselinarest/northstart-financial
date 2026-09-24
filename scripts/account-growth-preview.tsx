import React from 'react';import {createRoot} from 'react-dom/client';import AccountGrowthChart from '../app/account-growth-chart';
createRoot(document.getElementById('root')!).render(<AccountGrowthChart accountId="test-account" accessToken=""/>);
