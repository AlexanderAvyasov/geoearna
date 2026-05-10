import { createContext, useContext, useState } from 'react';
import { user } from '../hooks/useTelegram';
import { getTranslator, LANGS } from '../lib/i18n';

const LANG_KEY = user?.id ? `geo_lang_${user.id}` : 'geo_lang';

function detectLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && LANGS[saved]) return saved;
  const tgLang = user?.language_code;
  if (tgLang === 'uz') return 'uz';
  if (tgLang === 'en') return 'en';
  return 'ru';
}

const LanguageContext = createContext({ lang: 'ru', setLang: () => {}, t: k => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  function setLang(newLang) {
    if (!LANGS[newLang]) return;
    localStorage.setItem(LANG_KEY, newLang);
    setLangState(newLang);
  }

  const t = getTranslator(lang);
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
