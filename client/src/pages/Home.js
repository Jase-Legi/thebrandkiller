import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getOptionValues } from '../utils/formatUtils';
import './Home.css';

function Home({ addToCart, selectedOptions, selectedImages, updateSelectedOptions, updateSelectedImage }) {
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState('');
  const [modalProductIndex, setModalProductIndex] = useState(0);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  useEffect(() => {
    axios.get('http://localhost:5000/products').then(res => {
      setProducts(res.data);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load products:', err);
      setErrors({ general: 'Failed to load products' });
      setLoading(false);
    });
  }, []);

  // Keyboard shortcuts for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false);
      }
      if (e.key === 'ArrowLeft' && modalOpen) {
        navigateModalImage(-1);
      }
      if (e.key === 'ArrowRight' && modalOpen) {
        navigateModalImage(1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const categories = ['all', 'clothing', 'stickers', 'shoes', 'supplements', 'accessory'];

  const filteredProducts = activeTab === 'all' 
    ? products 
    : products.filter(p => p.category === activeTab);

  const handleOptionChange = (productId, optionType, value) => {
    updateSelectedOptions(productId, { [optionType]: value });

    const product = products.find(p => p.id === productId);
    if (product.variantImages?.[optionType]?.[value]) {
      updateSelectedImage(productId, product.variantImages[optionType][value]);
    }
  };

  // Handle main image click to open modal
  const handleMainImageClick = (product, imageIndex) => {
    setModalImage(product.images[imageIndex]);
    setModalProductIndex(filteredProducts.indexOf(product));
    setModalImageIndex(imageIndex);
    setModalOpen(true);
  };

  // Navigate modal images
  const navigateModalImage = (direction) => {
    const product = filteredProducts[modalProductIndex];
    if (!product || !product.images) return;
    
    const newIndex = (modalImageIndex + direction + product.images.length) % product.images.length;
    setModalImage(product.images[newIndex]);
    setModalImageIndex(newIndex);
  };

  const renderOptionSelector = (product, optionType, label) => {
    const options = getOptionValues(product.options, optionType);
    
    const optionKey = optionType === 'sizes' ? 'size' : 'color';
    const selectedValue = selectedOptions[product.id]?.[optionKey] || '';
    
    if (options.length === 0) return null;
    
    return (
      <div className="option-selector">
        <label className="option-label">
          {label} <span className="required-star">*</span>
        </label>
        <div className="select-wrapper">
          <select 
            className="option-select"
            value={selectedValue}
            onChange={e => handleOptionChange(product.id, optionKey, e.target.value)}
          >
            <option value="">Select {label}</option>
            {options.map((option, index) => (
              <option key={`${option}-${index}`} value={option}>
                {option}
              </option>
            ))}
          </select>
          {/* <div className="select-arrow">
            ▼
          </div> */}
        </div>
      </div>
    );
  };

  const renderProductDetails = (product) => {
    const details = [];
    
    if (product.weight) {
      details.push(
        <p key="weight" className="detail-item">
          Weight: {product.weight} lbs
        </p>
      );
    }
    
    if (product.shippingNotes) {
      details.push(
        <p key="shipping" className="detail-item">
          Shipping: {product.shippingNotes}
        </p>
      );
    }
    
    if (product.estimatedShipping) {
      details.push(
        <p key="estimated" className="detail-item detail-highlight">
          Est. Shipping: ${parseFloat(product.estimatedShipping).toFixed(2)}
        </p>
      );
    }
    
    if (product.category === 'supplements' && product.health) {
      if (product.health.dosage) {
        details.push(
          <p key="dosage" className="detail-item detail-warning">
            Dosage: {product.health.dosage}
          </p>
        );
      }
      if (product.health.form) {
        details.push(
          <p key="form" className="detail-item detail-warning">
            Form: {product.health.form}
          </p>
        );
      }
      if (product.health.ingredients && product.health.ingredients.length > 0) {
        details.push(
          <p key="ingredients" className="detail-item detail-warning">
            Ingredients: {product.health.ingredients.slice(0, 3).join(', ')}
            {product.health.ingredients.length > 3 ? '...' : ''}
          </p>
        );
      }
    }
    
    return details.length > 0 ? (
      <div className="product-details">
        {details}
      </div>
    ) : null;
  };
  
  const handleAddToCart = (product) => {
    const productOptions = selectedOptions[product.id] || {};
    
    let missingOptions = [];
    
    // Get available options directly from product
    const availableSizes = getOptionValues(product.options, 'sizes');
    const availableColors = getOptionValues(product.options, 'colors');
    
    // Check if sizes exist and if one is selected
    if (availableSizes.length > 0 && (!productOptions.size || productOptions.size === '')) {
      missingOptions.push('size');
    }
    
    // Check if colors exist and if one is selected
    if (availableColors.length > 0 && (!productOptions.color || productOptions.color === '')) {
      missingOptions.push('color');
    }
    
    if (missingOptions.length > 0) {
      const errorMessage = `Please select: ${missingOptions.join(' and ')}`;
      if (window.showNotification) {
        window.showNotification(errorMessage, 'error');
      }
      return;
    }
    
    // Add to cart
    addToCart(product, 1, productOptions);
    
    // Reset selections for this product
    updateSelectedOptions(product.id, { size: '', color: '' });
    
    // Reset image to first image
    if (product.images && product.images.length > 0) {
      updateSelectedImage(product.id, product.images[0]);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        Loading products...
      </div>
    );
  }

  return (
    <div className="home-container">
      <h1 className="home-title">Our Products</h1>
      
      <div className="category-tabs">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`category-tab ${activeTab === cat ? 'active' : ''}`}
          >
            {cat === 'all' ? 'All Products' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <h3>No products found in this category</h3>
          <p>Try selecting a different category</p>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map(p => {
            const options = selectedOptions[p.id] || {};
            const mainImage = selectedImages[p.id] || (p.images?.[0] || '');

            return (
              <div key={p.id} className="product-card">
                <div className="product-image-container">
                  <img 
                    src={mainImage} 
                    alt={p.name} 
                    className="product-main-image"
                    onClick={() => handleMainImageClick(p, p.images.indexOf(mainImage))}
                  />
                  
                  {p.images && p.images.length > 1 && (
                    <div className="product-thumbnails">
                      {p.images.map((img, idx) => (
                        <img 
                          key={idx} 
                          src={img} 
                          alt={`Thumbnail ${idx}`} 
                          className={`product-thumbnail ${img === mainImage ? 'active' : ''}`}
                          onClick={() => {
                            updateSelectedImage(p.id, img);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="product-info">
                  <h3 className="product-name">{p.name}</h3>
                  
                  <div className="product-header-meta">
                    <span className="product-type-badge">
                      {p.type}
                    </span>
                    <span className="product-provider">
                      {p.provider}
                    </span>
                  </div>
                  
                  <p className="product-description">
                    {p.description || 'No description available.'}
                  </p>
                  
                  <p className="product-price">
                    ${p.promoPrice || p.price} 
                    {p.promoPrice && (
                      <span className="original-price">
                        ${p.price}
                      </span>
                    )}
                  </p>

                  {renderOptionSelector(p, 'sizes', 'Size')}
                  {renderOptionSelector(p, 'colors', 'Color')}

                  {renderProductDetails(p)}
                </div>

                <button 
                  onClick={() => handleAddToCart(p)}
                  className="add-to-cart-btn"
                >
                  Add to Cart
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced Image Modal */}
      {modalOpen && (
        <div 
          className="image-modal-overlay"
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="modal-close-btn"
              onClick={() => setModalOpen(false)}
              aria-label="Close modal"
            >
              ✕
            </button>
            
            <img 
              src={modalImage} 
              alt="Full size product view" 
              className="modal-full-image"
            />
            
            <div className="modal-navigation">
              <button 
                className="modal-nav-btn prev"
                onClick={() => navigateModalImage(-1)}
                aria-label="Previous image"
              >
                ‹
              </button>
              
              <span className="modal-image-counter">
                {modalImageIndex + 1} / {filteredProducts[modalProductIndex]?.images?.length || 0}
              </span>
              
              <button 
                className="modal-nav-btn next"
                onClick={() => navigateModalImage(1)}
                aria-label="Next image"
              >
                ›
              </button>
            </div>
            
            <div className="modal-escape-hint">
              Press ESC to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;