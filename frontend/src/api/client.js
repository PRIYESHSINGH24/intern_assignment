const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// Cases
export const getCases = (params = '') => request(`/cases/?${params}`);
export const getCase = (id) => request(`/cases/${id}`);
export const createCase = (data) => request('/cases/', { method: 'POST', body: JSON.stringify(data) });
export const deleteCase = (id) => request(`/cases/${id}`, { method: 'DELETE' });
export const startProcessing = (id) => request(`/cases/${id}/process`, { method: 'POST' });
export const reprocessCase = (id) => request(`/cases/${id}/reprocess`, { method: 'POST' });
export const getCaseStatus = (id) => request(`/cases/${id}/status`);

// Documents
export const getDocuments = (caseId, params = '') => request(`/cases/${caseId}/documents?${params}`);
export const getDocument = (id) => request(`/documents/${id}`);
export const getDocumentText = (id) => request(`/documents/${id}/text`);
export const deleteDocument = (id) => request(`/documents/${id}`, { method: 'DELETE' });

// Analytics
export const getDashboardStats = () => request('/dashboard/stats');
export const getCaseSummary = (id) => request(`/cases/${id}/summary`);
export const getCaseRedFlags = (id) => request(`/cases/${id}/red-flags`);
export const getCaseTimeline = (id) => request(`/cases/${id}/timeline`);
export const getCaseEntities = (id) => request(`/cases/${id}/entities`);
export const getDocTypeDistribution = (id) => request(`/cases/${id}/document-types`);

// Upload (special - multipart)
export function uploadDocuments(caseId, files, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/cases/${caseId}/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || 'Upload failed'));
        } catch {
          reject(new Error(xhr.statusText || 'Upload failed'));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}
