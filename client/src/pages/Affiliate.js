import React, { useState, useEffect } from 'react';
import { useNotifications } from '../components/NotificationManager';
import './Affiliate.css';

function Affiliate({ user, token, axiosInstance }) {
  const [products, setProducts] = useState([]);
  const [commissionData, setCommissionData] = useState(null);
  const [affiliateLinks, setAffiliateLinks] = useState({});
  const [stats, setStats] = useState({
    totalCommissions: 0,
    totalSales: 0,
    pendingCommissions: 0,
    conversionRate: 0
  });
  const [loading, setLoading] = useState(true);

  const { showNotification } = useNotifications();

  useEffect(() => {
    if (user?.role === 'affiliate') {
      fetchProducts();
      fetchCommissionData();
      fetchAffiliateStats();
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      const res = await axiosInstance.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products:', err);
      showNotification('Failed to load products', 'error');
    }
  };

  const fetchCommissionData = async () => {
    try {
      const res = await axiosInstance.get('/affiliate/commission-data');
      setCommissionData(res.data);
    } catch (err) {
      console.error('Failed to load commission data:', err);
    }
  };

  const fetchAffiliateStats = async () => {
    try {
      const res = await axiosInstance.get('/affiliate/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateAffiliateLink = async (productId) => {
    try {
      const res = await axiosInstance.get(`/affiliate/link/${productId}`);
      const newLink = res.data.link;
      
      setAffiliateLinks(prev => ({
        ...prev,
        [productId]: newLink
      }));
      
      return newLink;
    } catch (err) {
      showNotification('Failed to generate affiliate link', 'error');
      console.error('Generate link error:', err);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Link copied to clipboard!', 'success');
    } catch (err) {
      showNotification('Failed to copy link', 'error');
    }
  };

  const shareAffiliateLink = (productId, link) => {
    if (navigator.share) {
      navigator.share({
        title: 'Check out this product!',
        text: `Check out this product and use my affiliate link!`,
        url: link,
      }).catch(console.error);
    } else {
      copyToClipboard(link);
    }
  };

  if (!user || user.role !== 'affiliate') {
    return (
      <div className="affiliate-access-card">
        <h2>Affiliate Access Required</h2>
        <p>You need to be registered as an affiliate to access this portal.</p>
        <p>Contact support to upgrade your account to affiliate status.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading affiliate dashboard...</p>
      </div>
    );
  }

  return (
    <div className="affiliate-container">
      <div className="affiliate-header">
        <h1>Affiliate Dashboard</h1>
        <p className="affiliate-subtitle">
          Welcome, {user.email}! Start earning commissions by sharing product links.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>${stats.totalCommissions.toFixed(2)}</h3>
            <p>Total Commissions</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-content">
            <h3>{stats.totalSales}</h3>
            <p>Total Sales</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>${stats.pendingCommissions.toFixed(2)}</h3>
            <p>Pending Payout</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{stats.conversionRate}%</h3>
            <p>Conversion Rate</p>
          </div>
        </div>
      </div>

      {/* Commission Info */}
      {commissionData && (
        <div className="commission-info">
          <h2>Commission Structure</h2>
          <div className="commission-details">
            <div className="commission-rate">
              <span className="rate-percentage">{commissionData.rate * 100}%</span>
              <span className="rate-label">Commission Rate</span>
            </div>
            <div className="commission-notes">
              <p><strong>Payout:</strong> {commissionData.payoutSchedule}</p>
              <p><strong>Minimum Payout:</strong> ${commissionData.minimumPayout}</p>
              <p><strong>Cookie Duration:</strong> {commissionData.cookieDuration} days</p>
              <p><strong>Terms:</strong> {commissionData.terms}</p>
            </div>
          </div>
        </div>
      )}

      {/* Product Links */}
      <div className="product-links-section">
        <h2>Generate Affiliate Links</h2>
        <p className="section-subtitle">
          Copy and share these links to earn commissions on any sales.
        </p>

        <div className="products-grid">
          {products.slice(0, 10).map(product => {
            const link = affiliateLinks[product.id];
            
            return (
              <div key={product.id} className="product-link-card">
                <div className="product-link-header">
                  <div className="product-link-info">
                    <h4>{product.name}</h4>
                    <p className="product-price">${product.promoPrice || product.price}</p>
                  </div>
                  <div className="commission-badge">
                    Earn ${((product.promoPrice || product.price) * (commissionData?.rate || 0.1)).toFixed(2)} per sale
                  </div>
                </div>
                
                {product.images?.[0] && (
                  <img 
                    src={product.images[0]} 
                    alt={product.name}
                    className="product-link-image"
                  />
                )}
                
                <div className="link-actions">
                  {link ? (
                    <>
                      <div className="link-display">
                        <input 
                          type="text" 
                          value={link} 
                          readOnly 
                          className="link-input"
                          onClick={(e) => e.target.select()}
                        />
                        <button 
                          onClick={() => copyToClipboard(link)}
                          className="copy-btn"
                        >
                          📋 Copy
                        </button>
                      </div>
                      <div className="share-buttons">
                        <button 
                          onClick={() => shareAffiliateLink(product.id, link)}
                          className="share-btn"
                        >
                          📤 Share
                        </button>
                        <button 
                          onClick={() => window.open(link, '_blank')}
                          className="preview-btn"
                        >
                          👁️ Preview
                        </button>
                      </div>
                    </>
                  ) : (
                    <button 
                      onClick={() => generateAffiliateLink(product.id)}
                      className="generate-btn"
                    >
                      🔗 Generate Affiliate Link
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Links & Tips */}
      <div className="affiliate-tips">
        <h2>Tips for Success</h2>
        <div className="tips-grid">
          <div className="tip-card">
            <div className="tip-icon">📱</div>
            <h4>Share on Social Media</h4>
            <p>Post links on Instagram, Twitter, Facebook, and TikTok with engaging content.</p>
          </div>
          <div className="tip-card">
            <div className="tip-icon">✉️</div>
            <h4>Email Marketing</h4>
            <p>Include your affiliate links in newsletters and email campaigns.</p>
          </div>
          <div className="tip-card">
            <div className="tip-icon">📝</div>
            <h4>Create Content</h4>
            <p>Write blog posts, reviews, or tutorials featuring our products.</p>
          </div>
          <div className="tip-card">
            <div className="tip-icon">🎥</div>
            <h4>Video Content</h4>
            <p>Make YouTube videos or Instagram Reels showcasing the products.</p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="affiliate-faq">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-list">
          <div className="faq-item">
            <h4>When do I get paid?</h4>
            <p>Commissions are paid out {commissionData?.payoutSchedule || 'monthly'} once you reach the minimum payout threshold.</p>
          </div>
          <div className="faq-item">
            <h4>How long do affiliate cookies last?</h4>
            <p>Our affiliate cookies last for {commissionData?.cookieDuration || 30} days, so you'll earn commission on any purchase made within that time.</p>
          </div>
          <div className="faq-item">
            <h4>Can I track my referrals?</h4>
            <p>Yes! You can see all your referrals and their status in your dashboard. Real-time tracking is coming soon.</p>
          </div>
          <div className="faq-item">
            <h4>What products can I promote?</h4>
            <p>You can promote any product in our store. Some products may have special commission rates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Affiliate;