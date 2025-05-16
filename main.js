// main.js for Split my PDF
// Handles PDF upload, preview, grouping, and download

let pdfDoc = null;
let pageCanvases = [];
let selectedPages = new Set();
let groups = [];
let currentGroup = [];
let groupSelections = [];
let pdfFileBuffer = null;

const uploadInput = document.getElementById('pdf-upload');
const uploadError = document.getElementById('upload-error');
const previewSection = document.getElementById('preview-section');
const groupControls = document.getElementById('group-controls');
const downloadSection = document.getElementById('download-section');
const groupList = document.getElementById('group-list');
const cancelBtn = document.getElementById('cancel-btn');

// --- PDF Upload Handler ---
uploadInput.addEventListener('change', async (e) => {
  resetAll();
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    uploadError.textContent = 'Please upload a valid PDF file.';
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    uploadError.textContent = 'File size exceeds 100MB limit.';
    return;
  }
  uploadError.textContent = '';
  pdfFileBuffer = await file.arrayBuffer();
  renderPDFPreview(pdfFileBuffer);
});

// --- Render PDF Preview ---
async function renderPDFPreview(arrayBuffer) {
  previewSection.innerHTML = '';
  previewSection.style.display = 'flex';
  pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  pageCanvases = [];
  selectedPages = new Set();
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 220;
    const viewport = page.getViewport({ scale: canvas.width / page.getViewport({ scale: 1 }).width });
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const thumb = document.createElement('div');
    thumb.className = 'page-thumb';
    thumb.appendChild(canvas);
    thumb.title = `Page ${i}`;
    thumb.addEventListener('click', () => togglePageSelection(i - 1, thumb));
    previewSection.appendChild(thumb);
    pageCanvases.push({ canvas, thumb });
  }
  groupControls.classList.remove('hidden');
  cancelBtn.classList.remove('hidden');
}

function togglePageSelection(idx, thumb) {
  if (selectedPages.has(idx)) {
    selectedPages.delete(idx);
    thumb.classList.remove('selected');
  } else {
    selectedPages.add(idx);
    thumb.classList.add('selected');
  }
}

document.getElementById('clear-selection-btn').onclick = () => {
  selectedPages.clear();
  pageCanvases.forEach(({ thumb }) => thumb.classList.remove('selected'));
};

document.getElementById('new-group-btn').onclick = () => {
  if (selectedPages.size === 0) return;
  currentGroup = Array.from(selectedPages).sort((a, b) => a - b);
  groups.push([...currentGroup]);
  groupSelections.push(false);
  updateGroupList();
  selectedPages.clear();
  pageCanvases.forEach(({ thumb }) => thumb.classList.remove('selected'));
};

document.getElementById('add-to-group-btn').onclick = () => {
  if (groups.length === 0 || selectedPages.size === 0) return;
  const lastGroup = groups[groups.length - 1];
  for (const idx of selectedPages) {
    if (!lastGroup.includes(idx)) lastGroup.push(idx);
  }
  lastGroup.sort((a, b) => a - b);
  updateGroupList();
  selectedPages.clear();
  pageCanvases.forEach(({ thumb }) => thumb.classList.remove('selected'));
};

function updateGroupList() {
  groupList.innerHTML = '';
  groups.forEach((group, i) => {
    const div = document.createElement('div');
    div.style.margin = '8px 0';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = groupSelections[i];
    cb.onchange = () => {
      groupSelections[i] = cb.checked;
      updateDownloadBtn();
    };
    div.appendChild(cb);
    div.appendChild(document.createTextNode(` Group ${i + 1}: Pages ${group.map(n => n + 1).join(', ')}`));
    groupList.appendChild(div);
  });
  downloadSection.classList.remove('hidden');
  updateDownloadBtn();
}

function updateDownloadBtn() {
  const btn = document.getElementById('download-selected-btn');
  btn.disabled = groupSelections.filter(Boolean).length === 0;
}

document.getElementById('download-selected-btn').onclick = async () => {
  const selectedGroups = groups.filter((_, i) => groupSelections[i]);
  if (selectedGroups.length === 0) return;
  if (selectedGroups.length === 1) {
    const blob = await extractPagesAsPDF(selectedGroups[0]);
    downloadBlob(blob, 'split.pdf');
  } else {
    const zip = new JSZip();
    for (let i = 0; i < selectedGroups.length; i++) {
      const blob = await extractPagesAsPDF(selectedGroups[i]);
      zip.file(`split_group${i + 1}.pdf`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'split_groups.zip');
  }
};

// --- PDF Extraction ---
async function extractPagesAsPDF(pageIndices) {
  // Use PDF-lib for page extraction (browser compatible)
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
  const srcPdf = await PDFDocument.load(pdfFileBuffer);
  const newPdf = await PDFDocument.create();
  for (const idx of pageIndices) {
    const [copied] = await newPdf.copyPages(srcPdf, [idx]);
    newPdf.addPage(copied);
  }
  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// --- Cancel/Reset ---
cancelBtn.onclick = resetAll;
function resetAll() {
  pdfDoc = null;
  pageCanvases = [];
  selectedPages = new Set();
  groups = [];
  currentGroup = [];
  groupSelections = [];
  pdfFileBuffer = null;
  previewSection.innerHTML = '';
  previewSection.style.display = 'none';
  groupControls.classList.add('hidden');
  downloadSection.classList.add('hidden');
  cancelBtn.classList.add('hidden');
  groupList.innerHTML = '';
  uploadInput.value = '';
  uploadError.textContent = '';
}
