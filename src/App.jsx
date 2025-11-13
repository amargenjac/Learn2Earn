import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate
} from 'react-router-dom';
import { VeChainKitProvider, TransactionModalProvider } from '@vechain/vechain-kit';
import WalletConnection from './components/WalletConnection';
import StudentRegistration from './components/StudentRegistration';
import ProofSubmissionForm from './components/ProofSubmissionForm';
import ClaimReward from './components/ClaimReward';
import RegistrarDashboard from './components/RegistrarDashboard';
import RewardDistribution from './components/RewardDistribution';
import { checkSubmissionStatus } from './services/api';
import './App.css';

function AppContent () {
  const [account, setAccount] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (account) {
      checkStatus();
    }
  }, [account]);

  const checkStatus = async () => {
    try {
      const status = await checkSubmissionStatus(account);
      setSubmissionStatus(status);

      if (status) {
        const approved = status.approved === true;
        const claimed = status.claimed === true;

        setIsApproved(approved);
        setIsClaimed(claimed);

        if (status.submitted || status.approved || status.claimed) {
          setIsRegistered(true);
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleSubmissionSuccess = () => {
    setSubmissionStatus({ submitted: true, approved: false });
    setTimeout(checkStatus, 2000);
  };

  const handleRegistrationSuccess = () => {
    setIsRegistered(true);
    setTimeout(() => checkStatus(), 2000);
  };

  return (
    <Router>
      <div className="container">
        <header className="header">
          <div>
            <h1>Learn2Earn</h1>
            <p>Complete learning tasks and earn B3TR tokens</p>
          </div>
          <WalletConnection onAccountChange={setAccount} />
        </header>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <Link to="/">Home</Link>
          <Link to="/claim">Claim Reward</Link>
          <Link to="/distribution">Reward Distribution</Link>
          <Link to="/registrar">Registrar Panel</Link>
        </nav>

        <main className="main-content">
          {!account && (
            <div className="card">
              <p style={{ textAlign: 'center', color: '#666' }}>
                Please connect your VeWorld wallet to get started
              </p>
            </div>
          )}

          {account && (
            <Routes>
              {/* === STUDENT WORKFLOW === */}
              <Route
                path="/"
                element={
                  !isRegistered ? (
                    <StudentRegistration
                      account={account}
                      onRegistrationSuccess={handleRegistrationSuccess}
                      onRegistrationStatusChange={setIsRegistered}
                    />
                  ) : isClaimed || submissionStatus?.claimed ? (
                    <div className="card">
                      <div className="reward-section">
                        <h3>✅ Reward Successfully Claimed!</h3>
                        <p>Your B3TR tokens have been distributed to your wallet.</p>
                        <div className="status-message success">
                          Claimed on:{' '}
                          {submissionStatus?.claimedAt
                            ? new Date(submissionStatus.claimedAt).toLocaleDateString()
                            : 'N/A'}
                        </div>
                        {submissionStatus?.transactionHash && (
                          <div style={{ marginTop: '1rem' }}>
                            <a
                              href={`https://explore-testnet.vechain.org/transactions/${submissionStatus.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn"
                            >
                              View Transaction on Explorer
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isApproved || submissionStatus?.approved ? (
                    <div className="card">
                      <ClaimReward account={account} />
                    </div>
                  ) : (
                    <div className="card">
                      <h2>Submit Your Proof of Learning</h2>
                      <ProofSubmissionForm
                        account={account}
                        onSubmissionSuccess={handleSubmissionSuccess}
                        disabled={submissionStatus?.submitted}
                      />
                      {submissionStatus?.submitted && !submissionStatus?.approved && (
                        <div className="status-message info">
                          Your submission is under review. Please check back later.
                        </div>
                      )}
                    </div>
                  )
                }
              />

              {/* === CLAIM PAGE === */}
              <Route path="/claim" element={<ClaimReward account={account} />} />

              {/* === REWARD DISTRIBUTION (ADMIN) === */}
              <Route path="/distribution" element={<RewardDistribution account={account} />} />

              {/* === REGISTRAR PANEL === */}
              <Route path="/registrar" element={<RegistrarDashboard />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
}

function App () {
  return (
    <VeChainKitProvider
      network={{
        type: 'test',
        nodeUrl: 'https://testnet.vechain.org/',
        genesisId:
          '0x000000000b2bce3c70bc649a02749e8687721b09ed2e15997f466536b20bb127',
      }}
      dappKit={{
        nodeUrl: 'https://testnet.vechain.org/',
        genesis: 'test',
        walletConnectOptions: {
          projectId: 'YOUR_WALLET_CONNECT_PROJECT_ID',
          metadata: {
            name: 'Learn2Earn',
            description: 'VeChain Education Platform',
            url: window.location.origin,
            icons: [`${window.location.origin}/logo.png`],
          },
        },
        usePersistence: true,
        useFirstDetectedSource: false,
        allowedWallets: ['veworld', 'sync2', 'wallet-connect'],
      }}
      loginMethods={['vechain', 'wallet']}
    >
      <TransactionModalProvider>
        <AppContent />
      </TransactionModalProvider>
    </VeChainKitProvider>
  );
}

export default App;
