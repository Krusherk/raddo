import { Buffer } from 'buffer';
// @ts-ignore
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';
import './index.css';
import { MONAD_CHAIN } from './config/contract';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PrivyProvider
            appId="cmjcmiiki01h1l70c34v067nj"
            config={{
                loginMethods: ['email'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#00d4aa',
                    logo: '',
                },
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'all-users'
                    }
                },
                defaultChain: MONAD_CHAIN,
                supportedChains: [MONAD_CHAIN]
            }}
        >
            <App />
        </PrivyProvider>
    </React.StrictMode>
);
