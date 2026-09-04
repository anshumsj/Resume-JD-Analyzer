import { PDFParse } from 'pdf-parse';

export const extractTextFromPdf = async (buffer) => {
  try {
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    return textResult.text;
  } catch (error) {
    console.error('PDF Parse Error:', error);
    throw new Error('Failed to parse PDF file: ' + error.message);
  }
};
