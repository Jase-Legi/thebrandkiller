const BACKEND_URL = (process.env.NODE_ENV === 'production') ? 'https://api.awbyn.com' : 'http://localhost:5000';
console.log(`NODE_ENV: ${process.env.NODE_ENV}, BACKEND_URL: ${BACKEND_URL}`)
export { BACKEND_URL };


// 'https://72.76.207.228:5000'