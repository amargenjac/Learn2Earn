import React, { useEffect, useState } from 'react';
import { useDAppKitWallet, useDAppKitWalletModal } from '@vechain/vechain-kit';
import { ThorClient } from '@vechain/sdk-network';
import { unitsUtils } from '@vechain/sdk-core';

// Initialize Thor client for testnet (or mainnet)
const thor = ThorClient.at('https://testnet.vechain.org');
// For mainnet: ThorClient.fromUrl('https://mainnet.vechain.org');

function WalletConnection ({ onAccountChange }) {
  const { account, disconnect } = useDAppKitWallet();
  const { open: openModal } = useDAppKitWalletModal();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (account) {
      onAccountChange(account);
      localStorage.setItem('vechain_wallet_connected', 'true');
      localStorage.setItem('vechain_wallet_address', account);

      fetchBalance(account);
    } else {
      onAccountChange(null);
      localStorage.removeItem('vechain_wallet_connected');
      localStorage.removeItem('vechain_wallet_address');
      setBalance(null);
    }
  }, [account, onAccountChange]);

  const fetchBalance = async (address) => {
    try {
      const accountData = await thor.accounts.getAccount(address);
      const balanceWei = accountData.balance;
      const balanceVET = unitsUtils.formatUnits(balanceWei, 18);
      setBalance(parseFloat(balanceVET).toFixed(2));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleConnect = () => {
    openModal();
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (account) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="connected-address">
          Connected: {formatAddress(account)}
          {balance !== null && (
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
              Balance: {balance} VET
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#28a745', marginTop: '0.25rem' }}>
            ✓ VeChainKit Ready
          </div>
        </div>
        <button className="btn btn-secondary" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button className="btn" onClick={handleConnect}>
      Connect Wallet
    </button>
  );
}

export default WalletConnection;