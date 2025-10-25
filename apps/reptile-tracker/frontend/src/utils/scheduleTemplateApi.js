/**
 * API utilities for Schedule Templates and Care Guidelines
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================================================
// SCHEDULE TEMPLATES API
// ============================================================================

/**
 * List all schedule templates with optional filtering
 */
export async function listScheduleTemplates(filters = {}) {
  const params = new URLSearchParams();

  if (filters.species) params.append('species', filters.species);
  if (filters.age_category) params.append('age_category', filters.age_category);
  if (filters.schedule_type) params.append('schedule_type', filters.schedule_type);
  if (filters.include_defaults !== undefined) params.append('include_defaults', filters.include_defaults);

  const response = await axios.get(
    `${API_BASE_URL}/api/schedule-templates?${params.toString()}`,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Get a specific schedule template by ID
 */
export async function getScheduleTemplate(templateId) {
  const response = await axios.get(
    `${API_BASE_URL}/api/schedule-templates/${templateId}`,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Create a new schedule template
 */
export async function createScheduleTemplate(templateData) {
  const response = await axios.post(
    `${API_BASE_URL}/api/schedule-templates`,
    templateData,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Update an existing schedule template
 */
export async function updateScheduleTemplate(templateId, templateData) {
  const response = await axios.put(
    `${API_BASE_URL}/api/schedule-templates/${templateId}`,
    templateData,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Delete a schedule template
 */
export async function deleteScheduleTemplate(templateId) {
  await axios.delete(
    `${API_BASE_URL}/api/schedule-templates/${templateId}`,
    { withCredentials: true }
  );
}

/**
 * Duplicate a schedule template (create a customizable copy)
 */
export async function duplicateScheduleTemplate(templateId) {
  const response = await axios.post(
    `${API_BASE_URL}/api/schedule-templates/${templateId}/duplicate`,
    {},
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Apply a schedule template to a specific reptile
 */
export async function applyTemplateToReptile(templateId, reptileId) {
  const response = await axios.post(
    `${API_BASE_URL}/api/schedule-templates/${templateId}/apply/${reptileId}`,
    {},
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Export all user's schedule templates as JSON
 */
export async function exportScheduleTemplates() {
  const response = await axios.get(
    `${API_BASE_URL}/api/schedule-templates/export`,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Import schedule templates from JSON
 */
export async function importScheduleTemplates(jsonData) {
  const response = await axios.post(
    `${API_BASE_URL}/api/schedule-templates/import`,
    jsonData,
    { withCredentials: true }
  );
  return response.data;
}

// ============================================================================
// CARE GUIDELINES API
// ============================================================================

/**
 * List all care guidelines with optional filtering
 */
export async function listCareGuidelines(filters = {}) {
  const params = new URLSearchParams();

  if (filters.species) params.append('species', filters.species);
  if (filters.age_category) params.append('age_category', filters.age_category);
  if (filters.guideline_type) params.append('guideline_type', filters.guideline_type);

  const response = await axios.get(
    `${API_BASE_URL}/api/care-guidelines?${params.toString()}`,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Get a specific care guideline by ID
 */
export async function getCareGuideline(guidelineId) {
  const response = await axios.get(
    `${API_BASE_URL}/api/care-guidelines/${guidelineId}`,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Create a new care guideline
 */
export async function createCareGuideline(guidelineData) {
  const response = await axios.post(
    `${API_BASE_URL}/api/care-guidelines`,
    guidelineData,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Update an existing care guideline
 */
export async function updateCareGuideline(guidelineId, guidelineData) {
  const response = await axios.put(
    `${API_BASE_URL}/api/care-guidelines/${guidelineId}`,
    guidelineData,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Delete a care guideline
 */
export async function deleteCareGuideline(guidelineId) {
  await axios.delete(
    `${API_BASE_URL}/api/care-guidelines/${guidelineId}`,
    { withCredentials: true }
  );
}

/**
 * Export all user's care guidelines as JSON
 */
export async function exportCareGuidelines() {
  const response = await axios.get(
    `${API_BASE_URL}/api/care-guidelines/export`,
    { withCredentials: true }
  );
  return response.data;
}

/**
 * Import care guidelines from JSON
 */
export async function importCareGuidelines(jsonData) {
  const response = await axios.post(
    `${API_BASE_URL}/api/care-guidelines/import`,
    jsonData,
    { withCredentials: true }
  );
  return response.data;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Download JSON data as a file
 */
export function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse JSON file from file input
 */
export function parseJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        resolve(json);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
