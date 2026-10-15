const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function getLanguages() {
  const response = await fetch(`${API_URL}/languages`)
  if (!response.ok) throw new Error('Could not load languages.')
  return response.json()
}

export async function getModels() {
  const response = await fetch(`${API_URL}/models`)
  if (!response.ok) throw new Error('Could not load model options.')
  return response.json()
}

export async function getHealth() {
  const response = await fetch(`${API_URL}/health`)
  if (!response.ok) throw new Error('Backend unavailable.')
  return response.json()
}

export async function transcribeAudio(file, options) {
  const formData = new FormData()
  formData.append('audio', file, file.name || 'recording.webm')
  formData.append('language', options.language)
  formData.append('model', options.model)
  formData.append('mode', options.mode)
  formData.append('audio_type', options.audioType)
  const response = await fetch(`${API_URL}/transcribe`, { method: 'POST', body: formData })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || 'Transcription failed.')
  return payload
}
