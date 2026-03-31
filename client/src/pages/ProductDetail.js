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
  const [currentPrice, setCurrentPrice] = useState(0);

  console.log('🔄 ProductDetail component rendering');

  // Fetch product data
  useEffect(() => {
    console.log('📦 Fetching product...');
    const fetchProduct = async () => {
      try {
        const res = await axios.get('http://localhost:5000/products');
        const found = res.data.find(p => p.id === parseInt(id));
        if (!found) {
          navigate('/not-found');
          return;
        }
        console.log('✅ Product loaded:', found);
        setProduct(found);

        // Initialize price from first variant or regular price
        if (found.printfulConfig?.variants?.length) {
          console.log('Found variants:', found.printfulConfig.variants);
          setCurrentPrice(found.printfulConfig.variants[0].price);
        } else {
          setCurrentPrice(found.promoPrice || found.price);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to load product:', err);
        setError('Failed to load product');
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, navigate]);

  // Update price when selected options change – now depends on product.id's selected options
  useEffect(() => {
    console.log('🎯 Price update effect running');
    if (!product) {
      console.log('No product yet, skipping');
      return;
    }

    const options = selectedOptions[product.id] || {};
    const selectedSize = options.size ? options.size.trim().toLowerCase() : null;
    const selectedColor = options.color ? options.color.trim().toLowerCase() : null;

    console.log(`Selected size: ${selectedSize}, selected color: ${selectedColor}`);

    if (product.printfulConfig?.variants?.length) {
      console.log('Variants available:', product.printfulConfig.variants);
      const matchingVariant = product.printfulConfig.variants.find(v => {
        const variantSize = v.size ? v.size.trim().toLowerCase() : null;
        const variantColor = v.color ? v.color.trim().toLowerCase() : null;
        return variantSize === selectedSize && variantColor === selectedColor;
      });

      if (matchingVariant) {
        console.log('Matching variant found, setting price to', matchingVariant.price);
        setCurrentPrice(matchingVariant.price);
      } else {
        console.log('No matching variant');
        // If both selected but no match, fallback to first variant
        if (selectedSize && selectedColor) {
          setCurrentPrice(product.printfulConfig.variants[0].price);
        }
      }
    } else {
      console.log('No variants or printfulConfig missing');
    }
  }, [selectedOptions, product]); // Keep full selectedOptions dependency for safety

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
    console.log(`🔄 Option changed: ${type} = ${value}`);
    updateSelectedOptions(product.id, { [type]: value });

    // Update variant image if available
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
          <select
            className="option-select-large"
            value={selectedValue}
            onChange={e => handleOptionChange(optionKey, e.target.value)}
          >
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
    const missingOptions = [];
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
      if (window.showNotification) window.showNotification(errorMessage, 'error');
      return;
    }

    addToCart({ ...product, selectedPrice: currentPrice }, quantity, productOptions);

    // Reset selections for this product
    updateSelectedOptions(product.id, { size: '', color: '' });
    if (product.images && product.images.length > 0) {
      updateSelectedImage(product.id, product.images[0]);
      setActiveImageIndex(0);
    }
  };

  if (loading) return <div className="loading-state">Loading product...</div>;
  if (!product) return <div className="error-state">Product not found</div>;

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