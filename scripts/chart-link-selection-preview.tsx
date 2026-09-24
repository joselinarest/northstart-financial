import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useChartLinkSelection} from '../app/use-chart-link-selection';
function Preview(){const[symbol,setSymbol]=useState('NVDA'),[lookup,setLookup]=useState(''),[frame,setFrame]=useState('1Y');useChartLinkSelection('Professional Charts',setSymbol,setLookup,setFrame);return <output>{symbol}|{lookup}|{frame}</output>}
createRoot(document.getElementById('root')!).render(<Preview/>);
