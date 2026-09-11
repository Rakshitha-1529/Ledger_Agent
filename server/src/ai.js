import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';

import {
  extractWithGemini
} from './gemini.js';


async function extractText(file) {
  const buffer = await fs.readFile(file.path);

  /*
    PDF
  */
  if (file.mimetype === 'application/pdf') {
    const result = await pdfParse(buffer);

    const text = result.text?.trim();

    if (!text) {
      throw new Error(
        'The PDF does not contain readable text. Please upload a text-based PDF or JPG/PNG image.'
      );
    }

    return text;
  }

  /*
    IMAGE
  */
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png'
  ) {
    const result = await Tesseract.recognize(
      file.path,
      'eng'
    );

    const text = result.data.text?.trim();

    if (!text) {
      throw new Error(
        'OCR could not extract readable text from this image.'
      );
    }

    return text;
  }

  throw new Error(
    'Unsupported document type.'
  );
}


function cleanValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === '') {
    return null;
  }

  return value;
}


function copyLegacyFields(
  documentType,
  fields
) {
  const result = {
    vendor: null,
    customer: null,
    invoiceNumber: null,
    invoiceDate: null,
    subtotal: null,
    gst: null,
    total: null,
    gstin: null
  };

  /*
    Only map fields that actually exist.
  */

  if (
    fields.vendor !== undefined
  ) {
    result.vendor =
      cleanValue(fields.vendor);
  }

  if (
    fields.customer !== undefined
  ) {
    result.customer =
      cleanValue(fields.customer);
  }

  if (
    fields.invoiceNumber !== undefined
  ) {
    result.invoiceNumber =
      cleanValue(fields.invoiceNumber);
  }

  if (
    fields.date !== undefined &&
    (
      documentType === 'purchase_invoice' ||
      documentType === 'sales_invoice'
    )
  ) {
    result.invoiceDate =
      cleanValue(fields.date);
  }

  if (
    fields.subtotal !== undefined
  ) {
    result.subtotal =
      cleanValue(fields.subtotal);
  }

  if (
    fields.gst !== undefined
  ) {
    result.gst =
      cleanValue(fields.gst);
  }

  if (
    fields.total !== undefined
  ) {
    result.total =
      cleanValue(fields.total);
  }

  if (
    fields.gstin !== undefined
  ) {
    result.gstin =
      cleanValue(fields.gstin);
  }

  return result;
}


export async function analyseDocument(
  file
) {
  const ocrText =
    await extractText(file);

  const geminiResult =
    await extractWithGemini(
      ocrText,
      {
        mimeType: file.mimetype,
        buffer: await fs.readFile(file.path)
      }
    );

  const documentType =
    geminiResult.documentType ||
    'other';

  const extractedFields =
    geminiResult.fields || {};

  const legacyFields =
    copyLegacyFields(
      documentType,
      extractedFields
    );

  return {
    documentType,

    extractedFields,

    confidence:
      geminiResult.confidence ?? 0,

    validationIssues:
      geminiResult.validationIssues || [],

    rawText: ocrText,

    ...legacyFields
  };
}


function number(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}


export function validate(
  data,
  existingDocuments = []
) {
  const issues = [
    ...(data.validationIssues || [])
  ];

  const fields =
    data.extractedFields || {};

  const documentType =
    data.documentType || 'other';


  /*
    Check totals only when relevant values
    are actually available.
  */

  const subtotal =
    number(fields.subtotal);

  const gst =
    number(fields.gst);

  const total =
    number(fields.total);


  if (
    subtotal !== null &&
    gst !== null &&
    total !== null
  ) {
    const expected =
      Number(
        (subtotal + gst).toFixed(2)
      );

    const actual =
      Number(
        total.toFixed(2)
      );

    if (
      Math.abs(expected - actual) > 1
    ) {
      issues.push(
        'Subtotal plus GST does not match the total.'
      );
    }
  }


  /*
    Duplicate invoice detection.
  */

  if (
    (
      documentType === 'purchase_invoice' ||
      documentType === 'sales_invoice'
    ) &&
    fields.invoiceNumber
  ) {
    const duplicate =
      existingDocuments.some(
        document =>
          document.documentType ===
            documentType &&
          document.invoiceNumber ===
            fields.invoiceNumber
      );

    if (duplicate) {
      issues.push(
        'A document with the same invoice number already exists.'
      );
    }
  }


  /*
    Required fields only for invoices.
  */

  if (
    documentType === 'purchase_invoice' ||
    documentType === 'sales_invoice'
  ) {
    if (!fields.invoiceNumber) {
      issues.push(
        'Invoice number could not be identified.'
      );
    }

    if (!fields.date) {
      issues.push(
        'Invoice date could not be identified.'
      );
    }
  }


  /*
    Receipt-specific validation.
  */

  if (
    documentType === 'receipt' &&
    !fields.total
  ) {
    issues.push(
      'Receipt total could not be identified.'
    );
  }


  return {
    validationIssues: [
      ...new Set(issues)
    ]
  };
}