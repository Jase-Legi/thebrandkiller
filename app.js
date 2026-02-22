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
// ['users', 'products', 'orders'].forEach(type => {
//   fs.mkdirSync(`${DATA_DIR}/${type}s`, { recursive: true });
// });
// fs.mkdirSync(MEDIA_DIR, { recursive: true });

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

// Encryption
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

// Sequential ID helper
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
  
  // Ensure directory exists before writing
  // Create directories - CORRECTED VERSION
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

  // Call this function
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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
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

// Media upload route (admin only)
app.post('/admin/upload-media', auth, admin, upload.array('media', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ msg: 'No files uploaded' });
  }
  const filePaths = req.files.map(file => `/media/${file.filename}`);
  res.json({ msg: 'Upload successful', files: filePaths });
});

// Enhanced register endpoint with affiliate support
app.post('/register', (req, res) => {
  const { email, password, roleRequested = 'user' } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Missing credentials' });
  
  const users = loadEntities('user');
  if (users.find(u => u.email === email)) return res.status(400).json({ msg: 'Email exists' });
  
  // Validate role
  let role = 'user';
  if (roleRequested === 'affiliate') {
    role = 'affiliate';
  } else if (roleRequested === 'admin') {
    // Only allow admin creation if no admins exist yet (first-time setup)
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
  
  // If affiliate registration, create pending affiliate record
  if (role === 'affiliate') {
    try {
      const affiliateData = {
        id: user.id,
        userId: user.id,
        email: email,
        status: 'pending', // Requires admin approval
        commissionRate: 0.10, // Default 10%
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
      
      // Ensure affiliate directory exists
      if (!fs.existsSync(AFFILIATE_DIR)) {
        fs.mkdirSync(AFFILIATE_DIR, { recursive: true });
      }
      
      const affiliateFile = `${AFFILIATE_DIR}/affiliate-${user.id}.json`;
      fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    } catch (err) {
      console.error('Failed to create affiliate record:', err);
      // Continue with user registration even if affiliate record fails
    }
  }
  
  res.json({ 
    msg: role === 'affiliate' ? 'Affiliate registration submitted for approval' : 'Registered', 
    role,
    userId: user.id
  });
});

// New endpoint for affiliate link generation (affiliate only)
app.get('/affiliate/link/:productId', auth, (req, res) => {
  if (req.user.role !== 'affiliate') return res.status(403).json({ msg: 'Not affiliate' });
  
  const { productId } = req.params;
  const affiliateId = req.user.id; // From decoded JWT
  const link = `http://localhost:3000/product/${productId}?aff=${affiliateId}`;
  res.json({ link });
});

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

app.get('/products', (req, res) => {
  try {
    let products = loadEntities('product');
    
    // Ensure all products have consistent data structure
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


app.post('/admin/products', auth, admin, (req, res) => {
  try {
    const productData = req.body;
    
    // Ensure proper data types
    const processedData = {
      ...productData,
      // Convert prices to numbers
      price: parseFloat(productData.price) || 0,
      promoPrice: productData.promoPrice ? parseFloat(productData.promoPrice) : null,
      weight: parseFloat(productData.weight) || 0,
      estimatedShipping: productData.estimatedShipping ? parseFloat(productData.estimatedShipping) : null,
      
      // Ensure options exist as arrays
      options: {
        sizes: Array.isArray(productData.options?.sizes) ? productData.options.sizes : [],
        colors: Array.isArray(productData.options?.colors) ? productData.options.colors : []
      },
      
      // Ensure health data is properly structured
      health: productData.category === 'supplements' ? {
        ingredients: Array.isArray(productData.health?.ingredients) ? productData.health.ingredients : [],
        dosage: productData.health?.dosage || '',
        form: productData.health?.form || '',
        allergens: Array.isArray(productData.health?.allergens) ? productData.health.allergens : []
      } : { ingredients: [], dosage: '', form: '', allergens: [] },
      
      // Ensure variantImages exists
      variantImages: productData.variantImages || { color: {}, size: {} }
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
    
    // Ensure proper data types
    const processedData = {
      ...existing,
      ...productData,
      id,
      // Convert prices to numbers
      price: parseFloat(productData.price) || existing.price,
      promoPrice: productData.promoPrice ? parseFloat(productData.promoPrice) : null,
      weight: parseFloat(productData.weight) || existing.weight,
      estimatedShipping: productData.estimatedShipping ? parseFloat(productData.estimatedShipping) : null,
      
      // Ensure options exist as arrays
      options: {
        sizes: Array.isArray(productData.options?.sizes) ? productData.options.sizes : existing.options?.sizes || [],
        colors: Array.isArray(productData.options?.colors) ? productData.options.colors : existing.options?.colors || []
      },
      
      // Ensure health data is properly structured
      health: productData.category === 'supplements' ? {
        ingredients: Array.isArray(productData.health?.ingredients) ? productData.health.ingredients : [],
        dosage: productData.health?.dosage || '',
        form: productData.health?.form || '',
        allergens: Array.isArray(productData.health?.allergens) ? productData.health.allergens : []
      } : { ingredients: [], dosage: '', form: '', allergens: [] },
      
      // Ensure variantImages exists
      variantImages: productData.variantImages || existing.variantImages || { color: {}, size: {} }
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

app.post('/orders', (req, res) => {
  const { affiliateId } = req.query; // From URL param
  const orderData = { ...req.body, affiliateId: affiliateId ? parseInt(affiliateId) : null };
  const order = saveEntity('order', orderData);
  
  if (affiliateId) {
    // Record commission (example: 10% default)
    const affiliates = loadAllEntities('affiliate');
    const aff = affiliates.find(a => a.userId === parseInt(affiliateId)) || saveEntity('affiliate', { userId: parseInt(affiliateId), commissions: [] });
    const total = order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const commission = total * 0.10; // Default 10%
    aff.commissions.push({ orderId: order.id, amount: commission });
    saveEntity('affiliate', aff, aff.id); // Update
  }
  
  res.json({ msg: 'Order created', order });
});

// Add this route for serving media thumbnails
app.get('/media/thumbnail/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(MEDIA_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  // For now, just serve the file - you can add image resizing here later
  res.sendFile(filePath);
});

// Add this route after other routes but before app.listen()
app.post('/admin/upload-media', auth, admin, upload.array('media', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ msg: 'No files uploaded' });
    }
    
    const uploadedFiles = req.files.map(file => ({
      url: `/media/${file.filename}`,
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));
    
    res.json({ 
      success: true, 
      message: `Uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ msg: 'Upload failed', error: error.message });
  }
});

app.post('/register-affiliate', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user is already an affiliate
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${user.id}.json`;
    if (fs.existsSync(affiliateFile)) {
      return res.status(400).json({ msg: 'Already registered as affiliate' });
    }
    
    // Create affiliate record
    const affiliateData = {
      id: user.id,
      userId: user.id,
      email: user.email,
      status: 'pending',
      commissionRate: 0.10, // Default 10%
      totalCommissions: 0,
      pendingPayout: 0,
      commissions: [],
      referrals: [],
      joinedDate: new Date().toISOString(),
      lastPayoutDate: null
    };
    
    fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    
    // Update user role
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

// Get affiliate link for specific product
app.get('/affiliate/link/:productId', auth, (req, res) => {
  if (req.user.role !== 'affiliate') return res.status(403).json({ msg: 'Not affiliate' });
  
  const { productId } = req.params;
  const affiliateId = req.user.id;
  const link = `http://localhost:3000/product/${productId}?aff=${affiliateId}`;
  res.json({ link });
});

// Get affiliate commission data
app.get('/affiliate/commission-data', auth, (req, res) => {
  if (req.user.role !== 'affiliate') return res.status(403).json({ msg: 'Not affiliate' });
  
  // Load affiliate settings from file
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
  
  // Get affiliate-specific rate
  const affiliateFile = `${AFFILIATE_DIR}/affiliate-${req.user.id}.json`;
  if (fs.existsSync(affiliateFile)) {
    const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
    settings.rate = affiliateData.commissionRate || settings.rate;
  }
  
  res.json(settings);
});

// Get affiliate stats
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

// Admin: Get all affiliates
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

// Admin: Get affiliate settings
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

// Admin: Update affiliate settings
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

// Admin: Get affiliate stats
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
    
    const stats = {
      totalAffiliates,
      totalCommissionsPaid,
      pendingPayouts,
      totalSalesGenerated
    };
    
    res.json(stats);
  } catch (err) {
    console.error('Error loading admin stats:', err);
    res.status(500).json({ msg: 'Failed to load stats' });
  }
});

// Admin: Update affiliate commission rate
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

// Admin: Approve affiliate
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

// Admin: Suspend affiliate
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

// Admin: Process payout
app.post('/admin/affiliates/:id/payout', auth, admin, (req, res) => {
  try {
    const affiliateId = req.params.id;
    
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${affiliateId}.json`;
    if (!fs.existsSync(affiliateFile)) {
      return res.status(404).json({ msg: 'Affiliate not found' });
    }
    
    const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
    
    // Create payout record
    const payout = {
      id: Date.now(),
      affiliateId: affiliateId,
      amount: affiliateData.pendingPayout || 0,
      date: new Date().toISOString(),
      status: 'paid'
    };
    
    // Update affiliate data
    affiliateData.totalCommissions = (affiliateData.totalCommissions || 0) + (affiliateData.pendingPayout || 0);
    affiliateData.pendingPayout = 0;
    affiliateData.lastPayoutDate = new Date().toISOString();
    affiliateData.payouts = affiliateData.payouts || [];
    affiliateData.payouts.push(payout);
    
    fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    
    // Save payout to separate file
    const payoutFile = `${AFFILIATE_DIR}/payouts/payout-${payout.id}.json`;
    if (!fs.existsSync(`${AFFILIATE_DIR}/payouts`)) {
      fs.mkdirSync(`${AFFILIATE_DIR}/payouts`, { recursive: true });
    }
    fs.writeFileSync(payoutFile, JSON.stringify(payout, null, 2));
    
    res.json({ msg: 'Payout processed', payout });
  } catch (err) {
    console.error('Error processing payout:', err);
    res.status(500).json({ msg: 'Failed to process payout' });
  }
});

// Update order creation to track affiliate referrals
app.post('/orders', (req, res) => {
  const { affiliateId } = req.query; // From URL param
  const orderData = { ...req.body, affiliateId: affiliateId ? parseInt(affiliateId) : null };
  const order = saveEntity('order', orderData);
  
  if (affiliateId) {
    // Record referral
    const affiliateFile = `${AFFILIATE_DIR}/affiliate-${affiliateId}.json`;
    if (fs.existsSync(affiliateFile)) {
      const affiliateData = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
      
      // Add referral
      affiliateData.referrals = affiliateData.referrals || [];
      affiliateData.referrals.push({
        orderId: order.id,
        date: new Date().toISOString(),
        amount: order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0)
      });
      
      // Calculate commission
      const commissionRate = affiliateData.commissionRate || 0.10;
      const total = order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const commission = total * commissionRate;
      
      // Add commission
      affiliateData.commissions = affiliateData.commissions || [];
      affiliateData.commissions.push({
        orderId: order.id,
        amount: commission,
        date: new Date().toISOString(),
        status: 'pending'
      });
      
      // Update pending payout
      affiliateData.pendingPayout = (affiliateData.pendingPayout || 0) + commission;
      
      fs.writeFileSync(affiliateFile, JSON.stringify(affiliateData, null, 2));
    }
  }
  
  res.json({ msg: 'Order created', order });
});

// Create payment intent for wallet payments
app.post('/create-payment-intent', auth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ msg: 'Stripe not configured' });
    }

    const { amount, currency = 'usd' } = req.body;

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Payment intent error:', err);
    res.status(500).json({ msg: 'Failed to create payment intent' });
  }
});2

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Media served at http://localhost:${PORT}/media`);
});