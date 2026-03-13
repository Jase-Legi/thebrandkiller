require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const EasyPostClient = require('@easypost/api');
const axios = require('axios'); // Added for Printful/Printify API calls
const clientURL = (process.env.NODE_ENV === 'production') ? 'https://thebrandkiller.netlify.app' : 'http://localhost:3000';
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = 5000;

// Paths
const DATA_DIR = './data';
const MEDIA_DIR = './media';
const ENCRYPT_KEY = Buffer.from(process.env.ENCRYPT_KEY || '123456789012345678901234567890ab', 'hex');
const IV_LENGTH = 16;
const JWT_SECRET = process.env.JWT_SECRET || 'fallbacksecret';

// Create directories
console.log('Checking directories...');
['user', 'product', 'order'].forEach(type => {
  const dirPath = `${DATA_DIR}/${type}s`;
  if (!fs.existsSync(dirPath)) {
    console.error(`Directory missing: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created: ${dirPath}`);
  } else {
    console.log(`Directory exists: ${dirPath}`);
  }
});

// EasyPost (optional)
let easyPostClient = null;
if (process.env.EASYPOST_API_KEY) {
  easyPostClient = new EasyPostClient(process.env.EASYPOST_API_KEY);
}

// Stripe (safe init)
let stripe = null;
if (process.env.STRIPE_SECRET && process.env.STRIPE_SECRET.trim()) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET.trim());
    console.log('Stripe initialized');
  } catch (err) {
    console.error('Stripe init failed:', err.message);
  }
} else {
  console.warn('STRIPE_SECRET not set – Stripe disabled');
}

const AFFILIATE_DIR = `${DATA_DIR}/affiliates`;
if (!fs.existsSync(AFFILIATE_DIR)) {
  fs.mkdirSync(AFFILIATE_DIR, { recursive: true });
}

// Encryption helpers
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPT_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText.includes(':')) {
    throw new Error('Invalid encrypted data format');
  }
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPT_KEY, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ID helper
function getNextId(type) {
  const dir = `${DATA_DIR}/${type}s`;
  if (!fs.existsSync(dir)) return 1;
  const files = fs.readdirSync(dir);
  const ids = files
    .filter(f => f.startsWith(`${type}-`))
    .map(f => parseInt(f.split('-')[1].split('.')[0]) || 0);
  return Math.max(...ids, 0) + 1;
}

// Entity helpers
function saveEntity(type, data) {
  const id = data.id || getNextId(type);
  data.id = id;
  data.updatedAt = new Date().toISOString();
  if (!data.createdAt) data.createdAt = data.updatedAt;

  const paddedId = String(id).padStart(4, '0');
  const filePath = `${DATA_DIR}/${type}s/${type}-${paddedId}.enc.json`;
  
  const ensureDirectories = () => {
    const dirs = [
      `${DATA_DIR}/users`,
      `${DATA_DIR}/products`, 
      `${DATA_DIR}/orders`,
      MEDIA_DIR
    ];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  };
  ensureDirectories();
  
  const jsonStr = JSON.stringify(data);
  const encrypted = encrypt(jsonStr);
  fs.writeFileSync(filePath, encrypted);
  return data;
}

function loadEntities(type) {
  const dir = `${DATA_DIR}/${type}s`;
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  return files.map(f => {
    try {
      const data = fs.readFileSync(`${dir}/${f}`, 'utf8');
      return JSON.parse(decrypt(data));
    } catch (err) {
      console.error(`Failed to load ${f}:`, err.message);
      return null;
    }
  }).filter(Boolean);
}

function loadEntity(type, id) {
  const paddedId = String(id).padStart(4, '0');
  const filePath = `${DATA_DIR}/${type}s/${type}-${paddedId}.enc.json`;
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return null;
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    if (!data || data.trim() === '') {
      console.log(`Empty file: ${filePath}`);
      return null;
    }
    return JSON.parse(decrypt(data));
  } catch (err) {
    console.error(`Failed to decrypt/load ${filePath}:`, err.message);
    return null;
  }
}

function deleteEntity(type, id) {
  const paddedId = String(id).padStart(4, '0');
  const filePath = `${DATA_DIR}/${type}s/${type}-${paddedId}.enc.json`;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase()) &&
                  allowed.test(file.mimetype);
    cb(null, valid ? true : new Error('Invalid file type'));
  }
});

// Serve media
app.use('/media', express.static(MEDIA_DIR));

// Auth middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ msg: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

const admin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Admin only' });
  next();
};

// Media upload (admin only)
app.post('/admin/upload-media', auth, admin, upload.array('media', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ msg: 'No files uploaded' });
  }
  const filePaths = req.files.map(file => `/media/${file.filename}`);
  res.json({ msg: 'Upload successful', files: filePaths });
});

// Register
app.post('/register', (req, res) => {
  const { email, password, roleRequested = 'user' } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Missing credentials' });
  
  const users = loadEntities('user');
  if (users.find(u => u.email === email)) return res.status(400).json({ msg: 'Email exists' });
  
  let role = 'user';
  if (roleRequested === 'affiliate') {
    role = 'affiliate';
  } else if (roleRequested === 'admin') {
    const admins = users.filter(u => u.role === 'admin');
    if (admins.length === 0) {
      role = 'admin';
    } else {
      return res.status(403).json({ msg: 'Admin accounts can only be created during setup' });
    }
  }
  
  const hashed = bcrypt.hashSync(password, 10);
  const user = saveEntity('user', { 
    email, 
    password: hashed, 
    role,
    createdAt: new Date().toISOString(),
    lastLogin: null,
    status: 'active'
  });
  
  if (role === 'affiliate') {
    try {
      const affiliateData = {
        id: user.id,
        userId: user.id,
        email: email,
        status: 'pending',
        commissionRate: 0.10,
        totalCommissions: 0,
        pendingPayout: 0,
        commissions: [],
        referrals: [],
        joinedDate: new Date().toISOString(),
        lastPayoutDate: null,
        application: {
          date: new Date().toISOString(),
          status: 'pending',
          notes: 'Auto-generated from registration'
        }
      };
      
      if (!fs.existsSync(AFFILIATE_DIR)) {
        fs.mkdirSync(AFFILIATE_DIR, { recursive: true });
      }
      
      const affiliateFile = `${AFFILIATE_DIR}/affiliate-${user.id}.json`;
      fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    } catch (err) {
      console.error('Failed to create affiliate record:', err);
    }
  }
  
  res.json({ 
    msg: role === 'affiliate' ? 'Affiliate registration submitted for approval' : 'Registered', 
    role,
    userId: user.id
  });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password, roleRequested } = req.body;
  const users = loadEntities('user');
  const user = users.find(u => u.email === email);
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(400).json({ msg: 'Invalid credentials' });
  }
  if (roleRequested === 'admin' && user.role !== 'admin') {
    return res.status(403).json({ msg: 'Not admin' });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: user.role });
});

// Products (public)
app.get('/products', (req, res) => {
  try {
    let products = loadEntities('product');
    
    products = products.map(product => ({
      ...product,
      price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
      promoPrice: product.promoPrice ? (typeof product.promoPrice === 'string' ? parseFloat(product.promoPrice) : product.promoPrice) : null,
      weight: typeof product.weight === 'string' ? parseFloat(product.weight) : product.weight,
      estimatedShipping: product.estimatedShipping ? (typeof product.estimatedShipping === 'string' ? parseFloat(product.estimatedShipping) : product.estimatedShipping) : null,
      options: {
        sizes: Array.isArray(product.options?.sizes) ? product.options.sizes : [],
        colors: Array.isArray(product.options?.colors) ? product.options.colors : []
      },
      health: product.health || { ingredients: [], dosage: '', form: '', allergens: [] },
      variantImages: product.variantImages || { color: {}, size: {} }
    }));
    
    res.json(products);
  } catch (err) {
    console.error('Error loading products:', err);
    res.status(500).json({ msg: 'Failed to load products' });
  }
});

// Admin product CRUD
app.post('/admin/products', auth, admin, (req, res) => {
  try {
    const productData = req.body;
    
    const processedData = {
      ...productData,
      price: parseFloat(productData.price) || 0,
      promoPrice: productData.promoPrice ? parseFloat(productData.promoPrice) : null,
      weight: parseFloat(productData.weight) || 0,
      estimatedShipping: productData.estimatedShipping ? parseFloat(productData.estimatedShipping) : null,
      options: {
        sizes: Array.isArray(productData.options?.sizes) ? productData.options.sizes : [],
        colors: Array.isArray(productData.options?.colors) ? productData.options.colors : []
      },
      health: productData.category === 'supplements' ? {
        ingredients: Array.isArray(productData.health?.ingredients) ? productData.health.ingredients : [],
        dosage: productData.health?.dosage || '',
        form: productData.health?.form || '',
        allergens: Array.isArray(productData.health?.allergens) ? productData.health.allergens : []
      } : { ingredients: [], dosage: '', form: '', allergens: [] },
      variantImages: productData.variantImages || { color: {}, size: {} },
      platformProductId: productData.platformProductId || '',
      platformProductData: productData.platformProductData || null,
    };
    
    const product = saveEntity('product', processedData);
    res.json({ msg: 'Product added', product });
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).json({ msg: 'Failed to save product' });
  }
});

app.put('/admin/products/:id', auth, admin, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = loadEntity('product', id);
  if (!existing) {
    return res.status(404).json({ msg: 'Product not found' });
  }

  try {
    const productData = req.body;
    
    const processedData = {
      ...existing,
      ...productData,
      id,
      price: parseFloat(productData.price) || existing.price,
      promoPrice: productData.promoPrice ? parseFloat(productData.promoPrice) : null,
      weight: parseFloat(productData.weight) || existing.weight,
      estimatedShipping: productData.estimatedShipping ? parseFloat(productData.estimatedShipping) : null,
      options: {
        sizes: Array.isArray(productData.options?.sizes) ? productData.options.sizes : existing.options?.sizes || [],
        colors: Array.isArray(productData.options?.colors) ? productData.options.colors : existing.options?.colors || []
      },
      health: productData.category === 'supplements' ? {
        ingredients: Array.isArray(productData.health?.ingredients) ? productData.health.ingredients : [],
        dosage: productData.health?.dosage || '',
        form: productData.health?.form || '',
        allergens: Array.isArray(productData.health?.allergens) ? productData.health.allergens : []
      } : { ingredients: [], dosage: '', form: '', allergens: [] },
      variantImages: productData.variantImages || existing.variantImages || { color: {}, size: {} },
      platformProductId: productData.platformProductId || existing.platformProductId || '',
      platformProductData: productData.platformProductData || existing.platformProductData || null,
    };
    
    saveEntity('product', processedData);
    res.json({ msg: 'Product updated', product: processedData });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ msg: 'Failed to update product' });
  }
});

app.delete('/admin/products/:id', auth, admin, (req, res) => {
  const id = parseInt(req.params.id);
  deleteEntity('product', id);
  res.json({ msg: 'Product deleted' });
});

// Shipping preview
app.post('/admin/shipping-preview', auth, admin, async (req, res) => {
  const { weight, fromZip = '90210', toZip = '10001' } = req.body;
  if (!weight || !easyPostClient) return res.status(400).json({ msg: 'Config missing' });

  try {
    const parcel = await easyPostClient.Parcel.create({ weight: weight * 16 });
    const shipment = await easyPostClient.Shipment.create({
      from_address: { zip: fromZip },
      to_address: { zip: toZip },
      parcel
    });
    const rates = shipment.rates.map(r => ({
      carrier: r.carrier,
      service: r.service,
      rate: parseFloat(r.rate)
    })).sort((a, b) => a.rate - b.rate);
    const lowestRate = rates[0]?.rate || null;
    res.json({ rates, lowestRate });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Printful products (catalog)
app.get('/admin/printful/products', auth, admin, async (req, res) => {
  try {
    const apiKey = process.env.PRINTFUL_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ msg: 'Printful API key not configured' });
    }
    const response = await axios.get('https://api.printful.com/products', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const products = response.data.result.map(p => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail_url,
      description: p.description,
    }));
    res.json(products);
  } catch (err) {
    console.error('Printful API error:', err.response?.data || err.message);
    res.status(500).json({ msg: 'Failed to fetch Printful products' });
  }
});

// Get detailed Printful product info (variants, images)
app.get('/admin/printful/product/:productId', auth, admin, async (req, res) => {
  try {
    const apiKey = process.env.PRINTFUL_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ msg: 'Printful API key not configured' });
    }
    const { productId } = req.params;
    const response = await axios.get(`https://api.printful.com/products/${productId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const productData = response.data.result;
    
    // Extract variants (sizes, colors) and images
    const variants = productData.variants || [];
    const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
    const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];
    const images = variants.map(v => v.image).filter(Boolean);
    // Also include main product image if available
    if (productData.image && !images.includes(productData.image)) {
      images.unshift(productData.image);
    }

    const detailedProduct = {
      id: productData.id,
      name: productData.name,
      description: productData.description,
      type: productData.type_name, // e.g., "T-Shirt"
      category: mapPrintfulCategory(productData.type_name), // map to our categories
      sizes,
      colors,
      images,
      // Optionally include variant-specific images mapping
      variantImages: buildVariantImages(variants)
    };

    res.json(detailedProduct);
  } catch (err) {
    console.error('Printful product detail error:', err.response?.data || err.message);
    res.status(500).json({ msg: 'Failed to fetch Printful product details' });
  }
});

// Helper to map Printful type to our category
function mapPrintfulCategory(printfulType) {
  const typeLower = (printfulType || '').toLowerCase();
  if (typeLower.includes('shirt') || typeLower.includes('hoodie') || typeLower.includes('sweatshirt') || typeLower.includes('hat')) {
    return 'clothing';
  }
  if (typeLower.includes('shoe')) return 'shoes';
  if (typeLower.includes('sticker')) return 'stickers';
  if (typeLower.includes('mug') || typeLower.includes('poster') || typeLower.includes('phone case') || typeLower.includes('tote')) {
    return 'accessory';
  }
  return 'clothing'; // default
}

// Helper to build variantImages mapping (color -> image, size -> image)
function buildVariantImages(variants) {
  const variantImages = { color: {}, size: {} };
  variants.forEach(v => {
    if (v.color && v.image) {
      variantImages.color[v.color] = v.image;
    }
    if (v.size && v.image) {
      variantImages.size[v.size] = v.image;
    }
  });
  return variantImages;
}

// Printify products
app.get('/admin/printify/products', auth, admin, async (req, res) => {
  try {
    const apiKey = process.env.PRINTIFY_API_KEY;
    const shopId = process.env.PRINTIFY_SHOP_ID;
    if (!apiKey || !shopId) {
      return res.status(400).json({ msg: 'Printify API key or shop ID not configured' });
    }
    const response = await axios.get(`https://api.printify.com/v1/shops/${shopId}/products.json`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const products = response.data.data.map(p => ({
      id: p.id,
      name: p.title,
      thumbnail: p.images?.[0]?.src,
      description: p.description,
    }));
    res.json(products);
  } catch (err) {
    console.error('Printify API error:', err.response?.data || err.message);
    res.status(500).json({ msg: 'Failed to fetch Printify products' });
  }
});

// Create payment intent for Stripe
app.post('/create-payment-intent', auth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ msg: 'Stripe not configured' });
    }
    const { amount, currency = 'usd' } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: currency,
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Payment intent error:', err);
    res.status(500).json({ msg: 'Failed to create payment intent' });
  }
});

// Affiliate routes (keep your existing affiliate routes here)
app.get('/affiliate/link/:productId', auth, (req, res) => {
  if (req.user.role !== 'affiliate') return res.status(403).json({ msg: 'Not affiliate' });
  const { productId } = req.params;
  const affiliateId = req.user.id;
  const link = `${clientURL}/product/${productId}?aff=${affiliateId}`;
  res.json({ link });
});

app.get('/affiliate/commission-data', auth, (req, res) => {
  if (req.user.role !== 'affiliate') return res.status(403).json({ msg: 'Not affiliate' });
  let settings = {
    rate: 0.10,
    minimumPayout: 50,
    payoutSchedule: 'monthly',
    cookieDuration: 30,
    terms: 'Standard affiliate terms apply'
  };
  try {
    const settingsFile = `${DATA_DIR}/affiliate-settings.json`;
    if (fs.existsSync(settingsFile)) {
      const savedSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      settings = { ...settings, ...savedSettings };
    }
  } catch (err) {
    console.error('Error loading affiliate settings:', err);
  }
  const affiliateFile = `${AFFILIATE_DIR}/affiliate-${req.user.id}.json`;
  if (fs.existsSync(affiliateFile)) {
    const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
    settings.rate = affiliateData.commissionRate || settings.rate;
  }
  res.json(settings);
});

app.get('/affiliate/stats', auth, (req, res) => {
  if (req.user.role !== 'affiliate') return res.status(403).json({ msg: 'Not affiliate' });
  const affiliateFile = `${AFFILIATE_DIR}/affiliate-${req.user.id}.json`;
  if (!fs.existsSync(affiliateFile)) {
    return res.status(404).json({ msg: 'Affiliate not found' });
  }
  const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
  const stats = {
    totalCommissions: affiliateData.totalCommissions || 0,
    totalSales: affiliateData.referrals?.length || 0,
    pendingCommissions: affiliateData.pendingPayout || 0,
    conversionRate: affiliateData.referrals?.length > 0 ? 
      Math.min(100, (affiliateData.commissions?.length / affiliateData.referrals?.length) * 100).toFixed(1) : 0
  };
  res.json(stats);
});

app.post('/register-affiliate', auth, async (req, res) => {
  try {
    const user = req.user;
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${user.id}.json`;
    if (fs.existsSync(affiliateFile)) {
      return res.status(400).json({ msg: 'Already registered as affiliate' });
    }
    const affiliateData = {
      id: user.id,
      userId: user.id,
      email: user.email,
      status: 'pending',
      commissionRate: 0.10,
      totalCommissions: 0,
      pendingPayout: 0,
      commissions: [],
      referrals: [],
      joinedDate: new Date().toISOString(),
      lastPayoutDate: null
    };
    fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    const userFile = `${DATA_DIR}/users/user-${String(user.id).padStart(4, '0')}.enc.json`;
    if (fs.existsSync(userFile)) {
      const encrypted = fs.readFileSync(userFile, 'utf8');
      const userData = JSON.parse(decrypt(encrypted));
      userData.role = 'affiliate';
      const updatedEncrypted = encrypt(JSON.stringify(userData));
      fs.writeFileSync(userFile, updatedEncrypted);
    }
    res.json({ msg: 'Affiliate registration submitted for approval', affiliate: affiliateData });
  } catch (err) {
    console.error('Affiliate registration error:', err);
    res.status(500).json({ msg: 'Registration failed' });
  }
});

// Admin affiliate management routes (keep your existing ones)
app.get('/admin/affiliates', auth, admin, (req, res) => {
  try {
    const affiliates = [];
    if (fs.existsSync(AFFILIATE_DIR)) {
      const files = fs.readdirSync(AFFILIATE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(`${AFFILIATE_DIR}/${file}`, 'utf8'));
          affiliates.push(data);
        }
      }
    }
    res.json(affiliates);
  } catch (err) {
    console.error('Error loading affiliates:', err);
    res.status(500).json({ msg: 'Failed to load affiliates' });
  }
});

app.get('/admin/affiliate-settings', auth, admin, (req, res) => {
  try {
    const settingsFile = `${DATA_DIR}/affiliate-settings.json`;
    let settings = {
      defaultRate: 0.10,
      minimumPayout: 50,
      payoutSchedule: 'monthly',
      cookieDuration: 30,
      terms: 'Standard affiliate terms apply'
    };
    if (fs.existsSync(settingsFile)) {
      const savedSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      settings = { ...settings, ...savedSettings };
    }
    res.json(settings);
  } catch (err) {
    console.error('Error loading settings:', err);
    res.status(500).json({ msg: 'Failed to load settings' });
  }
});

app.put('/admin/affiliate-settings', auth, admin, (req, res) => {
  try {
    const settings = req.body;
    const settingsFile = `${DATA_DIR}/affiliate-settings.json`;
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    res.json({ msg: 'Settings saved', settings });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ msg: 'Failed to save settings' });
  }
});

app.get('/admin/affiliate-stats', auth, admin, (req, res) => {
  try {
    let totalAffiliates = 0;
    let totalCommissionsPaid = 0;
    let pendingPayouts = 0;
    let totalSalesGenerated = 0;
    if (fs.existsSync(AFFILIATE_DIR)) {
      const files = fs.readdirSync(AFFILIATE_DIR);
      totalAffiliates = files.length;
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(`${AFFILIATE_DIR}/${file}`, 'utf8'));
          totalCommissionsPaid += data.totalCommissions || 0;
          pendingPayouts += data.pendingPayout || 0;
          totalSalesGenerated += data.referrals?.length || 0;
        }
      }
    }
    res.json({ totalAffiliates, totalCommissionsPaid, pendingPayouts, totalSalesGenerated });
  } catch (err) {
    console.error('Error loading admin stats:', err);
    res.status(500).json({ msg: 'Failed to load stats' });
  }
});

app.put('/admin/affiliates/:id/commission', auth, admin, (req, res) => {
  try {
    const affiliateId = req.params.id;
    const { rate } = req.body;
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${affiliateId}.json`;
    if (!fs.existsSync(affiliateFile)) {
      return res.status(404).json({ msg: 'Affiliate not found' });
    }
    const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
    affiliateData.commissionRate = rate;
    fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    res.json({ msg: 'Commission rate updated', affiliate: affiliateData });
  } catch (err) {
    console.error('Error updating commission:', err);
    res.status(500).json({ msg: 'Failed to update commission' });
  }
});

app.post('/admin/affiliates/:id/approve', auth, admin, (req, res) => {
  try {
    const affiliateId = req.params.id;
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${affiliateId}.json`;
    if (!fs.existsSync(affiliateFile)) {
      return res.status(404).json({ msg: 'Affiliate not found' });
    }
    const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
    affiliateData.status = 'active';
    fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    res.json({ msg: 'Affiliate approved', affiliate: affiliateData });
  } catch (err) {
    console.error('Error approving affiliate:', err);
    res.status(500).json({ msg: 'Failed to approve affiliate' });
  }
});

app.post('/admin/affiliates/:id/suspend', auth, admin, (req, res) => {
  try {
    const affiliateId = req.params.id;
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${affiliateId}.json`;
    if (!fs.existsSync(affiliateFile)) {
      return res.status(404).json({ msg: 'Affiliate not found' });
    }
    const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
    affiliateData.status = 'suspended';
    fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    res.json({ msg: 'Affiliate suspended', affiliate: affiliateData });
  } catch (err) {
    console.error('Error suspending affiliate:', err);
    res.status(500).json({ msg: 'Failed to suspend affiliate' });
  }
});

app.post('/admin/affiliates/:id/payout', auth, admin, (req, res) => {
  try {
    const affiliateId = req.params.id;
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${affiliateId}.json`;
    if (!fs.existsSync(affiliateFile)) {
      return res.status(404).json({ msg: 'Affiliate not found' });
    }
    const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
    const payout = {
      id: Date.now(),
      affiliateId: affiliateId,
      amount: affiliateData.pendingPayout || 0,
      date: new Date().toISOString(),
      status: 'paid'
    };
    affiliateData.totalCommissions = (affiliateData.totalCommissions || 0) + (affiliateData.pendingPayout || 0);
    affiliateData.pendingPayout = 0;
    affiliateData.lastPayoutDate = new Date().toISOString();
    affiliateData.payouts = affiliateData.payouts || [];
    affiliateData.payouts.push(payout);
    fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    const payoutDir = `${AFFILIATE_DIR}/payouts`;
    if (!fs.existsSync(payoutDir)) {
      fs.mkdirSync(payoutDir, { recursive: true });
    }
    fs.writeFileSync(`${payoutDir}/payout-${payout.id}.json`, JSON.stringify(payout, null, 2));
    res.json({ msg: 'Payout processed', payout });
  } catch (err) {
    console.error('Error processing payout:', err);
    res.status(500).json({ msg: 'Failed to process payout' });
  }
});

// Order creation with affiliate tracking
app.post('/orders', (req, res) => {
  const { affiliateId } = req.query;
  const orderData = { ...req.body, affiliateId: affiliateId ? parseInt(affiliateId) : null };
  const order = saveEntity('order', orderData);
  
  if (affiliateId) {
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${affiliateId}.json`;
    if (fs.existsSync(affiliateFile)) {
      const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
      affiliateData.referrals = affiliateData.referrals || [];
      affiliateData.referrals.push({
        orderId: order.id,
        date: new Date().toISOString(),
        amount: order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0)
      });
      const commissionRate = affiliateData.commissionRate || 0.10;
      const total = order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const commission = total * commissionRate;
      affiliateData.commissions = affiliateData.commissions || [];
      affiliateData.commissions.push({
        orderId: order.id,
        amount: commission,
        date: new Date().toISOString(),
        status: 'pending'
      });
      affiliateData.pendingPayout = (affiliateData.pendingPayout || 0) + commission;
      fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    }
  }
  
  res.json({ msg: 'Order created', order });
});

// Test Stripe connection (optional)
app.get('/test-stripe', (req, res) => {
  if (stripe) {
    res.json({ connected: true, message: 'Stripe is configured' });
  } else {
    res.json({ connected: false, message: 'Stripe not configured' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Media served at http://localhost:${PORT}/media`);
});
