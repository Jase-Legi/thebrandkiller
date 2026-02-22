// src/utils/productUtils.js

export const normalizeProduct = (product) => {
  if (!product) return null;
  
  return {
    ...product,
    // Ensure prices are numbers
    price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
    promoPrice: product.promoPrice ? (typeof product.promoPrice === 'string' ? parseFloat(product.promoPrice) : product.promoPrice) : null,
    weight: typeof product.weight === 'string' ? parseFloat(product.weight) : product.weight,
    estimatedShipping: product.estimatedShipping ? (typeof product.estimatedShipping === 'string' ? parseFloat(product.estimatedShipping) : product.estimatedShipping) : null,
    
    // Ensure options are arrays
    options: {
      sizes: Array.isArray(product.options?.sizes) ? product.options.sizes : 
             (typeof product.options?.sizes === 'string' ? product.options.sizes.split(',').map(s => s.trim()).filter(s => s) : []),
      colors: Array.isArray(product.options?.colors) ? product.options.colors : 
              (typeof product.options?.colors === 'string' ? product.options.colors.split(',').map(c => c.trim()).filter(c => c) : [])
    },
    
    // Ensure health data structure
    health: product.category === 'supplements' ? {
      ingredients: Array.isArray(product.health?.ingredients) ? product.health.ingredients : 
                  (typeof product.health?.ingredients === 'string' ? product.health.ingredients.split(',').map(i => i.trim()).filter(i => i) : []),
      dosage: product.health?.dosage || '',
      form: product.health?.form || '',
      allergens: Array.isArray(product.health?.allergens) ? product.health.allergens : 
                (typeof product.health?.allergens === 'string' ? product.health.allergens.split(',').map(a => a.trim()).filter(a => a) : [])
    } : { ingredients: [], dosage: '', form: '', allergens: [] },
    
    // Ensure variantImages exists
    variantImages: product.variantImages || { color: {}, size: {} },
    
    // Ensure images is an array
    images: Array.isArray(product.images) ? product.images : []
  };
};

export const normalizeProducts = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(product => normalizeProduct(product));
};