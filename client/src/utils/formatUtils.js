// src/utils/formatUtils.js

export const getOptionValues = (options, optionType) => {
  if (!options) return [];
  
  // Handle the optionType parameter correctly
  const key = optionType === 'sizes' ? 'sizes' : 
              optionType === 'colors' ? 'colors' : optionType;
  
  const optionArray = options[key];
  
  if (Array.isArray(optionArray)) {
    return optionArray.filter(item => item && item.trim() !== '');
  }
  
  if (typeof optionArray === 'string') {
    return optionArray.split(',')
      .map(item => item.trim())
      .filter(item => item !== '');
  }
  
  return [];
};

export const formatPrice = (price) => {
  if (typeof price === 'string') {
    return parseFloat(price);
  }
  return price || 0;
};

export const hasOptions = (product) => {
  if (!product || !product.options) return false;
  
  const sizes = getOptionValues(product.options, 'sizes');
  const colors = getOptionValues(product.options, 'colors');
  
  return sizes.length > 0 || colors.length > 0;
};