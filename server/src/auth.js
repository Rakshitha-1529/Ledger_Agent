import jwt from 'jsonwebtoken';
export function auth(req,res,next){const token=req.headers.authorization?.replace('Bearer ','');if(!token)return res.status(401).json({message:'Authentication required'});try{req.user=jwt.verify(token,process.env.JWT_SECRET);next()}catch{return res.status(401).json({message:'Session expired. Please sign in again.'})}}
export const tokenFor=user=>jwt.sign({id:user._id,name:user.name,role:user.role,organization:user.organization},process.env.JWT_SECRET,{expiresIn:'7d'});
export const requireRole=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({message:'You are not authorized for this action'});
