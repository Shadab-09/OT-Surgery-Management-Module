import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { I18n as I18nApi } from './api/client'

const STORAGE_KEY = 'ui-lang'

const FALLBACK_LANGS = [
  { code: 'en', name: 'English', english_name: 'English', script: 'Latin' },
  { code: 'hi', name: 'हिन्दी', english_name: 'Hindi', script: 'Devanagari' },
  { code: 'bn', name: 'বাংলা', english_name: 'Bengali', script: 'Bengali' },
  { code: 'te', name: 'తెలుగు', english_name: 'Telugu', script: 'Telugu' },
  { code: 'mr', name: 'मराठी', english_name: 'Marathi', script: 'Devanagari' },
  { code: 'ta', name: 'தமிழ்', english_name: 'Tamil', script: 'Tamil' },
  { code: 'ur', name: 'اُردُو', english_name: 'Urdu', script: 'Perso-Arabic' },
  { code: 'gu', name: 'ગુજરાતી', english_name: 'Gujarati', script: 'Gujarati' },
  { code: 'kn', name: 'ಕನ್ನಡ', english_name: 'Kannada', script: 'Kannada' },
  { code: 'ml', name: 'മലയാളം', english_name: 'Malayalam', script: 'Malayalam' },
  { code: 'or', name: 'ଓଡ଼ିଆ', english_name: 'Odia', script: 'Odia' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', english_name: 'Punjabi', script: 'Gurmukhi' },
]

// BCP-47 locale tags the Web Speech API understands. Used when we synthesize
// the "please proceed to counter" announcement on the Display Board.
const SPEECH_LOCALE = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', te: 'te-IN', mr: 'mr-IN',
  ta: 'ta-IN', ur: 'ur-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN',
  or: 'or-IN', pa: 'pa-IN', as: 'as-IN', ne: 'ne-NP', sa: 'sa-IN',
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'en')
  const [bundle, setBundle] = useState({ labels: {}, templates: {}, meta: { name: 'English' } })
  const [languages, setLanguages] = useState(FALLBACK_LANGS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    I18nApi.bundle(lang)
      .then((r) => {
        if (cancelled) return
        setBundle({
          labels: r.data.labels || {},
          templates: r.data.templates || {},
          meta: r.data.meta || { name: lang },
        })
        if (Array.isArray(r.data.languages) && r.data.languages.length) {
          setLanguages(r.data.languages)
        }
      })
      .catch(() => { /* offline-tolerant: keep previous bundle */ })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [lang])

  const setLang = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback((key, fallback) => {
    const val = bundle.labels?.[key]
    return val || fallback || key
  }, [bundle])

  const announce = useCallback((key, params = {}) => {
    const tpl = bundle.templates?.[key]
    if (!tpl) return ''
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : ''))
  }, [bundle])

  const speechLocale = SPEECH_LOCALE[lang] || 'en-IN'

  const value = useMemo(() => ({
    lang, setLang, t, announce, languages, bundle, loading, speechLocale,
  }), [lang, setLang, t, announce, languages, bundle, loading, speechLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

export function LanguagePicker({ className = '', style = {} }) {
  const { lang, setLang, languages } = useI18n()
  return (
    <select
      className={className}
      style={style}
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label="Language"
    >
      {languages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name} {l.english_name && l.english_name !== l.name ? `· ${l.english_name}` : ''}
        </option>
      ))}
    </select>
  )
}
