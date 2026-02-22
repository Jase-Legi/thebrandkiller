import React, { useState, useEffect } from 'react';
import { useNotifications } from '../components/NotificationManager';
import './AdminAffiliate.css';

function AdminAffiliate({ token, user, axiosInstance }) {
  const [affiliates, setAffiliates] = useState([]);
  const [commissionSettings, setCommissionSettings] = useState({
    defaultRate: 0.10,
    minimumPayout: 50,
    payoutSchedule: 'monthly',
    cookieDuration: 30,
    terms: 'Standard affiliate terms apply'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [stats, setStats] = useState({
    totalAffiliates: 0,
    totalCommissionsPaid: 0,
    pendingPayouts: 0,
    totalSalesGenerated: 0
  });

  const { showNotification, showConfirmation } = useNotifications();

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAffiliates();
      fetchCommissionSettings();
      fetchAffiliateStats();
    }
  }, [user]);

  const fetchAffiliates = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/affiliates');
      setAffiliates(res.data);
    } catch (err) {
      console.error('Failed to load affiliates:', err);
      showNotification('Failed to load affiliates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommissionSettings = async () => {
    try {
      const res = await axiosInstance.get('/admin/affiliate-settings');
      setCommissionSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchAffiliateStats = async () => {
    try {
      const res = await axiosInstance.get('/admin/affiliate-stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const saveCommissionSettings = async () => {
    setSaving(true);
    try {
      await axiosInstance.put('/admin/affiliate-settings', commissionSettings);
      showNotification('Commission settings saved successfully', 'success');
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
      showNotification('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateAffiliateCommission = async (affiliateId, newRate) => {
    try {
      await axiosInstance.put(`/admin/affiliates/${affiliateId}/commission`, {
        rate: newRate
      });
      showNotification('Commission rate updated', 'success');
      fetchAffiliates();
    } catch (err) {
      console.error('Failed to update commission:', err);
      showNotification('Failed to update commission', 'error');
    }
  };

  const approveAffiliate = async (affiliateId) => {
    try {
      await axiosInstance.post(`/admin/affiliates/${affiliateId}/approve`);
      showNotification('Affiliate approved', 'success');
      fetchAffiliates();
    } catch (err) {
      console.error('Failed to approve affiliate:', err);
      showNotification('Failed to approve affiliate', 'error');
    }
  };

  const suspendAffiliate = async (affiliateId) => {
    showConfirmation(
      'Suspend Affiliate',
      'Are you sure you want to suspend this affiliate? They will no longer be able to generate new links.',
      async () => {
        try {
          await axiosInstance.post(`/admin/affiliates/${affiliateId}/suspend`);
          showNotification('Affiliate suspended', 'success');
          fetchAffiliates();
        } catch (err) {
          console.error('Failed to suspend affiliate:', err);
          showNotification('Failed to suspend affiliate', 'error');
        }
      },
      () => {}
    );
  };

  const processPayout = async (affiliateId) => {
    showConfirmation(
      'Process Payout',
      'Are you sure you want to process payout for this affiliate? This will mark their pending commissions as paid.',
      async () => {
        try {
          await axiosInstance.post(`/admin/affiliates/${affiliateId}/payout`);
          showNotification('Payout processed successfully', 'success');
          fetchAffiliates();
          fetchAffiliateStats();
        } catch (err) {
          console.error('Failed to process payout:', err);
          showNotification('Failed to process payout', 'error');
        }
      },
      () => {}
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-access-card">
        <h2 style={{ color: '#ff4444' }}>Admin Access Required</h2>
        <p style={{ color: '#ccc' }}>Admin login required to access affiliate management.</p>
      </div>
    );
  }

  return (
    <div className="admin-affiliate-container">
      <div className="admin-affiliate-header">
        <h1>Affiliate Program Management</h1>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="settings-toggle-btn"
        >
          {showSettings ? 'Hide Settings' : '⚙️ Commission Settings'}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="admin-stats-overview">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div className="admin-stat-content">
            <h3>{stats.totalAffiliates}</h3>
            <p>Total Affiliates</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">💰</div>
          <div className="admin-stat-content">
            <h3>${stats.totalCommissionsPaid.toFixed(2)}</h3>
            <p>Total Paid Out</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">⏳</div>
          <div className="admin-stat-content">
            <h3>${stats.pendingPayouts.toFixed(2)}</h3>
            <p>Pending Payouts</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📈</div>
          <div className="admin-stat-content">
            <h3>{stats.totalSalesGenerated}</h3>
            <p>Sales Generated</p>
          </div>
        </div>
      </div>

      {/* Commission Settings */}
      {showSettings && (
        <div className="commission-settings-section">
          <h2>Commission Settings</h2>
          
          <div className="settings-form">
            <div className="settings-grid">
              <div className="setting-field">
                <label>Default Commission Rate (%)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="1" 
                  max="50"
                  value={commissionSettings.defaultRate * 100}
                  onChange={e => setCommissionSettings({
                    ...commissionSettings, 
                    defaultRate: parseFloat(e.target.value) / 100
                  })}
                />
              </div>
              
              <div className="setting-field">
                <label>Minimum Payout ($)</label>
                <input 
                  type="number" 
                  step="1" 
                  min="10"
                  value={commissionSettings.minimumPayout}
                  onChange={e => setCommissionSettings({
                    ...commissionSettings, 
                    minimumPayout: parseInt(e.target.value)
                  })}
                />
              </div>
              
              <div className="setting-field">
                <label>Payout Schedule</label>
                <select 
                  value={commissionSettings.payoutSchedule}
                  onChange={e => setCommissionSettings({
                    ...commissionSettings, 
                    payoutSchedule: e.target.value
                  })}
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              
              <div className="setting-field">
                <label>Cookie Duration (Days)</label>
                <input 
                  type="number" 
                  step="1" 
                  min="1" 
                  max="365"
                  value={commissionSettings.cookieDuration}
                  onChange={e => setCommissionSettings({
                    ...commissionSettings, 
                    cookieDuration: parseInt(e.target.value)
                  })}
                />
              </div>
            </div>
            
            <div className="setting-field full-width">
              <label>Terms & Conditions</label>
              <textarea 
                value={commissionSettings.terms}
                onChange={e => setCommissionSettings({
                  ...commissionSettings, 
                  terms: e.target.value
                })}
                rows="4"
                placeholder="Enter affiliate program terms and conditions..."
              />
            </div>
            
            <div className="settings-actions">
              <button 
                onClick={() => setShowSettings(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={saveCommissionSettings}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affiliates List */}
      <div className="affiliates-list-section">
        <div className="section-header">
          <h2>Affiliates ({affiliates.length})</h2>
          <div className="section-actions">
            <button 
              onClick={fetchAffiliates}
              className="refresh-btn"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading affiliates...</p>
          </div>
        ) : (
          <div className="affiliates-table-container">
            <table className="affiliates-table">
              <thead>
                <tr>
                  <th>Affiliate</th>
                  <th>Status</th>
                  <th>Commission Rate</th>
                  <th>Total Commissions</th>
                  <th>Pending Payout</th>
                  <th>Joined Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map(affiliate => (
                  <tr key={affiliate.id} className={affiliate.status === 'suspended' ? 'suspended' : ''}>
                    <td>
                      <div className="affiliate-info">
                        <div className="affiliate-email">{affiliate.email}</div>
                        <div className="affiliate-id">ID: {affiliate.id}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${affiliate.status}`}>
                        {affiliate.status}
                      </span>
                    </td>
                    <td>
                      <div className="commission-rate-edit">
                        <input 
                          type="number" 
                          step="0.1" 
                          min="1" 
                          max="50"
                          value={affiliate.commissionRate * 100}
                          onChange={e => {
                            if (selectedAffiliate === affiliate.id) {
                              updateAffiliateCommission(affiliate.id, parseFloat(e.target.value) / 100);
                            }
                          }}
                          onFocus={() => setSelectedAffiliate(affiliate.id)}
                          className="rate-input"
                        />
                        <span className="percent-symbol">%</span>
                      </div>
                    </td>
                    <td>
                      <div className="commission-amount">
                        ${affiliate.totalCommissions?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    <td>
                      <div className="pending-amount">
                        ${affiliate.pendingPayout?.toFixed(2) || '0.00'}
                        {affiliate.pendingPayout >= commissionSettings.minimumPayout && (
                          <span className="payout-eligible">Eligible</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="join-date">
                        {formatDate(affiliate.joinedDate)}
                      </div>
                    </td>
                    <td>
                      <div className="affiliate-actions">
                        {affiliate.status === 'pending' && (
                          <button 
                            onClick={() => approveAffiliate(affiliate.id)}
                            className="action-btn approve-btn"
                          >
                            Approve
                          </button>
                        )}
                        
                        {affiliate.status === 'active' && affiliate.pendingPayout > 0 && (
                          <button 
                            onClick={() => processPayout(affiliate.id)}
                            className="action-btn payout-btn"
                          >
                            Pay Out
                          </button>
                        )}
                        
                        {affiliate.status === 'active' && (
                          <button 
                            onClick={() => suspendAffiliate(affiliate.id)}
                            className="action-btn suspend-btn"
                          >
                            Suspend
                          </button>
                        )}
                        
                        {affiliate.status === 'suspended' && (
                          <button 
                            onClick={() => approveAffiliate(affiliate.id)}
                            className="action-btn reactivate-btn"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Affiliate Reports */}
      <div className="reports-section">
        <h2>Affiliate Reports</h2>
        <div className="reports-grid">
          <div className="report-card">
            <h3>Top Performing Affiliates</h3>
            <div className="report-content">
              {affiliates
                .filter(a => a.status === 'active')
                .sort((a, b) => (b.totalCommissions || 0) - (a.totalCommissions || 0))
                .slice(0, 5)
                .map((affiliate, index) => (
                  <div key={affiliate.id} className="top-affiliate">
                    <span className="rank">{index + 1}</span>
                    <span className="affiliate-name">{affiliate.email}</span>
                    <span className="affiliate-amount">${affiliate.totalCommissions?.toFixed(2) || '0.00'}</span>
                  </div>
                ))}
            </div>
          </div>
          
          <div className="report-card">
            <h3>Pending Payouts</h3>
            <div className="report-content">
              {affiliates
                .filter(a => a.pendingPayout > 0 && a.status === 'active')
                .sort((a, b) => (b.pendingPayout || 0) - (a.pendingPayout || 0))
                .slice(0, 5)
                .map((affiliate, index) => (
                  <div key={affiliate.id} className="payout-affiliate">
                    <span className="affiliate-email">{affiliate.email}</span>
                    <span className="payout-amount">${affiliate.pendingPayout?.toFixed(2)}</span>
                    {affiliate.pendingPayout >= commissionSettings.minimumPayout && (
                      <span className="eligible-badge">Eligible</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAffiliate;