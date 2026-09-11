import { GoogleGenAI } from '@google/genai';

const instruction = `
You are an AI accounting document extraction assistant.

Analyse the provided OCR text and identify what type of accounting document it is.

Possible document types:

- purchase_invoice
- sales_invoice
- receipt
- purchase_order
- quotation
- credit_note
- debit_note
- bank_statement
- other

IMPORTANT RULES:

1. First classify the document based only on the provided content.

2. Do NOT assume every document is an invoice.

3. Extract only information that actually appears in the document.

4. NEVER invent, guess, or fabricate missing information.

5. If a value is not present, do not include that field.

6. The "fields" object must be dynamic according to the actual document.

7. A receipt should NOT contain invoiceNumber unless an invoice number is actually visible.

8. A purchase order should use purchase-order-related fields.

9. A quotation should use quotation-related fields.

10. A bank statement should use bank/statement-related fields.

11. Preserve document numbers exactly as they appear.

12. Dates must use YYYY-MM-DD when the date is clearly known.

13. Monetary values must be numbers without currency symbols or commas.

14. Quantities must be numbers when clearly available.

15. Do not create fields merely because they are common accounting fields.

16. If OCR text is unclear, return null or omit the field instead of guessing.

17. Return ONLY valid JSON.

18. Never return markdown.

19. Never return explanations outside the JSON.

Return EXACTLY this JSON structure:

{
  "documentType": "purchase_invoice | sales_invoice | receipt | purchase_order | quotation | credit_note | debit_note | bank_statement | other",
  "fields": {},
  "confidence": 0,
  "validationIssues": []
}

The "fields" object must contain ONLY fields that are actually present in the document.

Example invoice fields:

{
  "vendor": "ABC Traders",
  "customer": "XYZ Ltd",
  "invoiceNumber": "INV-1023",
  "date": "2026-08-15",
  "gstin": "37ABCDE1234F1Z5",
  "items": [
    {
      "name": "Laptop",
      "quantity": 2,
      "unitPrice": 45000,
      "amount": 90000
    }
  ],
  "subtotal": 90000,
  "gst": 16200,
  "total": 106200,
  "currency": "INR"
}

Example receipt fields:

{
  "merchant": "ABC Store",
  "date": "2026-08-15",
  "items": [
    {
      "name": "Notebook",
      "quantity": 2,
      "unitPrice": 50,
      "amount": 100
    }
  ],
  "subtotal": 100,
  "tax": 18,
  "total": 118,
  "paymentMethod": "UPI",
  "currency": "INR"
}

Example purchase order fields:

{
  "supplier": "ABC Traders",
  "purchaseOrderNumber": "PO-10045",
  "date": "2026-08-15",
  "deliveryDate": "2026-08-20",
  "items": [
    {
      "name": "Laptop",
      "quantity": 5,
      "unitPrice": 45000,
      "amount": 225000
    }
  ],
  "total": 225000,
  "currency": "INR"
}

Do NOT include fields from these examples unless they actually exist in the uploaded document.
`;

function parse(text) {
  const json = text
    .replace(/^```(?:json)?\\s*/i, '')
    .replace(/\\s*```$/i, '')
    .trim();

  const value = JSON.parse(json);

  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      'Gemini returned an invalid extraction object'
    );
  }

  if (!value.documentType) {
    value.documentType = 'other';
  }

  if (
    !value.fields ||
    typeof value.fields !== 'object' ||
    Array.isArray(value.fields)
  ) {
    value.fields = {};
  }

  if (
    typeof value.confidence !== 'number' ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    value.confidence = 0;
  }

  if (!Array.isArray(value.validationIssues)) {
    value.validationIssues = [];
  }

  return value;
}

export async function extractWithGemini(
  ocrText,
  file
) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'Gemini is not configured. Add GEMINI_API_KEY to server/.env and restart the API.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  const response =
    await ai.models.generateContent({
      model: 'gemini-3.6-flash',

      contents: [
        {
          text: `${instruction}

OCR TEXT:
${ocrText}`
        },

        {
          inlineData: {
            mimeType: file.mimeType,
            data: file.buffer.toString('base64')
          }
        }
      ],

      config: {
        responseMimeType: 'application/json'
      }
    });

  return parse(response.text);
}