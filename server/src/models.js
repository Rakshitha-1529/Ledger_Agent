import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['client', 'accountant'],
      required: true
    },

    name: {
      type: String,
      default: ''
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    organization: {
      type: String,
      default: ''
    },

    branch: {
      type: String,
      default: ''
    },

    accountantId: {
      type: String,
      default: ''
    },

    assignedAccountant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const documentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    accountant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    organization: {
      type: String,
      required: true
    },

    originalName: {
      type: String,
      required: true
    },

    fileName: {
      type: String,
      required: true
    },

    mimeType: {
      type: String,
      required: true
    },

    documentType: {
      type: String,
      default: null
    },

    /*
      Dynamic fields returned by Gemini.

      Example invoice:
      {
        vendor: "ABC Traders",
        invoiceNumber: "INV-1001",
        gstin: "37ABCDE1234F1Z5",
        total: 1200
      }

      Example receipt:
      {
        merchant: "ABC Store",
        paymentMethod: "UPI",
        total: 500
      }
    */
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    /*
      Kept for compatibility with older frontend code.
    */
    vendor: {
      type: String,
      default: null
    },

    customer: {
      type: String,
      default: null
    },

    invoiceNumber: {
      type: String,
      default: null
    },

    invoiceDate: {
      type: String,
      default: null
    },

    subtotal: {
      type: Number,
      default: null
    },

    gst: {
      type: Number,
      default: null
    },

    total: {
      type: Number,
      default: null
    },

    gstin: {
      type: String,
      default: null
    },

    confidence: {
      type: Number,
      default: 0
    },

    validationIssues: {
      type: [String],
      default: []
    },

    rawText: {
      type: String,
      default: ''
    },

    ocrStatus: {
      type: String,
      enum: [
        'pending',
        'processing',
        'completed',
        'failed'
      ],
      default: 'pending'
    },

    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'review',
        'approved',
        'rejected',
        'failed'
      ],
      default: 'pending'
    },

    processingError: {
      type: String,
      default: ''
    },

    rejectionReason: {
      type: String,
      default: ''
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model(
  'User',
  userSchema
);

export const Organization = mongoose.model(
  'Organization',
  organizationSchema
);

export const Document = mongoose.model(
  'Document',
  documentSchema
);