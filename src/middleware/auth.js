const jwt = require('jsonwebtoken');
const database = require('../database');

const authMiddleware = (req, res, next) => {
  let token = null;
  
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '');
  }
  
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.redirect('/admin/login');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = database.get('SELECT id, username, role FROM users WHERE id = ?', [decoded.userId]);
    
    if (!user) {
      res.clearCookie('token');
      return res.redirect('/admin/login');
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/admin/login');
  }
};

module.exports = authMiddleware;
