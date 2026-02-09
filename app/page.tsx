'use client'

import { useState, useRef } from 'react'

type AnalysisResult = {
  prediction: string
  confidence: number
  all_probabilities?: Record<string, number>
  probabilities?: Record<string, number>
  error?: string
}

const LABELS: Record<string, { emoji: string; name: string; tip: string }> = {
  hungry: { emoji: '🍼', name: 'Fame', tip: 'Prova a nutrire il bambino' },
  tired: { emoji: '😴', name: 'Stanchezza', tip: 'Il bambino potrebbe aver bisogno di dormire' },
  belly_pain: { emoji: '🤕', name: 'Mal di pancia', tip: 'Controlla coliche o gas' },
  discomfort: { emoji: '😣', name: 'Disagio', tip: 'Controlla pannolino o temperatura' },
  burping: { emoji: '💨', name: 'Ruttino', tip: 'Prova a far fare il ruttino' },
  cold_hot: { emoji: '🌡️', name: 'Caldo/Freddo', tip: 'Controlla la temperatura della stanza' },
  lonely: { emoji: '🤗', name: 'Solitudine', tip: 'Il bambino vuole attenzione' },
  scared: { emoji: '😨', name: 'Paura', tip: 'Conforta il tuo bambino' },
  unknown: { emoji: '❓', name: 'Sconosciuto', tip: 'Controlla il tuo bambino' },
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeTime, setAnalyzeTime] = useState(0)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const analyzeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const RECORD_SECONDS = 5

  const startRecording = async () => {
    try {
      setError(null)
      setResult(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setCountdown(RECORD_SECONDS)

      const interval = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(interval)
            mediaRecorder.stop()
            setIsRecording(false)
            return 0
          }
          return c - 1
        })
      }, 1000)

    } catch {
      setError('Accesso al microfono negato')
    }
  }

  const analyzeAudio = async () => {
    if (!audioBlob) return

    setAnalyzing(true)
    setAnalyzeTime(0)
    setError(null)

    // Start timer
    analyzeTimerRef.current = setInterval(() => {
      setAnalyzeTime(t => t + 1)
    }, 1000)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error + (data.hint ? ` (${data.hint})` : ''))
      } else {
        setResult(data)
      }
    } catch {
      setError('Analisi fallita. Riprova.')
    } finally {
      setAnalyzing(false)
      if (analyzeTimerRef.current) {
        clearInterval(analyzeTimerRef.current)
      }
    }
  }

  const reset = () => {
    setAudioBlob(null)
    setResult(null)
    setError(null)
    setAnalyzeTime(0)
  }

  const probs = result?.all_probabilities || result?.probabilities || {}

  // Componente SVG per l'icona bebè
  const BabyIcon = () => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Corpo bebè */}
      <ellipse cx="60" cy="75" rx="35" ry="30" fill="#FCA5A5"/>
      {/* Testa bebè */}
      <circle cx="60" cy="40" r="30" fill="#FBBF77"/>
      {/* Ciuffo */}
      <path d="M60 15 C 55 8, 50 10, 48 15" stroke="#CD853F" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* Occhi */}
      <circle cx="50" cy="38" r="3" fill="#333"/>
      <circle cx="70" cy="38" r="3" fill="#333"/>
      {/* Guance rosa */}
      <circle cx="45" cy="45" r="5" fill="#FFB6C1" opacity="0.6"/>
      <circle cx="75" cy="45" r="5" fill="#FFB6C1" opacity="0.6"/>
      {/* Bocca sorridente */}
      <path d="M 52 50 Q 60 56, 68 50" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#FFFFFF',
      color: '#1F2937'
    }}>
      <div style={{ width: '100%', marginTop: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.3rem', fontWeight: '600', color: '#1F2937' }}>
          Analizzatore Pianto Bebè
        </h1>
      </div>

      {!audioBlob && !result && !analyzing && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem'
        }}>
          <BabyIcon />

          <div style={{ marginTop: '1rem' }}>
            <h2 style={{
              fontSize: '1.5rem',
              color: isRecording ? '#EF4444' : '#10B981',
              marginBottom: '0.5rem',
              fontWeight: '500'
            }}>
              {isRecording ? 'In ascolto...' : 'Pronto ad ascoltare...'}
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem' }}>
              {isRecording ? `Registrazione in corso... ${countdown}s` : 'Tocca Avvia e avvicinati al bambino'}
            </p>
          </div>
        </div>
      )}

      {audioBlob && !result && !analyzing && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem'
        }}>
          <BabyIcon />

          <div style={{ marginTop: '1rem' }}>
            <h2 style={{
              fontSize: '1.5rem',
              color: '#10B981',
              marginBottom: '0.5rem',
              fontWeight: '500'
            }}>
              Registrazione completata
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem' }}>
              Audio registrato ({RECORD_SECONDS}s)
            </p>
          </div>

          <audio controls src={URL.createObjectURL(audioBlob)} style={{ marginTop: '1rem' }} />
        </div>
      )}

      {analyzing && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem'
        }}>
          <BabyIcon />

          <div style={{ marginTop: '1rem' }}>
            <h2 style={{
              fontSize: '1.5rem',
              color: '#3B82F6',
              marginBottom: '0.5rem',
              fontWeight: '500'
            }}>
              Analisi in corso...
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem' }}>
              Esecuzione del modello AI tramite GitHub Actions
            </p>
            <p style={{ color: '#9CA3AF', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Tempo trascorso: {Math.floor(analyzeTime / 60)}:{(analyzeTime % 60).toString().padStart(2, '0')}
            </p>
          </div>

          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid #E5E7EB',
            borderTopColor: '#3B82F6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      )}

      {result && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          maxWidth: '400px',
          width: '100%'
        }}>
          <BabyIcon />

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '1.5rem',
              color: result.prediction === 'hungry' ? '#EF4444' : '#10B981',
              marginBottom: '0.5rem',
              fontWeight: '500'
            }}>
              {LABELS[result.prediction]?.name || result.prediction.replace('_', ' ')}
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem' }}>
              {LABELS[result.prediction]?.tip || 'Controlla il tuo bambino'}
            </p>
          </div>

          {Object.keys(probs).length > 0 && (
            <div style={{
              backgroundColor: '#F9FAFB',
              padding: '1rem',
              borderRadius: '12px',
              width: '100%',
              marginTop: '1rem'
            }}>
              <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '0.75rem', fontWeight: '500' }}>
                Confidenza: {(result.confidence * 100).toFixed(1)}%
              </p>
              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' }}>
                {Object.entries(probs)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 3)
                  .map(([label, prob]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#4B5563' }}>
                      {LABELS[label]?.emoji || '❓'} {LABELS[label]?.name || label.replace('_', ' ')}
                    </span>
                    <span style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>
                      {((prob as number) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <BabyIcon />
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', color: '#EF4444', marginBottom: '0.5rem', fontWeight: '500' }}>
              Errore
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem' }}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Pulsante blu fisso in basso */}
      {!analyzing && (
        <div style={{ width: '100%', maxWidth: '400px', padding: '1rem 0' }}>
          <button
            onClick={
              !audioBlob && !result ? startRecording :
              audioBlob && !result ? analyzeAudio :
              reset
            }
            disabled={isRecording}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: '500',
              backgroundColor: isRecording ? '#9CA3AF' : '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: isRecording ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: isRecording ? 'none' : '0 4px 6px rgba(59, 130, 246, 0.2)'
            }}
          >
            {isRecording ? 'In ascolto...' :
             !audioBlob && !result ? 'Avvia' :
             audioBlob && !result ? 'Analizza' :
             'Registra di nuovo'}
          </button>

          {audioBlob && !result && (
            <button
              onClick={reset}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                marginTop: '0.5rem',
                backgroundColor: 'transparent',
                color: '#9CA3AF',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Annulla
            </button>
          )}
        </div>
      )}

      <p style={{ color: '#9CA3AF', marginBottom: '2rem', fontSize: '0.8rem', textAlign: 'center' }}>
        Strumento di ricerca, non consiglio medico • Accuratezza del modello: ~90%
      </p>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}
