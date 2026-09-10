import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, password: { type: String, required: true },
  role: { type: String, enum: ['client', 'accountant'], required: true, default: 'accountant' }, organization: { type: String, trim: true }, branch: { type: String, trim: true }, accountantId: { type: String, trim: true }, assignedAccountant: { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
const documentSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }, client: { type: Schema.Types.ObjectId, ref: 'User' }, accountant: { type: Schema.Types.ObjectId, ref: 'User' }, organization: String,
  originalName: String, fileName: String, mimeType: String, documentType: String, vendor: String, customer: String, invoiceNumber: String, invoiceDate: Date, subtotal: { type: Number, default: 0 }, gst: { type: Number, default: 0 }, total: { type: Number, default: 0 }, currency: String, items: [{ name: String, quantity: Number, unitPrice: Number, amount: Number }], gstin: String, confidence: { type: Number, default: 0 }, rawText: String,
  status: { type: String, enum: ['pending', 'processing', 'review', 'approved', 'rejected'], default: 'pending' }, issues: [String], rejectionReason: String, isDuplicate: { type: Boolean, default: false }, ocrStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
}, { timestamps: true });
const organizationSchema = new Schema({ name: { type: String, required: true, unique: true, trim: true } }, { timestamps: true });
const changeRequestSchema = new Schema({ client: { type: Schema.Types.ObjectId, ref: 'User', required: true }, currentAccountant: { type: Schema.Types.ObjectId, ref: 'User' }, requestedOrganization: { type: String, required: true }, reason: String, status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' } }, { timestamps: true });
export const User = mongoose.model('User', userSchema); export const Document = mongoose.model('Document', documentSchema); export const Organization = mongoose.model('Organization', organizationSchema); export const AccountantChangeRequest = mongoose.model('AccountantChangeRequest', changeRequestSchema);
