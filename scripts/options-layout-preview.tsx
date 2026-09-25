import React from 'react';
import {createRoot} from 'react-dom/client';
import SwingOptionsAdvisor from '../app/swing-options-advisor';
createRoot(document.getElementById('root')!).render(<main><SwingOptionsAdvisor accountId="fixture" accountName="Fixture Swing" /></main>);
