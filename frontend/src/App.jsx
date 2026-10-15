import { useEffect, useRef, useState } from 'react'
import {
  AudioLines, Check, Clipboard, Clock3, Copy, Download, FileAudio, History,
  Info, Mic, Moon, Search, Settings, Sparkles, Square, Sun, Upload, X,
} from 'lucide-react'
import { getHealth, getLanguages, getModels, transcribeAudio } from './services/api'

const MAX_FILE_BYTES = 100 * 1024 * 1024
const ACCEPTED = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm', '.mp4', '.mpeg', '.mpga']
const DEFAULT_SETTINGS = { language: 'auto', audioType: 'speech', mode: 'accuracy', model: 'base', timestamps: true }

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) } catch { return fallback }
}

function toSrtTime(seconds) {
  const milliseconds = Math.floor((seconds % 1) * 1000)
  const wholeSeconds = Math.floor(seconds)
  return `${String(Math.floor(wholeSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(wholeSeconds / 60) % 60).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

function segmentsToSrt(segments = []) {
  return segments.map((segment, index) => `${index + 1}\n${toSrtTime(segment.start)} --> ${toSrtTime(segment.end)}\n${segment.text}\n`).join('\n')
}

export default function App() {
  const [file, setFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioDuration, setAudioDuration] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [languages, setLanguages] = useState([{ code: 'auto', name: 'Auto detect' }])
  const [models, setModels] = useState([])
  const [settings, setSettings] = useState(() => readStorage('whisper-settings', DEFAULT_SETTINGS))
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [history, setHistory] = useState(() => readStorage('whisper-history', []))
  const [activeView, setActiveView] = useState('transcribe')
  const [backendStatus, setBackendStatus] = useState('checking')
  const [dark, setDark] = useState(() => localStorage.getItem('whisper-theme') === 'dark')
  const fileInput = useRef(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)

  useEffect(() => {
    getLanguages().then((result) => setLanguages(result.languages)).catch(() => {})
    getModels().then((result) => setModels(result.models)).catch(() => {})
    getHealth().then(() => setBackendStatus('online')).catch(() => setBackendStatus('offline'))
  }, [])
  useEffect(() => { localStorage.setItem('whisper-settings', JSON.stringify(settings)) }, [settings])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('whisper-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => () => { clearInterval(timer.current); if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  function updateSetting(name, value) { setSettings((current) => ({ ...current, [name]: value })) }

  function chooseFile(nextFile) {
    if (!nextFile) return
    const extension = `.${nextFile.name.split('.').pop().toLowerCase()}`
    if (!ACCEPTED.includes(extension)) { setError('Unsupported file. Choose WAV, MP3, M4A, FLAC, OGG, or WebM.'); return }
    if (nextFile.size > MAX_FILE_BYTES) { setError('Audio files must be smaller than 100 MB.'); return }
    setError(''); setNotice(''); setFile(nextFile); setTranscript(''); setMetadata(null); setAudioDuration(null)
    setAudioUrl(URL.createObjectURL(nextFile))
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorder.current = new MediaRecorder(stream); chunks.current = []
      recorder.current.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
      recorder.current.onstop = () => {
        const recording = new Blob(chunks.current, { type: recorder.current.mimeType || 'audio/webm' })
        chooseFile(new File([recording], 'microphone-recording.webm', { type: recording.type }))
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.current.start(); setIsRecording(true); setRecordingSeconds(0)
      timer.current = setInterval(() => setRecordingSeconds((value) => value + 1), 1000)
    } catch { setError('Microphone permission was denied or is unavailable. Check browser permissions.') }
  }

  function stopRecording() { recorder.current?.stop(); setIsRecording(false); clearInterval(timer.current) }
  function reset() { setFile(null); setTranscript(''); setMetadata(null); setError(''); setNotice(''); setAudioUrl(''); setAudioDuration(null) }

  async function handleTranscribe() {
    if (!file) { setError('Choose an audio file or record a clip first.'); return }
    setIsTranscribing(true); setError(''); setNotice('')
    try {
      const result = await transcribeAudio(file, settings)
      setTranscript(result.text); setMetadata(result)
      const item = { id: Date.now(), name: file.name, text: result.text, language: result.detected_language, model: result.model, mode: result.mode, words: result.word_count, seconds: result.processing_seconds, segments: result.segments, createdAt: new Date().toISOString() }
      const nextHistory = [item, ...history.filter((entry) => entry.text !== result.text)].slice(0, 20)
      setHistory(nextHistory); localStorage.setItem('whisper-history', JSON.stringify(nextHistory)); setNotice('Transcription complete.')
    } catch (transcriptionError) { setError(transcriptionError.message) } finally { setIsTranscribing(false) }
  }

  async function copyText(text = transcript) { if (!text) return; await navigator.clipboard.writeText(text); setNotice('Transcript copied to clipboard.') }
  function downloadFile(content, name, type) { const blob = new Blob([content], { type }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); URL.revokeObjectURL(link.href) }
  function downloadText() { if (transcript) downloadFile(transcript, 'transcript.txt', 'text/plain;charset=utf-8') }
  function downloadSrt() { if (metadata?.segments?.length) downloadFile(segmentsToSrt(metadata.segments), 'transcript.srt', 'text/plain;charset=utf-8') }
  function loadHistory(item) { setTranscript(item.text); setMetadata({ ...item, detected_language: item.language, word_count: item.words, processing_seconds: item.seconds }); setActiveView('transcribe'); setNotice('History item loaded.') }
  function deleteHistory(id) { const next = history.filter((item) => item.id !== id); setHistory(next); localStorage.setItem('whisper-history', JSON.stringify(next)) }

  const modelDescription = models.find((model) => model.id === settings.model)?.description
  const transcriptWords = transcript.trim().split(/\s+/).filter(Boolean).length

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><AudioLines size={20} /></span><span>Whisper<span className="brand-accent">Studio</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{[['transcribe', Sparkles, 'Transcribe'], ['history', History, 'History'], ['settings', Settings, 'Settings'], ['about', Info, 'About']].map(([id, Icon, label]) => <button key={id} onClick={() => setActiveView(id)} className={`nav-item ${activeView === id ? 'active' : ''}`}><Icon size={17} /><span>{label}</span>{id === 'history' && history.length > 0 && <span className="nav-count">{history.length}</span>}</button>)}</nav>
      <div className="sidebar-footer"><div className="model-chip"><span className={`status-dot ${backendStatus}`} />{backendStatus === 'online' ? 'Backend online' : backendStatus === 'offline' ? 'Backend offline' : 'Checking backend'}<strong>{settings.model}</strong></div><button className="theme-toggle" onClick={() => setDark((value) => !value)}>{dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'Light mode' : 'Dark mode'}</button><p>Local inference. Your audio stays on this machine.</p></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="topbar-title"><p className="eyebrow">WORKSPACE / {activeView.toUpperCase()}</p><h1>{activeView === 'transcribe' ? 'What would you like to transcribe?' : activeView === 'history' ? 'Your recent transcripts.' : activeView === 'settings' ? 'Workspace settings.' : 'About Whisper Studio.'}</h1></div><div className="header-actions"><label className="command-search"><Search size={15} /><input aria-label="Search workspace" placeholder="Search workspace" /></label><a className="docs-link" href="http://localhost:8000/docs" target="_blank" rel="noreferrer">Docs</a><div className={`header-badge ${backendStatus}`}><span className="status-dot" />{backendStatus === 'online' ? 'Connected' : backendStatus === 'offline' ? 'Offline' : 'Checking'}</div></div></header>
      {activeView === 'transcribe' && <>
        <section className="intro-row"><p>Upload audio or record your voice. Transcribe locally, edit your text, and export your results.</p><span className="intro-note"><Clock3 size={15} /> Offline after model setup</span></section>
        <section className="workspace-strip"><div className="workspace-stat"><span className="stat-icon teal"><Sparkles size={16} /></span><div><small>ACTIVE MODEL</small><strong>{settings.model} / {settings.mode}</strong></div></div><div className="workspace-stat"><span className="stat-icon blue"><AudioLines size={16} /></span><div><small>MEDIA INPUT</small><strong>Audio + video files</strong></div></div><div className="workspace-stat"><span className="stat-icon gold"><Check size={16} /></span><div><small>PRIVACY</small><strong>Processed locally</strong></div></div></section>
        <div className="dashboard-grid">
          <section className="panel input-panel"><div className="panel-heading"><div><span className="section-kicker">01 / SOURCE AUDIO</span><h2>Add your recording</h2></div><span className="format-note">Max 100 MB</span></div>
            <div className={`dropzone ${file ? 'has-file' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]) }} onClick={() => !file && fileInput.current?.click()}>{file ? <><div className="file-icon"><FileAudio size={25} /></div><div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)} / {audioDuration ? formatTime(audioDuration) : 'duration loading'}</span></div><button className="icon-button" title="Remove audio" onClick={(event) => { event.stopPropagation(); reset() }}><X size={18} /></button></> : <><div className="upload-icon"><Upload size={24} /></div><strong>Drop an audio or video file here</strong><span>or click to browse from your computer</span><small>WAV, MP3, M4A, FLAC, OGG, WebM, MP4</small></>}<input ref={fileInput} hidden type="file" accept={ACCEPTED.join(',')} onChange={(event) => chooseFile(event.target.files[0])} /></div>
            {audioUrl && <div className="audio-preview"><div className="audio-label"><AudioLines size={14} /> Preview</div><audio controls src={audioUrl} onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration)} /></div>}
            <div className="or-divider"><span>OR RECORD LIVE</span></div><button className={`record-button ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording}>{isRecording ? <><Square size={16} fill="currentColor" /> Stop recording <span className="record-timer">{formatTime(recordingSeconds)}</span></> : <><Mic size={18} /> Record from microphone</>}</button>
            {error && <div className="error-message"><X size={16} />{error}</div>}
            <div className="control-grid"><label>Audio type<select value={settings.audioType} onChange={(event) => updateSetting('audioType', event.target.value)}><option value="speech">General speech</option><option value="lecture">Lecture / meeting</option><option value="song">Song / vocals</option></select></label><label>Language<select value={settings.language} onChange={(event) => updateSetting('language', event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>Processing mode<select value={settings.mode} onChange={(event) => updateSetting('mode', event.target.value)}><option value="fast">Fast mode</option><option value="accuracy">Accuracy mode</option></select></label><label>Whisper model<select value={settings.model} onChange={(event) => updateSetting('model', event.target.value)}>{(models.length ? models : [{ id: 'base', name: 'Base', description: '' }]).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
            {modelDescription && <p className="control-hint">{modelDescription} Accuracy mode uses a wider beam search and takes longer.</p>}
            {settings.audioType === 'song' && <div className="song-note"><Info size={15} /> Singing, instruments, effects, and backing vocals can reduce lyric accuracy. Unclear words are left out.</div>}
            <button className="primary-button" disabled={isTranscribing || !file || backendStatus === 'offline'} onClick={handleTranscribe}>{isTranscribing ? <><span className="spinner" /> Processing with {settings.model}...</> : <><Sparkles size={18} /> Transcribe audio</>}</button>
          </section>
          <section className="panel result-panel"><div className="panel-heading"><div><span className="section-kicker">02 / RESULT</span><h2>Your transcript</h2></div>{metadata && <span className="result-status"><Check size={14} /> Ready</span>}</div>
            <div className={`transcript-wrap ${!transcript ? 'empty' : ''}`}>{transcript ? <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} aria-label="Editable transcript" /> : <div className="empty-result"><div className="empty-icon"><AudioLines size={25} /></div><strong>Your words will appear here</strong><span>Run a transcription to create an editable transcript.</span></div>}</div>
            {metadata && <><div className="result-meta"><span>Detected <strong>{metadata.detected_language?.toUpperCase()}</strong></span><span>Model <strong>{metadata.model || settings.model}</strong></span><span>Processed <strong>{metadata.processing_seconds || '--'}s</strong></span><span>{transcriptWords} words</span></div>{metadata.warnings?.map((warning) => <div className="song-note" key={warning}><Info size={15} /> {warning}</div>)}</>}
            <div className="result-actions"><button className="secondary-button" disabled={!transcript} onClick={() => copyText()}><Clipboard size={16} /> Copy</button><button className="secondary-button" disabled={!transcript} onClick={downloadText}><Download size={16} /> TXT</button><button className="secondary-button" disabled={!metadata?.segments?.length} onClick={downloadSrt}><Download size={16} /> SRT</button><button className="clear-button" onClick={reset}><X size={16} /> Clear</button></div>{notice && <div className="success-message"><Check size={15} /> {notice}</div>}
          </section>
        </div>
      </>}
      {activeView === 'history' && <section className="wide-panel panel"><div className="panel-heading"><div><span className="section-kicker">LOCAL STORAGE</span><h2>Recent transcripts</h2></div><span className="format-note">{history.length} saved</span></div>{history.length === 0 ? <div className="history-empty"><History size={28} /><strong>No transcripts yet</strong><span>Completed transcriptions will show up here.</span></div> : <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}><div className="history-icon"><FileAudio size={18} /></div><div><strong>{item.name}</strong><p>{new Date(item.createdAt).toLocaleString()} / {item.language?.toUpperCase()} / {item.words || 0} words / {item.model || 'base'}</p><span className="history-preview">{item.text}</span></div><button className="icon-button" title="Copy transcript" onClick={() => copyText(item.text)}><Copy size={16} /></button><button className="icon-button" title="Load transcript" onClick={() => loadHistory(item)}><Check size={16} /></button><button className="icon-button danger" title="Delete transcript" onClick={() => deleteHistory(item.id)}><X size={16} /></button></div>)}</div>}</section>}
      {activeView === 'settings' && <section className="wide-panel panel settings-content"><span className="section-kicker">PERSISTED PREFERENCES</span><h2>Settings</h2><p>These choices are saved in your browser and sent to your local API for each transcription.</p><div className="settings-form"><label>Default language<select value={settings.language} onChange={(event) => updateSetting('language', event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>Default audio type<select value={settings.audioType} onChange={(event) => updateSetting('audioType', event.target.value)}><option value="speech">General speech</option><option value="lecture">Lecture / meeting</option><option value="song">Song / vocals</option></select></label><label>Default mode<select value={settings.mode} onChange={(event) => updateSetting('mode', event.target.value)}><option value="fast">Fast mode</option><option value="accuracy">Accuracy mode</option></select></label><label>Default model<select value={settings.model} onChange={(event) => updateSetting('model', event.target.value)}>{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="check-setting"><input type="checkbox" checked={settings.timestamps} onChange={(event) => updateSetting('timestamps', event.target.checked)} /> Include timestamp segments and enable SRT export</label></div><button className="secondary-button" onClick={() => { setSettings(DEFAULT_SETTINGS); setNotice('Settings reset.') }}>Reset defaults</button></section>}
      {activeView === 'about' && <section className="wide-panel panel about-content"><span className="section-kicker">THE PROJECT</span><h2>Speech recognition, made approachable.</h2><p>Whisper Studio is a university-friendly speech-to-text application powered by OpenAI Whisper through faster-whisper. It runs locally, so recordings do not need to leave your computer.</p><div className="about-grid"><div><strong>Configurable accuracy</strong><span>Choose a model and mode that fit your hardware.</span></div><div><strong>Honest results</strong><span>Warnings explain why songs and noisy audio are harder.</span></div><div><strong>Easy to extend</strong><span>Clean React and Python modules support future viva work.</span></div></div></section>}
    </main>
  </div>
}
