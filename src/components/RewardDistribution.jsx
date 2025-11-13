import React, { useEffect, useState } from 'react';
import { getApprovedSubmissions } from '../services/api';
import { CONTRACT_ADDRESS } from '../config/contract';

function RewardDistribution ({ account }) {
    const [approvedSubmissions, setApprovedSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadApprovedSubmissions();
    }, []);

    const loadApprovedSubmissions = async () => {
        try {
            const submissions = await getApprovedSubmissions();
            setApprovedSubmissions(submissions);
        } catch (error) {
            console.error('Failed to load approved submissions:', error);
            setMessage('Failed to load approved submissions.');
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async (walletAddress) => {
        setClaiming(walletAddress);
        setMessage('');

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_BASE_URL}/submissions/${walletAddress}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            setMessage(`Reward claim successful! TX: ${data.txId}`);
            loadApprovedSubmissions(); // refresh after claim
        } catch (error) {
            console.error('Claim failed:', error);
            setMessage(error.message || 'Failed to claim reward.');
        } finally {
            setClaiming(null);
        }
    };

    return (
        <div className="reward-distribution">
            <h2>🎉 Reward Distribution Center</h2>

            {loading ? (
                <p>Loading approved submissions...</p>
            ) : approvedSubmissions.length === 0 ? (
                <p>No approved submissions yet.</p>
            ) : (
                <table className="submissions-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Wallet</th>
                            <th>Proof Link</th>
                            <th>Status</th>
                            <th>Reward</th>
                        </tr>
                    </thead>
                    <tbody>
                        {approvedSubmissions.map((sub) => (
                            <tr key={sub.walletAddress}>
                                <td>{sub.name}</td>
                                <td>{sub.walletAddress}</td>
                                <td>
                                    <a href={sub.proofLink} target="_blank" rel="noreferrer">View Proof</a>
                                </td>
                                <td>{sub.status}</td>
                                <td>
                                    <button
                                        className="btn btn-success"
                                        onClick={() => handleClaim(sub.walletAddress)}
                                        disabled={claiming === sub.walletAddress}
                                    >
                                        {claiming === sub.walletAddress ? 'Claiming...' : 'Claim Reward'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {message && <div className="status-message info">{message}</div>}
        </div>
    );
}

export default RewardDistribution;
