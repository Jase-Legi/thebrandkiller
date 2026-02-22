import React, { useState, useEffect } from 'react';
import './Admin.css';
import { useNotifications } from '../components/NotificationManager';

const merchTypes = [
  { value: 'T-Shirt', category: 'clothing' },
  { value: 'Hoodie', category: 'clothing' },
  { value: 'Sweatshirt', category: 'clothing' },
  { value: 'Tank Top', category: 'clothing' },
  { value: 'Long Sleeve', category: 'clothing' },
  { value: 'Sticker', category: 'stickers' },
  { value: 'Shoes', category: 'shoes' },
  { value: 'Health Supplement', category: 'supplements' },
  { value: 'Mug', category: 'accessory' },
  { value: 'Poster', category: 'accessory' },
  { value: 'Phone Case', category: 'accessory' },
  { value: 'Tote Bag', category: 'accessory' },
  { value: 'Hat', category: 'clothing' },
  { value: 'Notebook', category: 'accessory' },
  { value: 'Water Bottle', category: 'accessory' },
];

function Admin({ token, user, axiosInstance }) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'T-Shirt',
    category: 'clothing',
    provider: 'local',
    price: '',
    promoPrice: '',
    weight: '',
    shippingNotes: '',
    videoUrl: '',
    images: [],
    variantImages: { color: {}, size: {} },
    options: { sizes: [], colors: [] },
    health: { ingredients: [], dosage: '', form: '', allergens: [] },
    estimatedShipping: ''
  });
  
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [shippingPreview, setShippingPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [imageEditMode, setImageEditMode] = useState(false);
  const [linkOptionModal, setLinkOptionModal] = useState({
    open: false,
    imageIndex: null,
    optionType: 'color',
    optionValue: ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { showNotification, showConfirmation } = useNotifications();

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchProducts();
    }
  }, [user]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products:', err);
      showNotification('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateField = (name, value) => {
    let error = '';
    if (['name', 'type', 'price', 'weight'].includes(name) && !value) {
      error = 'This field is required';
    }
    if (name === 'price' && value && (isNaN(value) || parseFloat(value) <= 0)) {
      error = 'Price must be a positive number';
    }
    if (name === 'weight' && value && (isNaN(value) || parseFloat(value) <= 0)) {
      error = 'Weight must be a positive number';
    }
    if (name === 'promoPrice' && value && (isNaN(value) || parseFloat(value) < 0)) {
      error = 'Promo price cannot be negative';
    }
    return error;
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateStep = () => {
    const newErrors = {};
    if (step === 1) {
      if (!form.name) newErrors.name = 'Product name is required';
      if (!form.type) newErrors.type = 'Product type is required';
    }
    if (step === 4) {
      if (!form.price) newErrors.price = 'Price is required';
      if (form.price && (isNaN(form.price) || parseFloat(form.price) <= 0)) newErrors.price = 'Invalid price';
      if (!form.weight) newErrors.weight = 'Weight is required';
      if (form.weight && (isNaN(form.weight) || parseFloat(form.weight) <= 0)) newErrors.weight = 'Invalid weight';
    }
    if (step === 3 && imageFiles.length < 4 && !editingProduct) {
      newErrors.images = 'At least 4 images are required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(Math.min(step + 1, 4));
    }
  };

  const prevStep = () => setStep(Math.max(step - 1, 1));

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      type: 'T-Shirt',
      category: 'clothing',
      provider: 'local',
      price: '',
      promoPrice: '',
      weight: '',
      shippingNotes: '',
      videoUrl: '',
      images: [],
      variantImages: { color: {}, size: {} },
      options: { sizes: [], colors: [] },
      health: { ingredients: [], dosage: '', form: '', allergens: [] },
      estimatedShipping: ''
    });
    setImageFiles([]);
    setVideoFile(null);
    setVideoPreview(null);
    setErrors({});
    setStep(1);
    setSelectedImageIndex(null);
    setImageEditMode(false);
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setForm({
      ...product,
      options: product.options || { sizes: [], colors: [] },
      health: product.health || { ingredients: [], dosage: '', form: '', allergens: [] },
      variantImages: product.variantImages || { color: {}, size: {} }
    });
    
    // Use server URLs directly
    if (product.images && product.images.length > 0) {
      const existingImages = product.images.map(url => ({
        preview: url.startsWith('http') ? url : `http://localhost:5000${url}`,
        caption: '',
        alt: '',
        linkedOptions: getLinkedOptionsForImage(url, product.variantImages)
      }));
      setImageFiles(existingImages);
    } else {
      setImageFiles([]);
    }
    
    if (product.videoUrl) {
      setVideoPreview(product.videoUrl);
    }
    
    setErrors({});
    setShowForm(true);
    setStep(1);
  };

  const getLinkedOptionsForImage = (imageUrl, variantImages = {}) => {
    const linkedOptions = {};
    
    if (variantImages.color) {
      Object.entries(variantImages.color).forEach(([color, url]) => {
        if (url === imageUrl) {
          linkedOptions.color = color;
        }
      });
    }
    
    if (variantImages.size) {
      Object.entries(variantImages.size).forEach(([size, url]) => {
        if (url === imageUrl) {
          linkedOptions.size = size;
        }
      });
    }
    
    return linkedOptions;
  };

  const deleteProduct = async (id) => {
    showConfirmation(
      'Delete Product',
      'Are you sure you want to delete this product permanently? This action cannot be undone.',
      async () => {
        setLoading(true);
        try {
          await axiosInstance.delete(`/admin/products/${id}`);
          showNotification('Product deleted successfully', 'success');
          fetchProducts();
        } catch (err) {
          console.error('Delete failed:', err);
          showNotification(err.response?.data?.msg || 'Failed to delete product', 'error');
        } finally {
          setLoading(false);
        }
      },
      () => {}
    );
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (token && imageFiles.length > 0) {
      setUploading(true);
      try {
        const formData = new FormData();
        imageFiles.forEach(file => formData.append('media', file));
        
        const response = await axiosInstance.post('/admin/upload-media', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        console.log('Upload response:', response.data); // Debug log
        
        // Handle different server response structures
        let fileData = [];
        
        // Check if response has files array
        if (response.data && response.data.files && Array.isArray(response.data.files)) {
          fileData = response.data.files;
        } 
        // Check if response has filePaths array (first route in server)
        else if (response.data && response.data.files && Array.isArray(response.data.files)) {
          // If files is array of strings
          if (typeof response.data.files[0] === 'string') {
            fileData = response.data.files.map(filePath => ({ url: filePath }));
          }
        }
        // Check if response itself is an array
        else if (Array.isArray(response.data)) {
          fileData = response.data;
        }
        
        // Process file data to create image objects
        const newImages = fileData.map(item => {
          // Extract URL - handle both object and string responses
          let url = '';
          if (typeof item === 'string') {
            url = item;
          } else if (item && typeof item === 'object') {
            url = item.url || item.preview || item.path || '';
          }
          
          if (!url) {
            console.warn('Could not extract URL from item:', item);
            return null;
          }
          
          // Ensure URL is absolute
          const previewUrl = url.startsWith('http') 
            ? url 
            : `http://localhost:5000${url.startsWith('/') ? url : '/' + url}`;
          
          return {
            preview: previewUrl,
            filename: item.filename || url.split('/').pop() || 'image',
            linkedOptions: {},
            caption: '',
            alt: ''
          };
        }).filter(img => img !== null);
        
        if (newImages.length > 0) {
          setImageFiles(prev => [...prev, ...newImages]);
          showNotification(`Uploaded ${newImages.length} image(s) successfully`, 'success');
        } else {
          showNotification('No valid images were uploaded', 'warning');
        }
        
      } catch (error) {
        console.error('Upload failed:', error);
        showNotification('Failed to upload images to server: ' + (error.message || 'Unknown error'), 'error');
      } finally {
        setUploading(false);
      }
    } else {
      // For local preview without upload (when token is missing)
      const newImages = imageFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        linkedOptions: {},
        caption: '',
        alt: ''
      }));
      
      setImageFiles(prev => [...prev, ...newImages]);
      showNotification(`${newImages.length} image(s) added for preview`, 'info');
    }
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setVideoPreview(previewUrl);
      setForm(prev => ({ ...prev, videoUrl: previewUrl }));
    }
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(null);
    setVideoPreview(null);
    setForm(prev => ({ ...prev, videoUrl: '' }));
  };

  const handleDragOver = (e) => { 
    e.preventDefault(); 
    setDragOver(true); 
  };
  
  const handleDragLeave = () => setDragOver(false);
  
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect({ target: { files } });
  };

  const handleVideoDragOver = (e) => {
    e.preventDefault();
    setVideoDragOver(true);
  };

  const handleVideoDragLeave = () => setVideoDragOver(false);

  const handleVideoDrop = (e) => {
    e.preventDefault();
    setVideoDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const video = files.find(f => f.type.startsWith('video/'));
    if (video) {
      handleVideoSelect({ target: { files: [video] } });
    }
  };

  const removeImage = (index) => {
    showConfirmation(
      'Remove Image',
      'Are you sure you want to remove this image?',
      () => {
        setImageFiles(prev => {
          const newFiles = [...prev];
          const removedFile = newFiles[index];
          
          if (removedFile.linkedOptions) {
            const updatedVariantImages = { ...form.variantImages };
            
            Object.entries(removedFile.linkedOptions).forEach(([optionType, optionValue]) => {
              if (updatedVariantImages[optionType] && updatedVariantImages[optionType][optionValue]) {
                delete updatedVariantImages[optionType][optionValue];
              }
            });
            
            setForm(prevForm => ({
              ...prevForm,
              variantImages: updatedVariantImages
            }));
          }
          
          URL.revokeObjectURL(removedFile.preview);
          newFiles.splice(index, 1);
          return newFiles;
        });
      },
      () => {}
    );
  };

  const moveImage = (index, direction) => {
    setImageFiles(prev => {
      const newFiles = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex >= 0 && newIndex < newFiles.length) {
        [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
      }
      
      return newFiles;
    });
  };

  const editImageMetadata = (index, field, value) => {
    setImageFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], [field]: value };
      return newFiles;
    });
  };

  const openLinkOptionModal = (imageIndex, optionType) => {
    setLinkOptionModal({
      open: true,
      imageIndex,
      optionType,
      optionValue: ''
    });
  };

  const linkImageToOption = () => {
    const { imageIndex, optionType, optionValue } = linkOptionModal;
    
    if (!optionValue || !imageFiles[imageIndex]) return;
    
    const imageUrl = imageFiles[imageIndex]?.preview;
    
    const updatedImageFiles = [...imageFiles];
    const existingLinkedOption = updatedImageFiles[imageIndex].linkedOptions?.[optionType];
    
    if (existingLinkedOption) {
      setForm(prev => {
        const updated = { ...prev.variantImages };
        if (updated[optionType] && updated[optionType][existingLinkedOption]) {
          delete updated[optionType][existingLinkedOption];
        }
        return { ...prev, variantImages: updated };
      });
    }
    
    updatedImageFiles[imageIndex] = {
      ...updatedImageFiles[imageIndex],
      linkedOptions: {
        ...updatedImageFiles[imageIndex].linkedOptions,
        [optionType]: optionValue
      }
    };
    
    setImageFiles(updatedImageFiles);
    
    setForm(prev => ({
      ...prev,
      variantImages: {
        ...prev.variantImages,
        [optionType]: {
          ...prev.variantImages[optionType],
          [optionValue]: imageUrl
        }
      }
    }));
    
    setLinkOptionModal({ open: false, imageIndex: null, optionType: '', optionValue: '' });
    showNotification(`Image linked to ${optionType}: ${optionValue}`, 'success');
  };

  const removeImageLink = (imageIndex, optionType) => {
    showConfirmation(
      'Remove Link',
      `Remove link to ${optionType}?`,
      () => {
        const updatedImageFiles = [...imageFiles];
        const linkedOptions = { ...updatedImageFiles[imageIndex].linkedOptions };
        const removedValue = linkedOptions[optionType];
        
        delete linkedOptions[optionType];
        updatedImageFiles[imageIndex] = { ...updatedImageFiles[imageIndex], linkedOptions };
        setImageFiles(updatedImageFiles);
        
        setForm(prev => {
          const updatedVariantImages = { ...prev.variantImages };
          if (updatedVariantImages[optionType] && updatedVariantImages[optionType][removedValue]) {
            delete updatedVariantImages[optionType][removedValue];
          }
          return { ...prev, variantImages: updatedVariantImages };
        });
        
        showNotification('Link removed', 'info');
      },
      () => {}
    );
  };

  const previewShipping = async () => {
    if (!form.weight) {
      setErrors(prev => ({ ...prev, weight: 'Enter weight first' }));
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post('/admin/shipping-preview', {
        weight: form.weight,
        fromZip: '90210',
        toZip: '10001'
      });
      setShippingPreview(res.data.rates);
      setForm(prev => ({ ...prev, estimatedShipping: res.data.lowestRate }));
      showNotification('Shipping rates calculated', 'success');
    } catch (err) {
      console.error('Shipping preview failed:', err);
      showNotification('Shipping preview failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;

    setSaving(true);
    
    const imageUrls = imageFiles.map(img => img.preview);
    
    const variantImages = { color: {}, size: {} };
    
    imageFiles.forEach(img => {
      if (img.linkedOptions) {
        Object.entries(img.linkedOptions).forEach(([optionType, optionValue]) => {
          if (optionType === 'color' || optionType === 'size') {
            variantImages[optionType][optionValue] = img.preview;
          }
        });
      }
    });

    const productData = {
      ...form,
      images: imageUrls,
      variantImages,
      health: form.category === 'supplements' ? form.health : { ingredients: [], dosage: '', form: '', allergens: [] }
    };

    try {
      if (editingProduct) {
        await axiosInstance.put(`/admin/products/${editingProduct.id}`, productData);
        showNotification('Product updated successfully!', 'success');
      } else {
        await axiosInstance.post('/admin/products', productData);
        showNotification('Product added successfully!', 'success');
      }
      
      setTimeout(() => {
        setShowForm(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
      }, 2000);
    } catch (err) {
      console.error('Save failed:', err);
      showNotification(err.response?.data?.msg || 'Server error. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = merchTypes.find(t => t.value === form.type) || {};
  const isApparel = ['clothing', 'shoes'].includes(selectedType.category);
  const isHealth = selectedType.category === 'supplements';

  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-access-card">
        <h2 style={{ color: '#ff4444' }}>Access Denied</h2>
        <p style={{ color: '#ccc' }}>Admin login required.</p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="admin-container">
        <div className="admin-navbar">
          <h1 className="admin-title">Admin Dashboard</h1>
          <button 
            onClick={() => setShowForm(true)}
            className="admin-add-btn"
          >
            + Add New Product
          </button>
        </div>

        {loading && (
          <div style={{ marginBottom: '20px' }}>
            <div className="loading-bar">
              <div className="loading-bar-fill"></div>
            </div>
            <p className="loading-text">Loading products...</p>
          </div>
        )}

        <div className="admin-section">
          <h3>Products ({products.length})</h3>
          <div className="admin-product-list">
            {products.map(product => (
              <div key={product.id} className="admin-product-item">
                <div className="product-thumb-container">
                  {product.images && product.images[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="product-thumb"
                    />
                  ) : (
                    <div className="product-thumb-placeholder">
                      No Image
                    </div>
                  )}
                </div>
                
                <div className="product-content">
                  <div className="product-header">
                    <div>
                      <h4 className="product-name">{product.name}</h4>
                      <div className="product-meta">
                        <span>${product.price}</span>
                        <span>{product.type}</span>
                        {product.category && (
                          <span className="product-category">
                            {product.category}
                          </span>
                        )}
                      </div>
                      
                      <div className="product-options">
                        {product.options?.sizes?.length > 0 && (
                          <span>Sizes: {product.options.sizes.join(', ')}</span>
                        )}
                        {product.options?.colors?.length > 0 && (
                          <span>Colors: {product.options.colors.join(', ')}</span>
                        )}
                        {product.variantImages && Object.keys(product.variantImages).length > 0 && (
                          <div className="product-variant-indicator">
                            <small>Has linked variant images</small>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="product-actions">
                      <button 
                        onClick={() => startEdit(product)}
                        className="edit-btn"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteProduct(product.id)}
                        className="delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-form-container">
      <h2 className="admin-title">
        {editingProduct ? 'Edit Product' : 'Add New Product'} — Step {step} of 4
      </h2>

      <button 
        onClick={() => { 
          showConfirmation(
            'Cancel Editing',
            'Are you sure you want to cancel? All unsaved changes will be lost.',
            () => {
              setShowForm(false); 
              setEditingProduct(null); 
              resetForm(); 
            },
            () => {}
          );
        }} 
        className="admin-close-btn"
      >
        ✕
      </button>

      {errors.general && <div className="error-message">{errors.general}</div>}
      {errors.generalSuccess && <div className="success-message">{errors.generalSuccess}</div>}

      <div className="admin-progress-container">
        <div className="admin-progress-bar-bg"></div>
        <div className="admin-progress-bar-fill" style={{ width: step === 4 ? '80%' : `${(step - 1) * 26.66}%` }}></div>
        {[1, 2, 3, 4].map((stepNum) => (
          <div key={stepNum} className="admin-progress-step">
            <div className={`admin-progress-circle ${step >= stepNum ? 'active' : ''}`}>
              {stepNum}
            </div>
            <div className="admin-progress-label">
              {stepNum === 1 && 'Basics'}
              {stepNum === 2 && 'Options'}
              {stepNum === 3 && 'Media'}
              {stepNum === 4 && 'Pricing'}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="admin-form">
        {saving && (
          <div className="loading-overlay">
            <div className="loading-bar">
              <div className="loading-bar-fill"></div>
            </div>
            <p className="loading-text">Saving product...</p>
          </div>
        )}

        {step === 1 && (
          <div className="admin-section">
            <label className="form-label form-label-required">Product Name</label>
            <input 
              className="form-input" 
              value={form.name} 
              onChange={e => handleChange('name', e.target.value)}
              placeholder="e.g., Premium Cotton T-Shirt"
            />
            {errors.name && <p className="error-text">{errors.name}</p>}

            <label className="form-label">Description</label>
            <textarea 
              className="form-textarea" 
              value={form.description} 
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your product..."
              rows="4"
            />

            <label className="form-label form-label-required">Product Type</label>
            <select 
              className="form-select" 
              value={form.type} 
              onChange={e => {
                const newType = e.target.value;
                const typeInfo = merchTypes.find(t => t.value === newType);
                setForm(prev => ({ 
                  ...prev, 
                  type: newType,
                  category: typeInfo?.category || 'clothing',
                  health: typeInfo?.category === 'supplements' ? prev.health : { ingredients: [], dosage: '', form: '', allergens: [] }
                }));
              }}
            >
              {merchTypes.map(type => (
                <option key={type.value} value={type.value}>{type.value}</option>
              ))}
            </select>
            {errors.type && <p className="error-text">{errors.type}</p>}

            <label className="form-label">Fulfillment Provider</label>
            <select 
              className="form-select" 
              value={form.provider} 
              onChange={e => setForm(prev => ({ ...prev, provider: e.target.value }))}
            >
              <option value="local">Local/In-house</option>
              <option value="printful">Printful</option>
              <option value="shopify">Shopify</option>
              <option value="custom">Custom API</option>
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="admin-section">
            <h3>Product Options</h3>
            
            {(isApparel || form.type === 'Shoes') && (
              <>
                <label className="form-label">Available Sizes</label>
                <div className="color-button-grid">
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        const sizes = form.options.sizes || [];
                        const newSizes = sizes.includes(size) 
                          ? sizes.filter(s => s !== size)
                          : [...sizes, size];
                        setForm(prev => ({
                          ...prev,
                          options: { ...prev.options, sizes: newSizes }
                        }));
                      }}
                      className={`color-button ${form.options.sizes?.includes(size) ? 'selected' : ''}`}
                    >
                      {size} {form.options.sizes?.includes(size) ? '✓' : ''}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className="form-label">Available Colors</label>
            <div className="color-input-container">
              <input
                type="text"
                className="form-input"
                placeholder="Add a color (e.g., Black, Navy, Heather Grey)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const newColor = e.target.value.trim();
                    const colors = form.options.colors || [];
                    
                    const colorsToAdd = newColor.includes(',') 
                      ? newColor.split(',').map(c => c.trim()).filter(c => c)
                      : [newColor];
                    
                    const updatedColors = [...colors];
                    colorsToAdd.forEach(color => {
                      if (!updatedColors.includes(color)) {
                        updatedColors.push(color);
                      }
                    });
                    
                    setForm(prev => ({
                      ...prev,
                      options: { ...prev.options, colors: updatedColors }
                    }));
                    
                    e.target.value = '';
                  }
                }}
              />
              
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="color"]');
                  if (input && input.value.trim()) {
                    const newColor = input.value.trim();
                    const colors = form.options.colors || [];
                    const colorsToAdd = newColor.includes(',') 
                      ? newColor.split(',').map(c => c.trim()).filter(c => c)
                      : [newColor];
                    
                    const updatedColors = [...colors];
                    colorsToAdd.forEach(color => {
                      if (!updatedColors.includes(color)) {
                        updatedColors.push(color);
                      }
                    });
                    
                    setForm(prev => ({
                      ...prev,
                      options: { ...prev.options, colors: updatedColors }
                    }));
                    
                    input.value = '';
                  }
                }}
                className="btn-primary"
                style={{ marginBottom: '12px' }}
              >
                Add Color(s)
              </button>
              
              <div className="color-button-grid">
                {form.options.colors?.map((color, index) => (
                  <span
                    key={index}
                    className="option-badge"
                  >
                    {color}
                    <button
                      type="button"
                      onClick={() => {
                        const newColors = form.options.colors.filter((_, i) => i !== index);
                        setForm(prev => ({
                          ...prev,
                          options: { ...prev.options, colors: newColors }
                        }));
                      }}
                      className="option-badge-remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {isHealth && (
              <>
                <label className="form-label">Ingredients</label>
                <textarea
                  className="form-textarea"
                  placeholder="List ingredients separated by commas"
                  value={form.health.ingredients?.join(', ') || ''}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    health: { 
                      ...prev.health, 
                      ingredients: e.target.value.split(',').map(i => i.trim()).filter(i => i)
                    }
                  }))}
                  rows="3"
                />

                <div className="form-grid">
                  <div>
                    <label className="form-label">Dosage</label>
                    <input
                      className="form-input"
                      placeholder="e.g., 500mg per capsule"
                      value={form.health.dosage || ''}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        health: { ...prev.health, dosage: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Form</label>
                    <select
                      className="form-select"
                      value={form.health.form || ''}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        health: { ...prev.health, form: e.target.value }
                      }))}
                    >
                      <option value="">Select form</option>
                      <option value="capsule">Capsule</option>
                      <option value="tablet">Tablet</option>
                      <option value="powder">Powder</option>
                      <option value="liquid">Liquid</option>
                    </select>
                  </div>
                </div>

                <label className="form-label">Allergens</label>
                <input
                  className="form-input"
                  placeholder="e.g., Gluten, Soy, Dairy (separate with commas)"
                  value={form.health.allergens?.join(', ') || ''}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    health: { 
                      ...prev.health, 
                      allergens: e.target.value.split(',').map(i => i.trim()).filter(i => i)
                    }
                  }))}
                />
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="admin-section">
            <h3>Product Media</h3>
            
            <div style={{ marginBottom: '32px' }}>
              <label className="form-label">Product Images {!editingProduct && <span className="required-star">*</span>}</label>
              <p className="help-text">
                Upload at least 4 images. First image will be the main display.
                You can link images to specific options (colors/sizes).
              </p>

              <div 
                className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
              >
                {uploading ? (
                  <>
                    <div className="loading-spinner"></div>
                    <p className="dropzone-text">Uploading images...</p>
                  </>
                ) : (
                  <>
                    <div className="dropzone-icon">📁</div>
                    <p className="dropzone-text">
                      Drag & drop images here, or click to browse
                    </p>
                    <p className="dropzone-hint">
                      Supports JPG, PNG, GIF, WebP (Max 100MB each)
                    </p>
                  </>
                )}
              </div>
              
              <input
                type="file"
                id="fileInput"
                multiple
                accept="image/*"
                className="file-input-hidden"
                onChange={handleFileSelect}
              />
              
              {errors.images && <p className="error-text">{errors.images}</p>}

              {imageFiles.length > 0 && (
                <div className="uploaded-images">
                  <h4 className="uploaded-images-title">Uploaded Images ({imageFiles.length})</h4>
                  <div className="image-grid">
                    {imageFiles.map((img, index) => (
                      <div 
                        key={index}
                        className={`image-card ${selectedImageIndex === index ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedImageIndex(index);
                          setImageEditMode(true);
                        }}
                      >
                        <img
                          src={img.preview}
                          alt={`Preview ${index + 1}`}
                          className="image-preview"
                        />
                        
                        <div className="image-index">
                          #{index + 1}
                        </div>
                        
                        <div className="image-controls">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveImage(index, 'up');
                            }}
                            disabled={index === 0}
                            className="image-control-btn"
                          >
                            ↑
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveImage(index, 'down');
                            }}
                            disabled={index === imageFiles.length - 1}
                            className="image-control-btn"
                          >
                            ↓
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(index);
                            }}
                            className="image-control-btn"
                            style={{ background: 'rgba(255,68,68,0.8)' }}
                          >
                            ×
                          </button>
                        </div>
                        
                        {img.linkedOptions && Object.keys(img.linkedOptions).length > 0 && (
                          <div className="image-badges">
                            {Object.entries(img.linkedOptions).map(([type, value]) => (
                              <span
                                key={`${type}-${value}`}
                                className="option-badge"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImageLink(index, type);
                                }}
                              >
                                {type}: {value}
                                <span className="badge-remove">×</span>
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLinkOptionModal(index, 'color');
                          }}
                          className={`link-option-btn ${img.linkedOptions && Object.keys(img.linkedOptions).length > 0 ? 'linked' : ''}`}
                        >
                          {img.linkedOptions && Object.keys(img.linkedOptions).length > 0 ? 'Edit Link' : 'Link to Option'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`upload-stats ${imageFiles.length >= 4 ? 'success' : 'error'}`}>
                <p className={`upload-stats-content ${imageFiles.length >= 4 ? 'upload-stats-success' : 'upload-stats-error'}`}>
                  {imageFiles.length >= 4 ? '✓' : '⚠'} 
                  {imageFiles.length} of minimum 4 images uploaded
                  {imageFiles.length < 4 && ` (need ${4 - imageFiles.length} more)`}
                </p>
              </div>
            </div>

            <div className="video-section">
              <label className="form-label">Product Video (Optional)</label>
              <p className="help-text">
                Upload a product video or enter a video URL (YouTube/Vimeo)
              </p>

              <div 
                className={`upload-dropzone ${videoDragOver ? 'drag-over' : ''}`}
                onDragOver={handleVideoDragOver}
                onDragLeave={handleVideoDragLeave}
                onDrop={handleVideoDrop}
                onClick={() => document.getElementById('videoInput').click()}
              >
                <div className="dropzone-icon">🎥</div>
                <p className="dropzone-text">
                  Drag & drop video here, or click to browse
                </p>
                <p className="dropzone-hint">
                  Supports MP4, MOV, WebM (Max 200MB)
                </p>
              </div>
              
              <input
                type="file"
                id="videoInput"
                accept="video/*"
                className="file-input-hidden"
                onChange={handleVideoSelect}
              />
              
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Or enter video URL:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://youtube.com/watch?v=..."
                  value={form.videoUrl}
                  onChange={e => {
                    setForm(prev => ({ ...prev, videoUrl: e.target.value }));
                    if (e.target.value && !e.target.value.startsWith('blob:')) {
                      setVideoPreview(e.target.value);
                    }
                  }}
                />
              </div>

              {(videoPreview || videoFile) && (
                <div className="video-preview-wrapper">
                  <div className="video-preview-header">
                    <h4>Video Preview</h4>
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="remove-video-btn"
                    >
                      Remove Video
                    </button>
                  </div>
                  
                  {videoPreview && (
                    <div className="video-preview-container">
                      {videoPreview.startsWith('blob:') || videoPreview.includes('youtube') || videoPreview.includes('vimeo') ? (
                        <div className="video-wrapper">
                          {videoPreview.includes('youtube') ? (
                            <iframe
                              src={videoPreview.replace('watch?v=', 'embed/')}
                              className="video-player"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <video
                              src={videoPreview}
                              controls
                              className="video-player"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="video-url-preview">
                          <p>Video URL preview not available</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="admin-section">
            <h3>Pricing & Shipping</h3>
            
            <div className="form-grid">
              <div>
                <label className="form-label form-label-required">Regular Price (USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={form.price} 
                  onChange={e => handleChange('price', e.target.value)}
                  placeholder="0.00"
                />
                {errors.price && <p className="error-text">{errors.price}</p>}
              </div>
              <div>
                <label className="form-label">Promo Price (Optional)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={form.promoPrice} 
                  onChange={e => handleChange('promoPrice', e.target.value)}
                  placeholder="0.00"
                />
                {errors.promoPrice && <p className="error-text">{errors.promoPrice}</p>}
              </div>
            </div>

            <label className="form-label form-label-required">Weight (lbs)</label>
            <input 
              type="number" 
              step="0.1" 
              className="form-input" 
              value={form.weight} 
              onChange={e => handleChange('weight', e.target.value)}
              placeholder="0.5"
            />
            {errors.weight && <p className="error-text">{errors.weight}</p>}

            <button
              type="button"
              onClick={previewShipping}
              className="shipping-preview-btn"
              disabled={loading}
            >
              {loading ? 'Calculating...' : 'Preview Shipping Rates'}
            </button>

            {loading && (
              <div className="loading-bar" style={{ marginTop: '8px' }}>
                <div className="loading-bar-fill"></div>
              </div>
            )}

            {shippingPreview && (
              <div className="shipping-preview-result">
                <h4>Shipping Estimates:</h4>
                <ul className="shipping-list">
                  {shippingPreview.slice(0, 3).map((rate, idx) => (
                    <li key={idx}>
                      {rate.carrier}: {rate.service} - ${rate.rate.toFixed(2)}
                    </li>
                  ))}
                </ul>
                <p>Lowest rate: <strong>${form.estimatedShipping}</strong></p>
              </div>
            )}

            <label className="form-label">Shipping Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={form.shippingNotes}
              onChange={e => setForm(prev => ({ ...prev, shippingNotes: e.target.value }))}
              placeholder="e.g., Ships in 3-5 business days"
            />
          </div>
        )}

        <div className="form-navigation">
          {step > 1 && <button type="button" className="btn-secondary" onClick={prevStep}>← Back</button>}
          {step < 4 && <button type="button" className="btn-primary" onClick={nextStep}>Next →</button>}
          {step === 4 && (
            <button 
              type="submit" 
              className="btn-publish"
              disabled={saving}
            >
              {saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Publish Product'}
            </button>
          )}
        </div>
      </form>

      {linkOptionModal.open && (
        <div className="modal-overlay link-option-modal">
          <div className="modal-content">
            <h3 className="modal-header">Link Image to Option</h3>
            <p className="modal-body">
              Which {linkOptionModal.optionType} should this image represent?
            </p>
            
            <div className="modal-form-group">
              <label className="form-label">Option Type</label>
              <select
                className="form-select"
                value={linkOptionModal.optionType}
                onChange={(e) => setLinkOptionModal(prev => ({ ...prev, optionType: e.target.value }))}
              >
                <option value="color">Color</option>
                <option value="size">Size</option>
              </select>
            </div>
            
            <div className="modal-form-group">
              <label className="form-label">Select Value</label>
              <select
                className="form-select"
                value={linkOptionModal.optionValue}
                onChange={(e) => setLinkOptionModal(prev => ({ ...prev, optionValue: e.target.value }))}
              >
                <option value="">Select {linkOptionModal.optionType}</option>
                {linkOptionModal.optionType === 'color' && 
                  form.options?.colors?.map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                {linkOptionModal.optionType === 'size' && 
                  form.options?.sizes?.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
              </select>
            </div>
            
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setLinkOptionModal({ open: false, imageIndex: null, optionType: '', optionValue: '' })}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={linkImageToOption}
                disabled={!linkOptionModal.optionValue}
                className="btn-primary"
                style={{ opacity: linkOptionModal.optionValue ? 1 : 0.5 }}
              >
                Link Image
              </button>
            </div>
          </div>
        </div>
      )}

      {imageEditMode && selectedImageIndex !== null && (
        <div className="modal-overlay">
          <div className="modal-content image-edit-modal">
            <div className="modal-header">
              <h3>Edit Image #{selectedImageIndex + 1}</h3>
              <button
                type="button"
                onClick={() => {
                  setImageEditMode(false);
                  setSelectedImageIndex(null);
                }}
                className="admin-close-btn"
              >
                ×
              </button>
            </div>
            
            <div className="image-edit-grid">
              <div>
                <img
                  src={imageFiles[selectedImageIndex]?.preview}
                  alt="Editing"
                  className="image-preview-large"
                />
                <p className="image-info">
                  Image {selectedImageIndex + 1} of {imageFiles.length}
                </p>
              </div>
              
              <div className="image-edit-metadata">
                <div className="edit-form-group">
                  <label className="form-label">Caption</label>
                  <input
                    type="text"
                    className="form-input"
                    value={imageFiles[selectedImageIndex]?.caption || ''}
                    onChange={(e) => editImageMetadata(selectedImageIndex, 'caption', e.target.value)}
                    placeholder="Image caption (shown on hover)"
                  />
                </div>
                
                <div className="edit-form-group">
                  <label className="form-label">Alt Text</label>
                  <input
                    type="text"
                    className="form-input"
                    value={imageFiles[selectedImageIndex]?.alt || ''}
                    onChange={(e) => editImageMetadata(selectedImageIndex, 'alt', e.target.value)}
                    placeholder="Description for screen readers"
                  />
                </div>
                
                <div className="edit-form-group">
                  <label className="form-label">Linked Options</label>
                  {imageFiles[selectedImageIndex]?.linkedOptions && 
                   Object.keys(imageFiles[selectedImageIndex].linkedOptions).length > 0 ? (
                    <div className="linked-options-list">
                      {Object.entries(imageFiles[selectedImageIndex].linkedOptions).map(([type, value]) => (
                        <div key={`${type}-${value}`} className="linked-option-item">
                          <span>
                            <strong>{type}:</strong> {value}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeImageLink(selectedImageIndex, type)}
                            className="remove-link-btn"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-options-text">No options linked to this image</p>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => openLinkOptionModal(selectedImageIndex, 'color')}
                    className="link-option-primary-btn"
                  >
                    + Link to Option
                  </button>
                </div>
                
                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => {
                      setImageEditMode(false);
                      setSelectedImageIndex(null);
                    }}
                    className="btn-secondary"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;