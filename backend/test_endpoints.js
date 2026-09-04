import fs from 'fs';

// Create a dummy text file
fs.writeFileSync('test.txt', 'This is a text file, not a PDF');

// Create a dummy PDF (minimal valid PDF)
const pdfBase64 = "JVBERi0xLjQKMSAwIG9iaiA8PC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUj4+IGVuZG9iaiAyIDAgb2JqIDw8L1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDE+PiBlbmRvYmogMyAwIG9iaiA8PC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL0NvbnRlbnRzIDQgMCBSIC9SZXNvdXJjZXMgPDwvRm9udCA8PC9GMSA1IDAgUj4+Pj4+PiBlbmRvYmogNCAwIG9iaiA8PC9MZW5ndGggMzM+PiBzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKFRlc3QgUERGKSBUagpFVAplbmRzdHJlYW0gZW5kb2JqIDUgMCBvYmogPDwvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2E+PiBlbmRvYmogeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNTkgMDAwMDAgbiAKMDAwMDAwMDExNiAwMDAwMCBuIAowMDAwMDAwMjIzIDAwMDAwIG4gCjAwMDAwMDAzMDcgMDAwMDAgbiAKdHJhaWxlciA8PC9TaXplIDYgL1Jvb3QgMSAwIFI+PiBzdGFydHhyZWYKMzk1CiUlRU9GCg==";
fs.writeFileSync('test.pdf', Buffer.from(pdfBase64, 'base64'));

async function test() {
  console.log("Testing Health Endpoint...");
  const h = await fetch("http://localhost:8000/api/health");
  console.log("Health:", await h.json());

  console.log("\nTesting /extract without file...");
  const r1 = await fetch("http://localhost:8000/api/resume/extract", { method: 'POST' });
  console.log("No file response:", await r1.json());

  console.log("\nTesting /extract with txt file...");
  const f1 = new FormData();
  f1.append('resume', new Blob([fs.readFileSync('test.txt')], { type: 'text/plain' }), 'test.txt');
  const r2 = await fetch("http://localhost:8000/api/resume/extract", { method: 'POST', body: f1 });
  console.log("Txt file response:", await r2.json());

  console.log("\nTesting /extract with pdf file...");
  const f2 = new FormData();
  f2.append('resume', new Blob([fs.readFileSync('test.pdf')], { type: 'application/pdf' }), 'test.pdf');
  const r3 = await fetch("http://localhost:8000/api/resume/extract", { method: 'POST', body: f2 });
  console.log("Pdf file response:", await r3.json());
}

test();
