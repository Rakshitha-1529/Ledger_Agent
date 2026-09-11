import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcrypt';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

import {
  User,
  Document,
  Organization
} from './models.js';

import {
  auth,
  tokenFor,
  requireRole
} from './auth.js';

import {
  analyseDocument,
  validate
} from './ai.js';


const app = express();

const port =
  process.env.PORT || 5000;


/* =====================================================
   UPLOAD DIRECTORY
===================================================== */

const uploadDir =
  path.resolve('uploads');

fs.mkdirSync(
  uploadDir,
  {
    recursive: true
  }
);


/* =====================================================
   MULTER
===================================================== */

const storage =
  multer.diskStorage({
    destination: (_, __, cb) => {
      cb(null, uploadDir);
    },

    filename: (_, file, cb) => {
      const extension =
        path.extname(
          file.originalname
        );

      const uniqueName =
        `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${extension}`;

      cb(
        null,
        uniqueName
      );
    }
  });


const upload =
  multer({
    storage,

    limits: {
      fileSize:
        20 * 1024 * 1024
    },

    fileFilter: (
      _req,
      file,
      cb
    ) => {
      const allowed = [
        'application/pdf',
        'image/jpeg',
        'image/png'
      ];

      if (
        allowed.includes(
          file.mimetype
        )
      ) {
        cb(null, true);
      } else {
        cb(
          new Error(
            'Only PDF, JPG and PNG files are allowed.'
          )
        );
      }
    }
  });


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json()
);


/*
  IMPORTANT:
  We intentionally DO NOT expose /uploads
  as a public static folder.

  Original documents are accessed through:

  GET /api/documents/:id/file

  which checks authentication and ownership.
*/


/* =====================================================
   HELPER
===================================================== */

function safeUser(user) {
  return {
    id: user._id,

    name:
      user.name ||
      user.email.split('@')[0],

    email:
      user.email,

    role:
      user.role,

    organization:
      user.organization || '',

    branch:
      user.branch || '',

    accountantId:
      user.accountantId || '',

    assignedAccountant:
      user.assignedAccountant || null
  };
}


/* =====================================================
   DOCUMENT ACCESS
===================================================== */

function accessQuery(user) {
  if (
    user.role === 'client'
  ) {
    return {
      client: user.id
    };
  }

  return {
    accountant: user.id
  };
}


/* =====================================================
   AUTH REGISTER
===================================================== */

app.post(
  '/api/auth/register',
  async (req, res) => {
    try {
      const {
        role,
        email,
        password,
        name,
        organization,
        accountantId,
        branch
      } = req.body;


      if (
        !role ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          message:
            'Role, email and password are required.'
        });
      }


      if (
        ![
          'client',
          'accountant'
        ].includes(role)
      ) {
        return res.status(400).json({
          message:
            'Invalid role.'
        });
      }


      if (
        password.length < 6
      ) {
        return res.status(400).json({
          message:
            'Password must be at least 6 characters.'
        });
      }


      const normalizedEmail =
        email
          .trim()
          .toLowerCase();


      const existing =
        await User.findOne({
          email:
            normalizedEmail
        });


      if (existing) {
        return res.status(409).json({
          message:
            'Email is already registered.'
        });
      }


      /*
        Accountant registration
      */

      if (
        role === 'accountant'
      ) {
        if (
          !name ||
          !organization ||
          !accountantId
        ) {
          return res.status(400).json({
            message:
              'Name, organization and accountant ID are required for accountants.'
          });
        }


        const organizationName =
          organization.trim();


        await Organization.findOneAndUpdate(
          {
            name:
              organizationName
          },

          {
            name:
              organizationName
          },

          {
            upsert: true,
            new: true
          }
        );
      }


      /*
        Client registration
      */

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );


      const user =
        await User.create({
          role,

          email:
            normalizedEmail,

          password:
            hashedPassword,

          name:
            role === 'client'
              ? ''
              : name.trim(),

          organization:
            role === 'accountant'
              ? organization.trim()
              : '',

          accountantId:
            role === 'accountant'
              ? accountantId.trim()
              : '',

          branch:
            role === 'accountant'
              ? (branch || '').trim()
              : ''
        });


      const token =
        tokenFor(user);


      return res.status(201).json({
        token,

        user:
          safeUser(user)
      });

    } catch (error) {
      console.error(
        'Register error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not create account.'
      });
    }
  }
);


/* =====================================================
   LOGIN
===================================================== */

app.post(
  '/api/auth/login',
  async (req, res) => {
    try {
      const email =
        req.body.email
          ?.trim()
          .toLowerCase();

      const password =
        req.body.password || '';


      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          message:
            'Email and password are required.'
        });
      }


      const user =
        await User.findOne({
          email
        });


      if (!user) {
        return res.status(401).json({
          message:
            'Invalid email or password.'
        });
      }


      const valid =
        await bcrypt.compare(
          password,
          user.password
        );


      if (!valid) {
        return res.status(401).json({
          message:
            'Invalid email or password.'
        });
      }


      if (!user.role) {
        user.role =
          user.organization
            ? 'accountant'
            : 'client';

        await user.save();
      }


      return res.json({
        token:
          tokenFor(user),

        user:
          safeUser(user)
      });

    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      return res.status(500).json({
        message:
          'Login failed.'
      });
    }
  }
);


/* =====================================================
   CURRENT USER
===================================================== */

app.get(
  '/api/auth/me',
  auth,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        ).populate(
          'assignedAccountant',
          'name email branch organization accountantId'
        );


      if (!user) {
        return res.status(404).json({
          message:
            'User not found.'
        });
      }


      return res.json(
        safeUser(user)
      );

    } catch (error) {
      console.error(
        'Auth me error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not load user.'
      });
    }
  }
);


/* =====================================================
   LOGOUT
===================================================== */

app.post(
  '/api/auth/logout',
  auth,
  (_req, res) => {
    return res.status(204).end();
  }
);


/* =====================================================
   ORGANIZATIONS
===================================================== */

app.get(
  '/api/organizations',
  auth,
  async (_req, res) => {
    try {
      const organizations =
        await Organization
          .find()
          .sort({
            name: 1
          });

      return res.json(
        organizations
      );

    } catch (error) {
      console.error(
        'Organization error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not load organizations.'
      });
    }
  }
);


/* =====================================================
   ACCOUNTANTS BY ORGANIZATION
===================================================== */

app.get(
  '/api/organizations/:name/accountants',
  auth,
  async (req, res) => {
    try {
      const organization =
        decodeURIComponent(
          req.params.name
        );


      const accountants =
        await User.find({
          role:
            'accountant',

          organization
        }).select(
          'name email branch organization accountantId'
        );


      return res.json(
        accountants
      );

    } catch (error) {
      console.error(
        'Accountant lookup error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not load accountants.'
      });
    }
  }
);


/* =====================================================
   CLIENT ASSIGN ACCOUNTANT
===================================================== */

app.put(
  '/api/client/assignment',
  auth,
  requireRole('client'),
  async (req, res) => {
    try {
      const {
        organization,
        accountantId
      } = req.body;


      if (
        !organization ||
        !accountantId
      ) {
        return res.status(400).json({
          message:
            'Organization and accountant are required.'
        });
      }


      const accountant =
        await User.findOne({
          _id:
            accountantId,

          role:
            'accountant',

          organization
        });


      if (!accountant) {
        return res.status(400).json({
          message:
            'Choose a valid accountant for this organization.'
        });
      }


      const client =
        await User.findByIdAndUpdate(
          req.user.id,

          {
            organization:
              accountant.organization,

            assignedAccountant:
              accountant._id
          },

          {
            new: true
          }
        ).populate(
          'assignedAccountant',
          'name email branch organization accountantId'
        );


      return res.json(
        safeUser(client)
      );

    } catch (error) {
      console.error(
        'Assignment error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not assign accountant.'
      });
    }
  }
);


/* =====================================================
   DOCUMENT LIST
===================================================== */

app.get(
  '/api/documents',
  auth,
  async (req, res) => {
    try {
      const documents =
        await Document.find(
          accessQuery(
            req.user
          )
        )
          .populate(
            'client',
            'name email organization'
          )
          .populate(
            'accountant',
            'name email branch organization accountantId'
          )
          .sort({
            createdAt:
              -1
          });


      return res.json(
        documents
      );

    } catch (error) {
      console.error(
        'Documents error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not load documents.'
      });
    }
  }
);


/* =====================================================
   CLIENT UPLOAD
===================================================== */

app.post(
  '/api/documents/upload',
  auth,
  requireRole('client'),
  upload.single('file'),

  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message:
            'A PDF, PNG, or JPG file is required.'
        });
      }


      const client =
        await User.findById(
          req.user.id
        );


      if (!client) {
        fs.unlink(
          req.file.path,
          () => {}
        );

        return res.status(404).json({
          message:
            'Client not found.'
        });
      }


      if (
        !client.assignedAccountant
      ) {
        fs.unlink(
          req.file.path,
          () => {}
        );

        return res.status(400).json({
          message:
            'Select an organization and accountant before uploading.'
        });
      }


      const accountant =
        await User.findOne({
          _id:
            client.assignedAccountant,

          role:
            'accountant',

          organization:
            client.organization
        });


      if (!accountant) {
        fs.unlink(
          req.file.path,
          () => {}
        );

        return res.status(400).json({
          message:
            'Assigned accountant is no longer available.'
        });
      }


      /*
        VERY IMPORTANT:

        No OCR.
        No Gemini.
        No classification.
        No validation.

        The client upload only stores
        the original document.
      */

      const document =
        await Document.create({
          owner:
            client._id,

          client:
            client._id,

          accountant:
            accountant._id,

          organization:
            client.organization,

          originalName:
            req.file.originalname,

          fileName:
            req.file.filename,

          mimeType:
            req.file.mimetype,

          documentType:
            null,

          extractedFields:
            {},

          confidence:
            0,

          validationIssues:
            [],

          rawText:
            '',

          ocrStatus:
            'pending',

          status:
            'pending'
        });


      return res.status(201).json(
        document
      );

    } catch (error) {
      console.error(
        'Upload error:',
        error
      );


      if (req.file) {
        fs.unlink(
          req.file.path,
          () => {}
        );
      }


      return res.status(500).json({
        message:
          error.message ||
          'The document could not be uploaded.'
      });
    }
  }
);


/* =====================================================
   ORIGINAL DOCUMENT
===================================================== */

app.get(
  '/api/documents/:id/file',
  auth,
  async (req, res) => {
    try {
      const document =
        await Document.findOne({
          _id:
            req.params.id,

          ...accessQuery(
            req.user
          )
        });


      if (!document) {
        return res.status(404).json({
          message:
            'Document not found.'
        });
      }


      const filePath =
        path.join(
          uploadDir,
          document.fileName
        );


      if (
        !fs.existsSync(
          filePath
        )
      ) {
        return res.status(404).json({
          message:
            'Original file no longer exists.'
        });
      }


      res.setHeader(
        'Content-Type',
        document.mimeType
      );


      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(
          document.originalName
        )}"`
      );


      return res.sendFile(
        filePath
      );

    } catch (error) {
      console.error(
        'File access error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not open document.'
      });
    }
  }
);


/* =====================================================
   ACCOUNTANT PROCESS DOCUMENT
===================================================== */

app.post(
  '/api/documents/:id/process',
  auth,
  requireRole('accountant'),

  async (req, res) => {
    try {
      const document =
        await Document.findOne({
          _id:
            req.params.id,

          accountant:
            req.user.id
        });


      if (!document) {
        return res.status(404).json({
          message:
            'Document not found or you are not its assigned accountant.'
        });
      }


      const filePath =
        path.join(
          uploadDir,
          document.fileName
        );


      if (
        !fs.existsSync(
          filePath
        )
      ) {
        return res.status(404).json({
          message:
            'Original document file was not found.'
        });
      }


      /*
        Prevent two processing requests
        at the same time.
      */

      if (
        document.status ===
          'processing'
      ) {
        return res.status(409).json({
          message:
            'This document is already being processed.'
        });
      }


      document.status =
        'processing';

      document.ocrStatus =
        'processing';

      document.processingError =
        '';

      await document.save();


      try {
        const analysis =
          await analyseDocument({
            path:
              filePath,

            mimetype:
              document.mimeType
          });


        const existingDocuments =
          await Document.find({
            client:
              document.client,

            _id: {
              $ne:
                document._id
            }
          });


        const validation =
          validate(
            analysis,
            existingDocuments
          );


        document.documentType =
          analysis.documentType;

        document.extractedFields =
          analysis.extractedFields;

        document.confidence =
          analysis.confidence;

        document.validationIssues =
          validation.validationIssues;

        document.rawText =
          analysis.rawText;

        /*
          Legacy fields for compatibility.
        */

        document.vendor =
          analysis.vendor;

        document.customer =
          analysis.customer;

        document.invoiceNumber =
          analysis.invoiceNumber;

        document.invoiceDate =
          analysis.invoiceDate;

        document.subtotal =
          analysis.subtotal;

        document.gst =
          analysis.gst;

        document.total =
          analysis.total;

        document.gstin =
          analysis.gstin;

        document.ocrStatus =
          'completed';

        document.status =
          'review';

        document.processingError =
          '';

        await document.save();


        return res.json(
          document
        );

      } catch (processingError) {
        console.error(
          'Document processing error:',
          processingError
        );


        document.ocrStatus =
          'failed';

        document.status =
          'failed';

        document.processingError =
          processingError.message ||
          'Document processing failed.';

        await document.save();


        return res.status(422).json({
          message:
            document.processingError,

          document
        });
      }

    } catch (error) {
      console.error(
        'Process endpoint error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not process document.'
      });
    }
  }
);


/* =====================================================
   ACCOUNTANT REVIEW
===================================================== */

app.patch(
  '/api/documents/:id',
  auth,
  requireRole('accountant'),

  async (req, res) => {
    try {
      const document =
        await Document.findOne({
          _id:
            req.params.id,

          accountant:
            req.user.id
        });


      if (!document) {
        return res.status(404).json({
          message:
            'Document not found.'
        });
      }


      /*
        Allow accountant to correct
        extracted dynamic fields.
      */

      if (
        req.body.extractedFields &&
        typeof req.body.extractedFields ===
          'object'
      ) {
        document.extractedFields =
          req.body.extractedFields;
      }


      if (
        'documentType' in
        req.body
      ) {
        document.documentType =
          req.body.documentType;
      }


      /*
        Legacy fields
      */

      const legacyFields = [
        'vendor',
        'customer',
        'invoiceNumber',
        'invoiceDate',
        'subtotal',
        'gst',
        'total',
        'gstin'
      ];


      for (
        const key of legacyFields
      ) {
        if (
          key in req.body
        ) {
          document[key] =
            req.body[key];
        }
      }


      /*
        Approval
      */

      if (
        req.body.status ===
        'approved'
      ) {
        document.status =
          'approved';

        document.rejectionReason =
          '';

        document.reviewedBy =
          req.user.id;

        document.reviewedAt =
          new Date();
      }


      /*
        Rejection
      */

      if (
        req.body.status ===
        'rejected'
      ) {
        if (
          !req.body.rejectionReason ||
          !req.body.rejectionReason.trim()
        ) {
          return res.status(400).json({
            message:
              'A rejection reason is required.'
          });
        }


        document.status =
          'rejected';

        document.rejectionReason =
          req.body.rejectionReason.trim();

        document.reviewedBy =
          req.user.id;

        document.reviewedAt =
          new Date();
      }


      await document.save();


      return res.json(
        document
      );

    } catch (error) {
      console.error(
        'Review error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not update document.'
      });
    }
  }
);


/* =====================================================
   CLIENT DELETE DOCUMENT
===================================================== */

app.delete(
  '/api/documents/:id',
  auth,
  requireRole('client'),

  async (req, res) => {
    try {
      const document =
        await Document.findOne({
          _id:
            req.params.id,

          client:
            req.user.id
        });


      if (!document) {
        return res.status(404).json({
          message:
            'Document not found.'
        });
      }


      /*
        Don't allow deleting an already
        approved document.
      */

      if (
        document.status ===
          'approved'
      ) {
        return res.status(400).json({
          message:
            'Approved documents cannot be deleted.'
        });
      }


      const filePath =
        path.join(
          uploadDir,
          document.fileName
        );


      await document.deleteOne();


      if (
        fs.existsSync(
          filePath
        )
      ) {
        fs.unlink(
          filePath,
          () => {}
        );
      }


      return res.status(204).end();

    } catch (error) {
      console.error(
        'Delete error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not delete document.'
      });
    }
  }
);


/* =====================================================
   DASHBOARD
===================================================== */

app.get(
  '/api/dashboard',
  auth,

  async (req, res) => {
    try {
      const documents =
        await Document.find(
          accessQuery(
            req.user
          )
        )
          .sort({
            createdAt:
              -1
          });


      const countStatus =
        status =>
          documents.filter(
            document =>
              document.status ===
              status
          ).length;


      const pending =
        countStatus('pending') +
        countStatus('processing') +
        countStatus('review');


      const base = {
        total:
          documents.length,

        pending,

        approved:
          countStatus(
            'approved'
          ),

        rejected:
          countStatus(
            'rejected'
          ),

        recent:
          documents.slice(
            0,
            5
          )
      };


      /*
        Accountant dashboard
      */

      if (
        req.user.role ===
        'accountant'
      ) {
        const clients =
          await User.find({
            role:
              'client',

            assignedAccountant:
              req.user.id
          });


        base.clients =
          clients.length;


        base.clientList =
          await Promise.all(
            clients.map(
              async client => ({
                id:
                  client._id,

                name:
                  client.name ||
                  client.email,

                email:
                  client.email,

                organization:
                  client.organization,

                documents:
                  await Document.countDocuments({
                    client:
                      client._id
                  }),

                pending:
                  await Document.countDocuments({
                    client:
                      client._id,

                    status: {
                      $in: [
                        'pending',
                        'processing',
                        'review'
                      ]
                    }
                  }),

                approved:
                  await Document.countDocuments({
                    client:
                      client._id,

                    status:
                      'approved'
                  }),

                rejected:
                  await Document.countDocuments({
                    client:
                      client._id,

                    status:
                      'rejected'
                  })
              })
            )
          );
      }


      /*
        Client dashboard
      */

      if (
        req.user.role ===
        'client'
      ) {
        const client =
          await User.findById(
            req.user.id
          ).populate(
            'assignedAccountant',
            'name email branch organization accountantId'
          );


        base.assignment =
          client?.assignedAccountant
            ? {
                organization:
                  client.organization,

                accountant:
                  client.assignedAccountant
              }
            : null;
      }


      return res.json(
        base
      );

    } catch (error) {
      console.error(
        'Dashboard error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not load dashboard.'
      });
    }
  }
);


/* =====================================================
   REPORTS
===================================================== */

app.get(
  '/api/reports',
  auth,

  async (req, res) => {
    try {
      const documents =
        await Document.find(
          accessQuery(
            req.user
          )
        );


      const count =
        status =>
          documents.filter(
            document =>
              document.status ===
              status
          ).length;


      const approved =
        count('approved');

      const rejected =
        count('rejected');

      const pending =
        count('pending') +
        count('processing') +
        count('review');


      /*
        Activity by date
      */

      const activity = {};


      documents.forEach(
        document => {
          const day =
            document.createdAt
              .toISOString()
              .slice(
                0,
                10
              );


          activity[day] =
            (
              activity[day] ||
              0
            ) + 1;
        }
      );


      /*
        Document type distribution
      */

      const documentTypes = {};


      documents.forEach(
        document => {
          const type =
            document.documentType ||
            'unprocessed';


          documentTypes[type] =
            (
              documentTypes[type] ||
              0
            ) + 1;
        }
      );


      return res.json({
        total:
          documents.length,

        approved,

        rejected,

        pending,

        status: {
          approved,
          rejected,
          pending
        },

        activity,

        documentTypes
      });

    } catch (error) {
      console.error(
        'Reports error:',
        error
      );

      return res.status(500).json({
        message:
          'Could not generate reports.'
      });
    }
  }
);


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
  '/api/health',
  (_req, res) => {
    res.json({
      status:
        'ok',

      service:
        'LedgerAgent API'
    });
  }
);


/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
  (error, req, res, next) => {
    console.error(
      'Unhandled error:',
      error
    );


    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        message:
          error.message
      });
    }


    if (
      error.message?.includes(
        'Only PDF'
      )
    ) {
      return res.status(400).json({
        message:
          error.message
      });
    }


    return res.status(500).json({
      message:
        error.message ||
        'Internal server error.'
    });
  }
);


/* =====================================================
   DATABASE + SERVER
===================================================== */

mongoose
  .connect(
    process.env.MONGODB_URI
  )
  .then(() => {
    console.log(
      'MongoDB connected successfully'
    );


    app.listen(
      port,
      () => {
        console.log(
          `LedgerAgent API running on port ${port}`
        );
      }
    );
  })
  .catch(error => {
    console.error(
      'MongoDB connection failed:',
      error.message
    );

    process.exit(1);
  });