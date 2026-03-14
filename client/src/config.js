const BACKEND_URL = (process.env.NODE_ENV === 'production') ? 'http://72.76.207.228:5000' : 'http://localhost:5000';
console.log(`NODE_ENV: ${process.env.NODE_ENV}, BACKEND_URL: ${BACKEND_URL}`)
export { BACKEND_URL };