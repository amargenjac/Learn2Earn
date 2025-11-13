import React, { useEffect, useState } from 'react';
import { checkSubmissionStatus } from '../services/api';

function RegistrarDashboard () {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [grading, setGrading] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadAllSubmissions();
    }, []);

    const loadAllSubmissions = async () => {
        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_BASE_URL}/submissions`);
            const data = await response.json();
            setSubmissions(data);
        } catch (error) {
            console.error('Failed to load submissions:', error);
            setMessage('Error loading submissions');
        } finally {
            setLoading(false);
        }
    };

    const handleGrade = async (walletAddress, action) => {
        setGrading(walletAddress);
        setMessage('');

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_BASE_URL}/submissions/${walletAddress}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            setMessage(`Submission ${action}ed successfully!`);
            loadAllSubmissions();
        } catch (error) {
            console.error('Grading failed:', error);
            setMessage(error.message);
        } finally {
            setGrading(null);
        }
    };

    return (
        <div className="registrar-dashboard">
            <h2>🧑‍🏫 Registrar Dashboard</h2>

            {loading ? (
                <p>Loading submissions...</p>
            ) : submissions.length === 0 ? (
                <p>No submissions yet.</p>
            ) : (
                <table className="submissions-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Wallet</th>
                            <th>Proof Link</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.map((sub) => (
                            <tr key={sub.walletAddress}>
                                <td>{sub.name}</td>
                                <td>{sub.walletAddress}</td>
                                <td>
                                    <a href={sub.proofLink} target="_blank" rel="noreferrer">View Proof</a>
                                </td>
                                <td>{sub.status}</td>
                                <td>
                                    {sub.status === 'pending' ? (
                                        <>
                                            <button
                                                className="btn btn-success"
                                                onClick={() => handleGrade(sub.walletAddress, 'approve')}
                                                disabled={grading === sub.walletAddress}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => handleGrade(sub.walletAddress, 'reject')}
                                                disabled={grading === sub.walletAddress}
                                            >
                                                Reject
                                            </button>
                                        </>
                                    ) : (
                                        <span>{sub.status}</span>
                                    )}
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

export default RegistrarDashboard;
