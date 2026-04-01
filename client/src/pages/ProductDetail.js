import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../components/AppContext';
import { getOptionValues } from '../utils/formatUtils';
import './ProductDetail.css';

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [error, setError] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const { products, loadingProducts, addToCart, selectedOptions, selectedImages, updateSelectedOptions, updateSelectedImage } = useApp();


  useEffect(() => {
    if (!loadingProducts) {
      const found = products.find(p => String(p.id) === id);
      if (!found) navigate('/not-found');
      else setProduct(found);
    }
  }, [id, products, loadingProducts, navigate]);

  // useEffect for price update based on selected options
  useEffect(() => {
    if (!product) return;
    const options = selectedOptions[product.id] || {};
    const selectedSize = options.size;
    const selectedColor = options.color;
    if (product.printfulConfig?.variants?.length) {
      const matchingVariant = product.printfulConfig.variants.find(v => v.size === selectedSize && v.color === selectedColor);
      if (matchingVariant) setCurrentPrice(matchingVariant.price);
      else if (selectedSize && selectedColor) setCurrentPrice(product.printfulConfig.variants[0].price);
    }
  }, [selectedOptions, product]);

  // Keyboard navigation for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showImageModal) setShowImageModal(false);
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
        <label className="option-label-large">{label} <span className="required-star">*</span></label>
        <div className="select-wrapper">
          <select className="option-select-large" value={selectedValue} onChange={e => handleOptionChange(optionKey, e.target.value)}>
            <option value="">Choose {label.toLowerCase()}</option>
            {options.map((option, index) => (
              <option key={`${option}-${index}`} value={option}>{option}</option>
            ))}
          </select>
          <div className="select-arrow-large">▼</div>
        </div>
      </div>
    );
  };

  const handleAddToCart = () => {
    const productOptions = selectedOptions[product.id] || {};
    const selectedSize = productOptions.size;
    const selectedColor = productOptions.color;
    const availableSizes = product.options?.sizes || [];
    const availableColors = product.options?.colors || [];
    if ((availableSizes.length > 0 && !selectedSize) || (availableColors.length > 0 && !selectedColor)) {
      if (window.showNotification) window.showNotification('Please select size and color', 'error');
      return;
    }
    const variant = product.variants?.find(v => v.size === selectedSize && v.color === selectedColor);
    if (!variant) {
      if (window.showNotification) window.showNotification('Selected variant not available', 'error');
      return;
    }
    addToCart(product.id, variant.variantId, quantity);
    updateSelectedOptions(product.id, { size: '', color: '' });
    if (product.images && product.images.length > 0) {
      updateSelectedImage(product.id, product.images[0]);
      setActiveImageIndex(0);
    }
  };

  if (loadingProducts) return <div className="loading-state">Loading product...</div>;
  if (!product) return null;

  const mainImage = selectedImages[product.id] || product.images?.[0] || '';

  return (
    <div className="product-detail-container">
      <button onClick={() => navigate(-1)} className="back-button">← Back to Products</button>
      <div className="product-detail-grid">
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
        <div>
          <h1 className="product-name-large">{product.name}</h1>
          <p className="product-description-large">{product.description || 'No description available.'}</p>
          <div className="product-price-large">
            <span className="current-price">${currentPrice.toFixed(2)}</span>
            {product.promoPrice && !product.printfulConfig && (
              <span className="original-price-large">${product.price}</span>
            )}
          </div>
          {renderOptionSelector('sizes', 'Size')}
          {renderOptionSelector('colors', 'Color')}
          <div className="quantity-selector">
            <label className="quantity-label-large">Quantity</label>
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
          <button onClick={handleAddToCart} className="add-to-cart-btn-large">
            Add to Cart - ${(currentPrice * quantity).toFixed(2)}
          </button>
        </div>
      </div>
      {showImageModal && product.images && (
        <div className="image-modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
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
            <div className="image-modal-counter">{modalImageIndex + 1} / {product.images.length}</div>
            <div className="image-modal-hint">Press ESC to close</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;