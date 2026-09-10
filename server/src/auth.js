import jwt from 'jsonwebtoken';
export function auth(req, res, next) { const token = req.headers.authorization?.replace('Bearer ', ''); if (!token) return res.status(401).json({ message: 'Authentication required' }); try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); } catch { res.status(401).json({ message: 'Session expired. Please sign in again.' }); } }
export const tokenFor = user => jwt.sign({ id: user._id, name: user.name, organization: user.organization }, process.env.JWT_SECRET, { expiresIn: '7d' });
