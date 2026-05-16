module.exports = function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'no_auth' });
  }
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};
