import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getOptionValues } from '../utils/formatUtils';
import './ProductDetail.css';

function ProductDetail({ addToCart, selectedOptions, selectedImages, updateSelectedOptions, updateSelectedImage }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [error, setError] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get('http://localhost:5000/products');
        const found = res.data.find(p => p.id === parseInt(id));
        if (!found) {
          navigate('/not-found');
          return;
        }
        setProduct(found);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load product:', err);
        setError('Failed to load product');
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, navigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
      }
      if (e.key === 'ArrowLeft' && showImageModal && product?.images) {
        setModalImageIndex(prev => (prev - 1 + product.images.length) % product.images.length);
      }
      if (e.key === 'ArrowRight' && showImageModal && product?.images) {
        setModalImageIndex(prev => (prev + 1) % product.images.length);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, product]);

  const handleOptionChange = (type, value) => {
    updateSelectedOptions(product.id, { [type]: value });

    if (type === 'color' && product.variantImages?.color?.[value]) {
      updateSelectedImage(product.id, product.variantImages.color[value]);
    } else if (type === 'size' && product.variantImages?.size?.[value]) {
      updateSelectedImage(product.id, product.variantImages.size[value]);
    }
  };

  const renderOptionSelector = (optionType, label) => {
    if (!product || !product.options) return null;
    
    const options = getOptionValues(product.options, optionType);
    
    const optionKey = optionType === 'sizes' ? 'size' : 'color';
    const selectedValue = selectedOptions[product.id]?.[optionKey] || '';
    
    if (options.length === 0) return null;
    
    return (
      <div className="option-selector-large">
        <label className="option-label-large">
          {label} <span className="required-star">*</span>
        </label>
        <div className="select-wrapper">
          <select 
            className="option-select-large"
            value={selectedValue}
            onChange={e => handleOptionChange(optionKey, e.target.value)}
          >
            <option value="">Choose {label.toLowerCase()}</option>
            {options.map((option, index) => (
              <option key={`${option}-${index}`} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="select-arrow-large">
            ▼
          </div>
        </div>
      </div>
    );
  };
  
  const handleAddToCart = () => {
    const productOptions = selectedOptions[product.id] || {};
    let missingOptions = [];
    
    const availableSizes = product.options?.sizes || [];
    const availableColors = product.options?.colors || [];
    
    if (availableSizes.length > 0 && (!productOptions.size || productOptions.size === '')) {
      missingOptions.push('size');
    }
    
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
    
    addToCart(product, quantity, productOptions);
    
    // Reset selections after adding to cart
    updateSelectedOptions(product.id, { size: '', color: '' });
    if (product.images && product.images.length > 0) {
      updateSelectedImage(product.id, product.images[0]);
      setActiveImageIndex(0);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading product...</div>;
  }

  if (!product) {
    return <div className="error-state">Product not found</div>;
  }

  const mainImage = selectedImages[product.id] || product.images?.[0] || '';

  return (
    <div className="product-detail-container">
      <button 
        onClick={() => navigate(-1)} 
        className="back-button"
      >
        ← Back to Products
      </button>

      <div className="product-detail-grid">
        {/* Left: Images */}
        <div>
          <div className="product-gallery">
            <img 
              src={mainImage} 
              alt={product.name} 
              className="product-main-image"
              onClick={() => {
                setShowImageModal(true);
                setModalImageIndex(product.images?.indexOf(mainImage) || 0);
              }}
            />
            
            {/* Image Navigation */}
            {product.images && product.images.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const newIndex = (activeImageIndex - 1 + product.images.length) % product.images.length;
                    setActiveImageIndex(newIndex);
                    updateSelectedImage(product.id, product.images[newIndex]);
                  }}
                  className="nav-button prev"
                  aria-label="Previous image"
                >
                  ‹
                </button>
                
                <button
                  onClick={() => {
                    const newIndex = (activeImageIndex + 1) % product.images.length;
                    setActiveImageIndex(newIndex);
                    updateSelectedImage(product.id, product.images[newIndex]);
                  }}
                  className="nav-button next"
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Gallery - Only changes main image, no pop-out */}
          {product.images && product.images.length > 1 && (
            <div className="thumbnail-gallery">
              {product.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`View ${idx + 1}`}
                  onClick={() => {
                    updateSelectedImage(product.id, img);
                    setActiveImageIndex(idx);
                  }}
                  className={`thumbnail ${img === mainImage ? 'active' : ''}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Details & Options */}
        <div>
          <h1 className="product-name-large">{product.name}</h1>
          
          <p className="product-description-large">
            {product.description || 'No description available.'}
          </p>

          <div className="product-price-large">
            <span className="current-price">
              ${product.promoPrice || product.price}
            </span>
            {product.promoPrice && (
              <span className="original-price-large">
                ${product.price}
              </span>
            )}
          </div>

          {/* Dynamic Option Selectors */}
          {renderOptionSelector('sizes', 'Size')}
          {renderOptionSelector('colors', 'Color')}

          {/* Quantity Selector */}
          <div className="quantity-selector">
            <label className="quantity-label-large">
              Quantity
            </label>
            <div className="quantity-controls-large">
              <button
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="quantity-btn-large"
                aria-label="Decrease quantity"
              >
                -
              </button>
              
              <input 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="quantity-input-large"
              />
              
              <button
                onClick={() => setQuantity(prev => prev + 1)}
                className="quantity-btn-large"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* Add to Cart Button */}
          <button 
            onClick={handleAddToCart}
            className="add-to-cart-btn-large"
          >
            Add to Cart - ${((product.promoPrice || product.price) * quantity).toFixed(2)}
          </button>
        </div>
      </div>

      {/* Enhanced Image Modal - Only triggered by main image click */}
      {showImageModal && product.images && (
        <div 
          className="image-modal-overlay"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowImageModal(false)}
              className="image-modal-close"
              aria-label="Close modal"
            >
              ✕
            </button>
            
            <button
              onClick={() => setModalImageIndex(prev => (prev - 1 + product.images.length) % product.images.length)}
              className="image-modal-nav prev"
              aria-label="Previous image"
            >
              ‹
            </button>
            
            <img
              src={product.images[modalImageIndex]}
              alt={`Product view ${modalImageIndex + 1}`}
              className="image-modal-img"
            />
            
            <button
              onClick={() => setModalImageIndex(prev => (prev + 1) % product.images.length)}
              className="image-modal-nav next"
              aria-label="Next image"
            >
              ›
            </button>
            
            <div className="image-modal-counter">
              {modalImageIndex + 1} / {product.images.length}
            </div>
            
            <div className="image-modal-hint">
              Press ESC to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;