import { trimHistory } from '../ai/conversationContext.js';
import { logDiagnostic } from '../utils/diagnostics';

const STORAGE_KEY = 'civicbridge_chat_history';

export const DEFAULT_WELCOME_MESSAGE = {
  id: 'welcome-msg',
  role: 'assistant',
  text: 'Hello! I am the CivicBridge AI Assistant. Tell me what you need help with, for example: "I need to apply for a birth certificate" or "What documents do I need for a driving license?"',
  timestamp: new Date().toISOString(),
};

export const loadChatHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_WELCOME_MESSAGE];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_WELCOME_MESSAGE];
  } catch (err) {
    logDiagnostic('Failed to load chat history', err);
    return [DEFAULT_WELCOME_MESSAGE];
  }
};

export const saveChatHistory = (messages) => {
  try {
    // Only save serializable data
    const serializable = trimHistory(messages).map((m) => ({
      id: m.id || `msg-${Date.now()}-${Math.random()}`,
      role: m.role,
      text: m.text || (typeof m.content === 'string' ? m.content : ''),
      data: m.data || null,
      serviceId: m.serviceId || null,
      suggestions: m.suggestions || [],
      grounded: m.grounded,
      confidenceScore: m.confidenceScore,
      retrievedChunks: m.retrievedChunks || [],
      timestamp: m.timestamp || new Date().toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (err) {
    logDiagnostic('Failed to save chat history', err);
  }
};

export const clearChatHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
  return [DEFAULT_WELCOME_MESSAGE];
};

export const exportChatAsMarkdown = (messages = []) => {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let md = `# Civic Help Setu — Citizen Consultation Transcript\n\n`;
  md += `**Generated on:** ${dateStr}\n`;
  md += `**Platform:** CivicBridge Public Service Navigator\n\n`;
  md += `---\n\n`;

  messages.forEach((msg, idx) => {
    const sender = msg.role === 'assistant' ? '🤖 Civic Assistant' : '👤 Citizen';
    md += `### ${idx + 1}. ${sender}\n\n`;

    if (msg.text) {
      md += `${msg.text}\n\n`;
    }

    if (msg.data) {
      if (msg.data.title) md += `**Topic:** ${msg.data.title}\n\n`;
      if (msg.data.summary) md += `**Summary:** ${msg.data.summary}\n\n`;

      if (msg.data.steps && msg.data.steps.length > 0) {
        md += `**Key Steps:**\n`;
        msg.data.steps.forEach((s, sIdx) => {
          md += `${sIdx + 1}. **${s.title}**: ${s.description || ''}\n`;
        });
        md += `\n`;
      }

      if (msg.data.officialSources && msg.data.officialSources.length > 0) {
        md += `**Verified Sources:**\n`;
        msg.data.officialSources.forEach((src) => {
          md += `- [${src.name}](${src.url})\n`;
        });
        md += `\n`;
      }
    }

    md += `---\n\n`;
  });

  // Trigger browser download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `civicbridge-consultation-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
