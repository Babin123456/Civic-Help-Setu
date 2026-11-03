/**
 * multilingualVoiceNavigationService.js
 *
 * Multilingual Voice Navigation and Discovery Service for civic schemes.
 * Supports Web Speech STT and TTS in English, Hindi, and major Indian regional
 * languages, mapping colloquial voice descriptions to catalogued civic roadmaps.
 *
 * Accessibility & Privacy Guarantees:
 * - Never prompts for microphone access without direct user click.
 * - Provides graceful fallback when Web Speech API is absent or denied.
 * - Local-first speech-to-intent matching; zero audio recordings stored.
 */

import { services } from '../data/services';

export const SUPPORTED_VOICE_LANGUAGES = [
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', name: 'Hindi' },
  { code: 'en-IN', label: 'English (India)', name: 'English' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', name: 'Bengali' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', name: 'Tamil' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', name: 'Telugu' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', name: 'Marathi' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', name: 'Kannada' },
];

/**
 * Vernacular speech intents mapping colloquial voice descriptions to canonical service IDs.
 */
export const VERNACULAR_INTENTS = [
  {
    serviceId: 'ration-card',
    keywords: [
      'ration card', 'rashan card', 'food security', 'bpl card', 'ration', 'khadya suraksha',
      'राशन कार्ड', 'राशन', 'खाद्य सुरक्षा', 'बीपीएल राशन कार्ड', 'अन्न भाग्य',
      'রেশন কার্ড', 'রেশন', 'খাদ্য সাথী',
      'ரேஷன் கார்டு', 'ரேஷன் அட்டை',
      'రేషన్ కార్డు', 'ఆహార భద్రత',
      'रेशन कार्ड', 'धान्य पत्रिका',
      'ರೇಷನ್ ಕಾರ್ಡ್', 'ಅನ್ನ ಭಾಗ್ಯ',
    ],
  },
  {
    serviceId: 'driving-license',
    keywords: [
      'driving license', 'driving licence', 'dl apply', 'learners license', 'vehicle license', 'car license', 'bike license', 'rto license',
      'ड्राइविंग लाइसेंस', 'गाड़ी का लाइसेंस', 'ड्रायविंग', 'लाइसेंस', 'लर्निंग लाइसेंस',
      'ড্রাইভিং লাইসেন্স', 'গাড়ির লাইসেন্স',
      'ஓட்டுநர் உரிமம்', 'டிரைவிங் லைசென்ஸ்',
      'డ్రైవింగ్ లైసెన్స్', 'లెర్నర్స్ లైసెన్స్',
      'ड्रायव्हिंग लायसन्स', 'वाहन चालवण्याचा परवाना',
      'ಚಾಲನಾ ಪರವಾನಗಿ', 'ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್',
    ],
  },
  {
    serviceId: 'voter-id',
    keywords: [
      'voter id', 'epic card', 'election card', 'vote card', 'voting identity', 'voter registration',
      'वोटर आईडी', 'वोटर कार्ड', 'मतदाता पहचान पत्र', 'पहचान पत्र',
      'ভোটার কার্ড', 'ভোটার আইডি', 'নির্বাচন পরিচয়পত্র',
      'வாக்காளர் அட்டை', 'வாக்காளர் அடையாள அட்டை',
      'ఓటరు కార్డు', 'ఎన్నికల గుర్తింపు కార్డు',
      'मतदार ओळखपत्र', 'इलेक्शन कार्ड',
      'ಮತದಾರರ ಗುರುತಿನ ಚೀಟಿ', 'ವೋಟರ್ ಐಡಿ',
    ],
  },
  {
    serviceId: 'aadhaar-update',
    keywords: [
      'aadhaar update', 'aadhaar card', 'aadhar address change', 'uidai', 'biometric update', 'aadhaar mobile link',
      'आधार कार्ड', 'आधार में पता बदलना', 'आधार अपडेट', 'आधार कार्ड संशोधन',
      'আধার কার্ড', 'আধার সংশোধন', 'আধার ঠিকানা বদল',
      'ஆதார் அட்டை', 'ஆதார் முகவரி மாற்றம்',
      'ఆధార్ కార్డు', 'ఆధార్ అడ్రస్ మార్పు',
      'आधार कार्ड दुरुस्ती', 'आधार पत्ता बदल',
      'ಆಧಾರ್ ಕಾರ್ಡ್', 'ಆಧಾರ್ ತಿದ್ದುಪಡಿ',
    ],
  },
  {
    serviceId: 'birth-certificate',
    keywords: [
      'birth certificate', 'baby birth registration', 'birth proof', 'janma praman patra',
      'जन्म प्रमाण पत्र', 'बच्चे का जन्म प्रमाण पत्र', 'बर्थ सर्टिफिकेट',
      'জন্ম সনদ', 'জন্ম সার্টিফিকেট',
      'பிறப்பு சான்றிதழ்',
      'జనన ధృవీకరణ పత్రం', 'బర్త్ సర్టిఫికెట్',
      'जन्म दाखला', 'जन्माचा दाखला',
      'ಜನನ ಪ್ರಮಾಣಪತ್ರ',
    ],
  },
  {
    serviceId: 'income-certificate',
    keywords: [
      'income certificate', 'income proof', 'tahsildar income certificate', 'aay praman patra',
      'आय प्रमाण पत्र', 'इनकम सर्टिफिकेट', 'तहसीलदार आय प्रमाण पत्र',
      'আয় সনদপত্র', 'ইনকাম সার্টিফিকেট',
      'வருமான சான்றிதழ்',
      'ఆదాయ ధృవీకరణ పత్రం', 'ఇన్‌కమ్ సర్టిఫికెట్',
      'उत्पन्नाचा दाखला', 'उत्पन्न प्रमाणपत्र',
      'ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ',
    ],
  },
  {
    serviceId: 'caste-certificate',
    keywords: [
      'caste certificate', 'sc st certificate', 'obc certificate', 'jati praman patra', 'community certificate',
      'जाति प्रमाण पत्र', 'ओबीसी प्रमाण पत्र', 'एससी एसटी सर्टिफिकेट',
      'জাতিগত শংসাপত্র', 'কাস্ট সার্টিফিকেট',
      'சாதி சான்றிதழ்',
      'కుల ధృవీకరణ పత్రం', 'క్యాస్ట్ సర్టిఫికెట్',
      'जातीचा दाखला', 'जात प्रमाणपत्र',
      'ಜಾತಿ ಪ್ರಮಾಣಪತ್ರ',
    ],
  },
  {
    serviceId: 'electricity-connection',
    keywords: [
      'electricity connection', 'power connection', 'electric meter', 'new light meter', 'bijli connection',
      'बिजली का नया कनेक्शन', 'बिजली मीटर', 'नया बिजली कनेक्शन', 'विद्युत कनेक्शन',
      'বিদ্যুৎ সংযোগ', 'নতুন বিদ্যুতের মিটার',
      'மின் இணைப்பு', 'புதிய மின்சார மீட்டர்',
      'విద్యుత్ కనెక్షన్', 'కొత్త కరెంట్ మీటర్',
      'नवीन वीज जोडणी', 'लाइटचे मीटर',
      'ಹೊಸ ವಿದ್ಯುತ್ ಸಂಪರ್ಕ',
    ],
  },
];

/**
 * Checks whether browser supports Web Speech Recognition.
 */
export function isSpeechRecognitionSupported() {
  const win = typeof window !== 'undefined' ? window : globalThis;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  const win = typeof window !== 'undefined' ? window : globalThis;
  return Boolean(win.speechSynthesis && (win.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance));
}

/**
 * Maps a spoken voice transcript to relevant civic services.
 *
 * @param {string} transcript - Transcribed voice string
 * @param {string} [languageCode='en-IN'] - Selected spoken language code
 * @param {Array} [catalogOverride] - Optional services list
 * @returns {Object} Search results with matched services and match reasons
 */
export function resolveMultilingualVoiceQuery(transcript = '', languageCode = 'en-IN', catalogOverride = null) {
  const safeText = String(transcript || '').trim().toLowerCase();
  const catalog = catalogOverride || services || [];

  if (!safeText) {
    return {
      isValid: false,
      transcript: '',
      languageCode,
      matches: [],
      reason: 'No speech transcript received.',
    };
  }

  const scoredMatches = [];

  // 1. Check vernacular colloquial intent rules
  VERNACULAR_INTENTS.forEach((intent) => {
    let bestScore = 0;
    let matchedPhrase = '';

    intent.keywords.forEach((kw) => {
      const lowerKw = kw.toLowerCase();
      if (safeText.includes(lowerKw)) {
        const score = lowerKw.includes(' ') ? 40 : 25;
        if (score > bestScore) {
          bestScore = score;
          matchedPhrase = kw;
        }
      }
    });

    if (bestScore > 0) {
      const service = catalog.find((s) => s.id === intent.serviceId);
      if (service) {
        scoredMatches.push({
          service,
          score: bestScore + 50, // High boost for exact colloquial vernacular intent match
          matchReason: `Matched voice keyword "${matchedPhrase}" in your speech.`,
          isIntentMatch: true,
        });
      }
    }
  });

  // 2. Perform general text similarity across catalog services
  catalog.forEach((service) => {
    // Avoid duplicating if already matched by intent
    if (scoredMatches.some((m) => m.service.id === service.id)) return;

    let score = 0;
    const nameLower = (service.name || '').toLowerCase();
    const descLower = (service.description || '').toLowerCase();
    const catLower = (service.category || '').toLowerCase();

    // Check words in transcript against service name and category
    const words = safeText.split(/\s+/).filter((w) => w.length > 2);
    words.forEach((word) => {
      if (nameLower.includes(word)) score += 20;
      else if (catLower.includes(word)) score += 10;
      else if (descLower.includes(word)) score += 5;
    });

    if (score >= 15) {
      scoredMatches.push({
        service,
        score,
        matchReason: `Keywords from speech match "${service.name}".`,
        isIntentMatch: false,
      });
    }
  });

  // Sort descending by score
  scoredMatches.sort((a, b) => b.score - a.score);

  const topResults = scoredMatches.slice(0, 5);

  return {
    isValid: true,
    transcript: safeText,
    languageCode,
    totalFound: topResults.length,
    matches: topResults,
    topMatch: topResults[0] || null,
  };
}

/**
 * Prepares clean, concise text for text-to-speech announcement.
 *
 * @param {Object} service - Service record
 * @param {string} [languageCode='en-IN'] - Spoken language
 * @returns {string} Plain spoken announcement string
 */
export function generateSpokenServiceSummary(service, languageCode = 'en-IN') {
  if (!service) return 'No service details selected.';

  const fee = service.fees || service.fee || 'Nil or minimal official charges';
  const duration = service.processingTime || service.timeRequired || 'Standard timeline';
  const department = service.department || 'Civic Authority';

  if (languageCode.startsWith('hi')) {
    return `सेवा का नाम: ${service.name}. विभाग: ${department}. अनुमानित समय: ${duration}. सरकारी शुल्क: ${fee}.`;
  }

  return `Service: ${service.name}. Responsible Department: ${department}. Processing Duration: ${duration}. Statutory Fee: ${fee}. Please review the document checklist before applying.`;
}

/**
 * Speaks an utterance aloud via browser SpeechSynthesis.
 * Safe no-op if speechSynthesis is unavailable.
 */
export function speakTextAloud(text, languageCode = 'en-IN', onEnd = () => {}) {
  if (!isSpeechSynthesisSupported()) return false;

  const win = typeof window !== 'undefined' ? window : globalThis;
  const UtteranceClass = win.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;

  try {
    win.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new UtteranceClass(text);
    utterance.lang = languageCode;
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    win.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stops any active speech synthesis.
 */
export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    const win = typeof window !== 'undefined' ? window : globalThis;
    try {
      win.speechSynthesis.cancel();
    } catch {
      // Safe ignore
    }
  }
}
