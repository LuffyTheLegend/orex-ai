// Orex AI - Groq chat with improved security, UX, accessibility, and features

const GROQ_MODEL = "groq/compound"; // has built-in real-time web search, so Orex isn't frozen at its training cutoff
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b"; // meta-llama/llama-4-scout-17b-16e-instruct (the previous choice) was shut down by Groq on 07/17/2026 for free/dev tier — qwen3.6-27b is Groq's own current recommended vision replacement. It runs in "thinking mode" by default, which is exactly what the reasoning_format + extraction logic below is for.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_HISTORY = 20;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_CONTENT_CHARS = 16000;
const JSON_EXTENSIONS = new Set(["json", "jsonl", "geojson"]);
const CODE_LANGUAGE_MAP = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  php: "php",
  java: "java",
  go: "go",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  kt: "kotlin",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  html: "html",
  css: "css",
  scss: "scss",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  env: "dotenv",
};
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "log",
  "rtf",
  "json",
  "jsonl",
  "geojson",
  ...Object.keys(CODE_LANGUAGE_MAP),
]);

// ============ DOM Elements ============
const sendButton = document.querySelector(".send-btn");
const chatLog = document.querySelector(".chat-log");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const themeToggle = document.getElementById("theme-toggle");
const clearBtn = document.getElementById("clear-btn");
const statusBar = document.getElementById("status");
const msgCount = document.getElementById("msg-count");
const imageInput = document.getElementById("image-input");
const fileInput = document.getElementById("file-input");
const settingsOverlay = document.getElementById("settings-overlay");
const openSettingsBtn = document.getElementById("open-settings-btn");
const closeSettingsBtn = document.getElementById("close-settings");
const saveSettings = document.getElementById("save-settings");
const apiKeyInput = document.getElementById("api-key-input");
const chatListEl = document.getElementById("chat-list");
const newChatBtn = document.getElementById("new-chat-btn");
const exportBtn = document.getElementById("export-btn");
const popupOverlay = document.getElementById("popup-overlay");
const newChatPopup = document.getElementById("new-chat-popup");
const newChatNameInput = document.getElementById("new-chat-name");
const createChatBtn = document.getElementById("create-chat-btn");
const cancelChatBtn = document.getElementById("cancel-chat-btn");
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmMessage = document.getElementById("confirm-message");
const confirmYes = document.getElementById("confirm-yes");
const confirmNo = document.getElementById("confirm-no");
const aboutBtn = document.getElementById("about-btn");
const aboutOverlay = document.getElementById("about-overlay");
const closeAboutBtn = document.getElementById("close-about-btn");

// ============ Attach Menu DOM ============
const attachBtn = document.getElementById("attach-btn");
const attachMenu = document.getElementById("attach-menu");
const attachFilesBtn = document.getElementById("attach-files-btn");
const attachGenerateBtn = document.getElementById("attach-generate-btn");
const attachResearchBtn = document.getElementById("attach-research-btn");
const attachQuizBtn = document.getElementById("attach-quiz-btn");
const attachWikiBtn = document.getElementById("attach-wiki-btn");
const attachDictBtn = document.getElementById("attach-dict-btn");

// ============ Response Mode DOM ============
const modeBtn = document.getElementById("mode-btn");
const modeBtnLabel = document.getElementById("mode-btn-label");
const modeMenu = document.getElementById("mode-menu");
const MODE_LABELS = { smart: "Smart", casual: "Casual", coder: "Coder", teacher: "Teacher" };

// ============ Memory DOM ============
const memoryEnabledCheckbox = document.getElementById("memory-enabled-checkbox");
const memoryListEl = document.getElementById("memory-list");
const memoryClearBtn = document.getElementById("memory-clear-btn");
const MEMORY_STORAGE_KEY = "rexMemoryFacts";
const MEMORY_ENABLED_KEY = "rexMemoryEnabled";
const MAX_MEMORY_FACTS = 60;
const MODE_SYSTEM_PROMPTS = {
  smart:
    "Match your tone and depth to the question: be casual and conversational for simple stuff, and switch to detailed, well-organized answers when the topic is complex. Don't pad simple questions with long, heavily-formatted answers just for the sake of it.",
  casual:
    "Keep it casual and conversational, like texting a friend who knows their stuff. Prefer short, plain-language answers. Avoid long paragraphs, headers, and heavy bold/markdown formatting unless the user specifically asks for more detail or structure.",
  coder:
    "Be precise and technical. Lead with code when relevant, use properly formatted code blocks, and keep prose explanations tight and focused. Call out edge cases, performance, and best practices where relevant.",
  teacher:
    "Act as a thorough, expert teacher. Give in-depth, well-structured explanations — more advanced and detailed than a typical quick answer. Use headers, examples, and step-by-step breakdowns to build real understanding, the way a great teacher would.",
};

// ============ Quiz Modal DOM ============
const quizOverlay = document.getElementById("quiz-overlay");
const quizTopicInput = document.getElementById("quiz-topic");
const quizStartBtn = document.getElementById("quiz-start-btn");
const quizCancelBtn = document.getElementById("quiz-cancel-btn");

// ============ Wikipedia Lookup Modal DOM ============
const wikiOverlay = document.getElementById("wiki-overlay");
const wikiTopicInput = document.getElementById("wiki-topic");
const wikiStartBtn = document.getElementById("wiki-start-btn");
const wikiCancelBtn = document.getElementById("wiki-cancel-btn");

// ============ Dictionary Lookup Modal DOM ============
const dictOverlay = document.getElementById("dict-overlay");
const dictWordInput = document.getElementById("dict-word");
const dictStartBtn = document.getElementById("dict-start-btn");
const dictCancelBtn = document.getElementById("dict-cancel-btn");

// ============ Research URLs Modal DOM ============
const researchUrlsBtn = document.getElementById("research-urls-btn");
const researchOverlay = document.getElementById("research-overlay");
const researchUrlsInput = document.getElementById("research-urls-input");
const researchFocusInput = document.getElementById("research-focus");
const researchStartBtn = document.getElementById("research-start-btn");
const researchCancelBtn = document.getElementById("research-cancel-btn");

// ============ State ============
let chats = [];
let currentChatId = null;
let conversationHistory = [];
let pendingConfirm = null;
let isWaitingForResponse = false;
let pendingImages = [];
let currentMode = "smart";

// ============ Initialization ============
function init() {
  const savedTheme = localStorage.getItem("rexTheme") || "light";
  const isDark = savedTheme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  setThemeIcon(isDark);
  syncAppearanceToggle(isDark);

  loadSettings();
  loadChats();
  renderChatList();
  loadMode();
  migrateNameFactsOutOfMemory();
  renderMemoryList();
  applyRexNameToUI();

  if (!chats.length) {
    createChat("Main Chat");
  }

  switchChat(chats[0].id);

  if (typeof hljs !== "undefined") {
    hljs.configure({ ignoreUnescapedHTML: true });
  }

  setupEventListeners();

  if (!getApiKey()) {
    settingsOverlay.classList.remove("hidden");
    updateStatus("👋 Welcome! Grab a free API key below to get started");
  }
}

function setupEventListeners() {
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }
  });

  chatForm.addEventListener("submit", handleSubmit);

  themeToggle.addEventListener("click", toggleTheme);

  clearBtn.addEventListener("click", handleClear);
  openSettingsBtn.addEventListener("click", () => {
    loadSettings();
    settingsOverlay.classList.remove("hidden");
  });
  closeSettingsBtn.addEventListener("click", () => settingsOverlay.classList.add("hidden"));
  const closeSettingsX = document.getElementById("close-settings-x");
  if (closeSettingsX) {
    closeSettingsX.addEventListener("click", () => settingsOverlay.classList.add("hidden"));
  }
  document.querySelectorAll(".appearance-option").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme === "dark"));
  });
  aboutBtn.addEventListener("click", () => aboutOverlay.classList.remove("hidden"));
  closeAboutBtn.addEventListener("click", () => aboutOverlay.classList.add("hidden"));
  saveSettings.addEventListener("click", handleSaveSettings);
  exportBtn.addEventListener("click", handleExport);

  memoryEnabledCheckbox.addEventListener("change", () => {
    setMemoryEnabled(memoryEnabledCheckbox.checked);
    updateStatus(memoryEnabledCheckbox.checked ? "🧠 Memory turned on" : "🧠 Memory turned off");
  });

  memoryClearBtn.addEventListener("click", () => {
    const facts = loadMemoryFacts();
    if (!facts.length) return;
    showConfirm("Clear everything Orex remembers about you?", () => {
      saveMemoryFacts([]);
      renderMemoryList();
      updateStatus("🧠 Memory cleared");
    }, "Clear");
  });

  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".settings-tab-content").forEach((c) => c.classList.add("hidden"));
      tab.classList.add("active");
      document.getElementById(`settings-tab-${tab.dataset.tab}`).classList.remove("hidden");
    });
  });

  newChatBtn.addEventListener("click", openNewChatPopup);
  cancelChatBtn.addEventListener("click", () => popupOverlay.classList.add("hidden"));
  createChatBtn.addEventListener("click", handleCreateChat);

  chatListEl.addEventListener("click", handleChatClick);
  chatListEl.addEventListener("dblclick", handleChatDoubleClick);

  imageInput.addEventListener("change", handleImageUpload);
  fileInput.addEventListener("change", handleFileUpload);

  modeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !modeMenu.classList.contains("hidden");
    if (!isOpen) {
      closeAttachMenu();
      modeMenu.style.left = `${modeBtn.offsetLeft}px`;
    }
    modeMenu.classList.toggle("hidden");
    modeBtn.classList.toggle("open", !isOpen);
    modeBtn.setAttribute("aria-expanded", String(!isOpen));
  });

  modeMenu.querySelectorAll(".mode-item").forEach((item) => {
    item.addEventListener("click", () => {
      setMode(item.dataset.mode);
      closeModeMenu();
      userInput.focus();
    });
  });

  attachBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !attachMenu.classList.contains("hidden");
    if (!isOpen) {
      closeModeMenu();
      attachMenu.style.left = `${attachBtn.offsetLeft}px`;
    }
    attachMenu.classList.toggle("hidden");
    attachBtn.classList.toggle("open", !isOpen);
    attachBtn.setAttribute("aria-expanded", String(!isOpen));
  });

  attachFilesBtn.addEventListener("click", () => {
    closeAttachMenu();
    fileInput.click();
  });

  attachGenerateBtn.addEventListener("click", () => {
    closeAttachMenu();
    userInput.value = "Help me generate a high-quality image prompt for: ";
    userInput.focus();
    updateStatus("💡 Tell Orex what you want to generate (e.g. 'a futuristic city at night')");
  });

  attachResearchBtn.addEventListener("click", () => {
    closeAttachMenu();
    userInput.value = "Do a thorough, well-structured research summary with sources on: ";
    userInput.focus();
    updateStatus("🔍 Orex will research and format with sections + key points");
  });

  attachQuizBtn.addEventListener("click", () => {
    closeAttachMenu();
    quizTopicInput.value = "";
    quizOverlay.classList.remove("hidden");
    quizTopicInput.focus();
  });

  attachWikiBtn.addEventListener("click", () => {
    closeAttachMenu();
    wikiTopicInput.value = "";
    wikiOverlay.classList.remove("hidden");
    wikiTopicInput.focus();
  });

  attachDictBtn.addEventListener("click", () => {
    closeAttachMenu();
    dictWordInput.value = "";
    dictOverlay.classList.remove("hidden");
    dictWordInput.focus();
  });

  quizStartBtn.addEventListener("click", handleStartQuiz);
  quizCancelBtn.addEventListener("click", () => quizOverlay.classList.add("hidden"));
  quizTopicInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleStartQuiz();
  });

  wikiStartBtn.addEventListener("click", handleWikiLookup);
  wikiCancelBtn.addEventListener("click", () => wikiOverlay.classList.add("hidden"));
  wikiTopicInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleWikiLookup();
  });

  dictStartBtn.addEventListener("click", handleDictLookup);
  dictCancelBtn.addEventListener("click", () => dictOverlay.classList.add("hidden"));
  dictWordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleDictLookup();
  });

  researchUrlsBtn.addEventListener("click", () => {
    researchUrlsInput.value = "";
    researchFocusInput.value = "";
    researchOverlay.classList.remove("hidden");
    researchUrlsInput.focus();
  });
  researchStartBtn.addEventListener("click", handleResearchUrls);
  researchCancelBtn.addEventListener("click", () => researchOverlay.classList.add("hidden"));

  document.addEventListener("click", (e) => {
    if (!attachMenu.classList.contains("hidden") && !attachMenu.contains(e.target) && e.target !== attachBtn) {
      closeAttachMenu();
    }
    if (!modeMenu.classList.contains("hidden") && !modeMenu.contains(e.target) && !modeBtn.contains(e.target)) {
      closeModeMenu();
    }
    closeChatMenu();
  });

  confirmYes.addEventListener("click", () => {
    if (pendingConfirm) pendingConfirm();
    confirmOverlay.classList.add("hidden");
  });
  confirmNo.addEventListener("click", () => confirmOverlay.classList.add("hidden"));

  [popupOverlay, confirmOverlay, aboutOverlay, quizOverlay, settingsOverlay, researchOverlay, wikiOverlay, dictOverlay].forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      popupOverlay.classList.add("hidden");
      settingsOverlay.classList.add("hidden");
      confirmOverlay.classList.add("hidden");
      aboutOverlay.classList.add("hidden");
      quizOverlay.classList.add("hidden");
      researchOverlay.classList.add("hidden");
      wikiOverlay.classList.add("hidden");
      dictOverlay.classList.add("hidden");
      closeAttachMenu();
      closeModeMenu();
      closeChatMenu();
    }
  });
}

// ============ Event Handlers ============
async function handleSubmit(e) {
  if (!currentChatId || isWaitingForResponse) return;
  const text = userInput.value.trim();
  if (!text) return;

  addMessageToChat(currentChatId, "user", { type: "text", text });
  userInput.value = "";
  isWaitingForResponse = true;
  sendButton.disabled = true;
  updateStatus("🤔 Thinking...");
  showTypingIndicator();

  const imagesToSend = [...pendingImages];
  pendingImages = [];
  const reply = await callGroq(text, imagesToSend);
  removeTypingIndicator();

  if (reply) {
    addMessageToChat(currentChatId, "rex", { type: "text", text: reply.content, thinking: reply.thinking });
    extractMemoryFacts(text, reply.content); // fire-and-forget, runs in the background
  } else {
    addFailedReplyMessage();
  }

  isWaitingForResponse = false;
  sendButton.disabled = false;
  updateStatus("✅ Ready");
  saveChats();
  userInput.focus();
}

function handleClear() {
  if (!currentChatId) return;

  const chatName = getChatName(currentChatId);
  showConfirm(
    `Clear all messages in "${chatName}"?`,
    () => {
      const chat = chats.find((c) => c.id === currentChatId);
      if (chat) chat.messages = [];
      conversationHistory = [];
      chatLog.innerHTML = "";
      saveChats();
      updateMessageCount();
      updateStatus("🧹 Chat cleared");
    }
  );
}

function setTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  setThemeIcon(isDark);
  localStorage.setItem("rexTheme", isDark ? "dark" : "light");
  syncAppearanceToggle(isDark);
}

function toggleTheme() {
  setTheme(!document.body.classList.contains("dark-mode"));
}

function syncAppearanceToggle(isDark) {
  document.querySelectorAll(".appearance-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === (isDark ? "dark" : "light"));
  });
}

function handleSaveSettings() {
  const rexName = document.getElementById("rex-name").value || "Orex";
  const userName = document.getElementById("user-name").value || "You";
  const apiKey = document.getElementById("api-key-input").value.trim();

  if (apiKey && !apiKey.toLowerCase().startsWith("gsk_")) {
    updateStatus("❌ Invalid API key format");
    return;
  }

  localStorage.setItem("rexName", rexName);
  localStorage.setItem("userName", userName);
  if (apiKey) localStorage.setItem("rexApiKey", apiKey);

  updateStatus("✅ Settings saved");
  settingsOverlay.classList.add("hidden");
  applyRexNameToUI();
}

function handleExport() {
  if (!chats.length) {
    updateStatus("📭 No chats to export");
    return;
  }

  showConfirm(
    `Export all ${chats.length} chat${chats.length === 1 ? "" : "s"} as a JSON file?`,
    () => {
      const dataStr = JSON.stringify(chats, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rex-chats-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      updateStatus("📥 Chats exported");
    },
    "Export"
  );
}

function openNewChatPopup() {
  newChatNameInput.value = "";
  popupOverlay.classList.remove("hidden");
  newChatNameInput.focus();
}

function handleCreateChat() {
  const name = newChatNameInput.value.trim() || "New Chat";
  const isTemp = document.getElementById("temp-chat-checkbox").checked;
  const chat = createChat(name, isTemp);
  switchChat(chat.id);
  popupOverlay.classList.add("hidden");
  document.getElementById("temp-chat-checkbox").checked = false;
}

function handleChatClick(e) {
  const menuBtn = e.target.closest(".chat-menu-btn");
  const item = e.target.closest(".chat-item");
  if (!item) return;

  const id = item.dataset.id;

  if (menuBtn) {
    e.stopPropagation();
    if (openChatMenuId === id) {
      closeChatMenu();
    } else {
      openChatMenu(id, menuBtn);
    }
    return;
  }

  if (!e.target.classList.contains("chat-rename-input")) {
    switchChat(id);
  }
}

function handleChatDoubleClick(e) {
  const item = e.target.closest(".chat-item");
  if (!item) return;
  if (e.target.closest(".chat-menu-btn")) return;

  e.stopPropagation();
  startRenameChat(item.dataset.id);
}

function startRenameChat(id) {
  const item = chatListEl.querySelector(`.chat-item[data-id="${id}"]`);
  if (!item) return;
  const nameSpan = item.querySelector(".chat-name");
  if (!nameSpan) return;

  const currentName = getChatName(id);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "chat-rename-input";
  input.value = currentName;
  input.maxLength = 50;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim() || currentName;
    renameChat(id, newName);
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { committed = true; renderChatList(); }
  });
}

// ============ Chat Options Menu (three-dot) ============
let openChatMenuId = null;
let chatMenuEl = null;

function closeChatMenu() {
  if (chatMenuEl) {
    chatMenuEl.remove();
    chatMenuEl = null;
  }
  openChatMenuId = null;
}

function openChatMenu(id, anchorBtn) {
  closeChatMenu();
  closeAttachMenu();
  closeModeMenu();
  openChatMenuId = id;

  const menu = document.createElement("div");
  menu.className = "chat-menu";
  menu.setAttribute("role", "menu");

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "chat-menu-item";
  renameBtn.setAttribute("role", "menuitem");
  renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg><span>Rename</span>`;
  renameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeChatMenu();
    startRenameChat(id);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "chat-menu-item chat-menu-danger";
  deleteBtn.setAttribute("role", "menuitem");
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg><span>Delete</span>`;
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeChatMenu();
    const chatName = getChatName(id);
    showConfirm(`Delete "${chatName}"?`, () => deleteChat(id));
  });

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);

  const rect = anchorBtn.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + 4;
  let left = rect.right - menuRect.width;
  if (left < 8) left = 8;
  if (top + menuRect.height > window.innerHeight - 8) {
    top = rect.top - menuRect.height - 4;
  }
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  chatMenuEl = menu;
}

function handleImageUpload() {
  const file = imageInput.files[0];
  if (!file || !currentChatId) return;

  if (!isValidImageFile(file)) {
    updateStatus("❌ Invalid image file");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    addMessageToChat(currentChatId, "user", { type: "image", src: reader.result });
    pendingImages.push(reader.result);
    updateStatus("📷 Image added – type a message to discuss it with Orex");
    saveChats();
  };
  reader.onerror = () => updateStatus("❌ Failed to read image");
  reader.readAsDataURL(file);
  imageInput.value = "";
}

async function handleFileUpload() {
  const file = fileInput.files[0];
  if (!file || !currentChatId) return;

  if (file.type.startsWith("image/")) {
    if (!isValidImageFile(file)) {
      updateStatus("❌ Invalid image (must be under 10 MB)");
      fileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addMessageToChat(currentChatId, "user", { type: "image", src: reader.result });
      pendingImages.push(reader.result);
      updateStatus("📷 Image added – type a message to discuss it with Orex");
      saveChats();
    };
    reader.onerror = () => updateStatus("❌ Failed to read image");
    reader.readAsDataURL(file);
    fileInput.value = "";
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    updateStatus(`❌ File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    fileInput.value = "";
    return;
  }

  try {
    const fileMessage = await buildFileMessage(file);
    addMessageToChat(currentChatId, "user", fileMessage);
    updateStatus(
      fileMessage.extractedText ? "📁 File ready for Orex to analyze" : "📎 File shared as a link"
    );
    saveChats();
  } catch (error) {
    console.error("Error reading file:", error);
    updateStatus("❌ Failed to read file");
  } finally {
    fileInput.value = "";
  }
}

// ============ Chat Management ============
function buildWelcomeMessage() {
  const rexName = getRexName();
  const userName = getUserName();
  const hey = userName ? `Hey ${userName}` : "Hey";
  const options = [
    `${hey}! I'm ${rexName} — what's on your mind?`,
    `${hey}, ${rexName} here. What are we working on?`,
    `${hey}! ${rexName}, ready when you are — what's up?`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function createChat(name, temporary = false) {
  const id = Date.now().toString();
  const chat = {
    id,
    name,
    messages: [{ type: "text", role: "rex", text: buildWelcomeMessage() }],
    createdAt: new Date().toISOString(),
    temporary: !!temporary,
  };
  chats.push(chat);
  renderChatList();
  saveChats();
  return chat;
}

function deleteChat(id) {
  chats = chats.filter((c) => c.id !== id);
  if (currentChatId === id) {
    switchChat(chats[0]?.id || (createChat("Main Chat").id));
  }
  renderChatList();
  saveChats();
  updateStatus("🗑️ Chat deleted");
}

function switchChat(id) {
  currentChatId = id;
  renderChatList();
  renderCurrentChat();
  rebuildConversationHistory();
  updateStatus(`✅ Switched to "${getChatName(id)}"`);
}

function getChatName(id) {
  const chat = chats.find((c) => c.id === id);
  return chat ? chat.name : "Unknown";
}

function renameChat(id, newName) {
  const chat = chats.find((c) => c.id === id);
  if (chat) {
    chat.name = newName;
    saveChats();
    renderChatList();
    updateStatus(`✏️ Renamed to "${newName}"`);
  }
}

function formatChatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date)) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderChatList() {
  chatListEl.innerHTML = "";
  chats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = "chat-item" + (chat.id === currentChatId ? " active" : "");
    item.dataset.id = chat.id;
    item.role = "listitem";

    const icon = document.createElement("span");
    icon.className = "chat-item-icon";
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const nameSpan = document.createElement("span");
    nameSpan.className = "chat-name";
    nameSpan.textContent = chat.name;
    nameSpan.title = "Double-click to rename";

    const dateSpan = document.createElement("span");
    dateSpan.className = "chat-date";
    dateSpan.textContent = formatChatDate(chat.createdAt);

    meta.appendChild(nameSpan);
    meta.appendChild(dateSpan);

    const menuBtn = document.createElement("button");
    menuBtn.className = "chat-menu-btn";
    menuBtn.type = "button";
    menuBtn.title = "Chat options";
    menuBtn.setAttribute("aria-label", "Chat options");
    menuBtn.setAttribute("aria-haspopup", "true");
    menuBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`;

    item.appendChild(icon);
    item.appendChild(meta);
    if (chat.temporary) {
      const badge = document.createElement("span");
      badge.className = "temp-badge";
      badge.title = "Temporary – not saved";
      badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> TEMP`;
      item.appendChild(badge);
    }
    item.appendChild(menuBtn);
    chatListEl.appendChild(item);
  });
}

function renderCurrentChat() {
  chatLog.innerHTML = "";
  const chat = chats.find((c) => c.id === currentChatId);
  if (!chat) return;

  chat.messages.forEach((msg) => {
    if (msg.type === "text") {
      renderTextMessage(msg.role, msg.text, msg.thinking);
    } else if (msg.type === "image") {
      renderImageMessage(msg.role, msg.src);
    } else if (msg.type === "file") {
      renderFileMessage(msg.role, msg);
    }
  });

  autoScroll();
}

function addMessageToChat(chatId, sender, content) {
  const chat = chats.find((c) => c.id === chatId);
  if (!chat) return;

  // Deep copy so we don't accidentally mutate the caller's object
  const messageToStore = JSON.parse(JSON.stringify(content));
  messageToStore.role = sender;

  chat.messages.push(messageToStore);

  // Render it immediately so the user actually sees it
  if (messageToStore.type === "text") {
    renderTextMessage(sender, messageToStore.text, messageToStore.thinking);
  } else if (messageToStore.type === "image") {
    renderImageMessage(sender, messageToStore.src);
  } else if (messageToStore.type === "file") {
    renderFileMessage(sender, messageToStore);
  }

  const entry = buildConversationEntryFromMessage(messageToStore);
  if (entry) {
    conversationHistory.push(entry);
    trimConversationHistory();
  }
  updateMessageCount();

  saveChats();
}

// ============ Rendering ============
function buildCopyIconButton(getText, label = "Copy message") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "msg-copy-btn";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  btn.innerHTML = copyIcon;
  btn.addEventListener("click", () => {
    navigator.clipboard.writeText(getText() || "").then(() => {
      btn.innerHTML = checkIcon;
      btn.classList.add("copied");
      setTimeout(() => {
        btn.innerHTML = copyIcon;
        btn.classList.remove("copied");
      }, 1500);
    });
  });
  return btn;
}

function renderTextMessage(role, text, thinking) {
  const msg = document.createElement("div");
  msg.className = "msg " + role;

  if (role === "rex") {
    const rawHtml = marked.parse(text || "");
    msg.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;

    msg.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });

    msg.querySelectorAll("pre").forEach((pre) => {
      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copy";
      copyBtn.onclick = () => {
        const code = pre.querySelector("code").textContent;
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => copyBtn.textContent = "Copy", 2000);
        });
      };
      pre.style.position = "relative";
      pre.appendChild(copyBtn);
    });

    if (thinking && thinking.trim()) {
      const thinkBlock = document.createElement("div");
      thinkBlock.className = "think-block";

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "think-toggle";
      toggleBtn.innerHTML = "🧠 Show thinking";

      const thinkBody = document.createElement("div");
      thinkBody.className = "think-body hidden";
      thinkBody.textContent = thinking.trim();

      toggleBtn.onclick = () => {
        const isHidden = thinkBody.classList.toggle("hidden");
        toggleBtn.innerHTML = isHidden ? "🧠 Show thinking" : "🧠 Hide thinking";
      };

      thinkBlock.appendChild(toggleBtn);
      thinkBlock.appendChild(thinkBody);
      msg.insertBefore(thinkBlock, msg.firstChild);
    }
  } else {
    msg.textContent = text;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "msg-wrapper " + role;
  wrapper.appendChild(msg);

  const actions = document.createElement("div");
  actions.className = "msg-actions";
  actions.appendChild(buildCopyIconButton(() => text));
  wrapper.appendChild(actions);

  chatLog.appendChild(wrapper);
  autoScroll();
}

function renderImageMessage(role, src) {
  const msg = document.createElement("div");
  msg.className = "msg " + role;

  const img = document.createElement("img");
  img.src = src;
  img.className = "chat-image";
  img.alt = `Image from ${role}`;
  img.onerror = () => (img.alt = "Failed to load image");

  msg.appendChild(img);
  chatLog.appendChild(msg);
  autoScroll();
}

function renderFileMessage(role, file) {
  const {
    name,
    url,
    size,
    fileCategory = "binary",
    categoryLabel = "File",
    contentStatus = "",
    previewText = "",
  } = file;
  const msg = document.createElement("div");
  msg.className = "msg " + role;

  const wrap = document.createElement("div");
  wrap.className = "file-bubble";

  const icon = document.createElement("span");
  icon.className = "file-icon";
  const fileIcons = {
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
    json: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>`,
    code: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    binary: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  };
  icon.innerHTML = fileIcons[fileCategory] || fileIcons.binary;

  const fileInfo = document.createElement("div");
  fileInfo.className = "file-info";

  const topRow = document.createElement("div");
  topRow.className = "file-top-row";

  const link = document.createElement("a");
  link.href = url;
  link.textContent = name;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.download = name;

  const badge = document.createElement("span");
  badge.className = "file-badge";
  badge.textContent = categoryLabel;

  const sizeText = document.createElement("small");
  sizeText.className = "file-meta";
  sizeText.textContent = `${formatFileSize(size)}${contentStatus ? ` · ${contentStatus}` : ""}`;

  topRow.appendChild(link);
  topRow.appendChild(badge);
  fileInfo.appendChild(topRow);
  fileInfo.appendChild(sizeText);
  if (previewText) {
    const preview = document.createElement("small");
    preview.className = "file-preview";
    preview.textContent = previewText;
    fileInfo.appendChild(preview);
  }
  wrap.appendChild(icon);
  wrap.appendChild(fileInfo);
  msg.appendChild(wrap);
  chatLog.appendChild(msg);
  autoScroll();
}

function showTypingIndicator() {
  const typing = document.createElement("div");
  typing.className = "msg rex typing";
  typing.id = "typing-indicator";
  typing.innerHTML = "<span></span><span></span><span></span>";
  chatLog.appendChild(typing);
  autoScroll();
}

function removeTypingIndicator() {
  const typing = document.getElementById("typing-indicator");
  if (typing) typing.remove();
}

function autoScroll() {
  setTimeout(() => {
    chatLog.scrollTop = chatLog.scrollHeight;
  }, 0);
}

// ============ Groq API ============
function getTodayPromptLine() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Today's actual date is ${today}. Your training data has an earlier cutoff, but do not assume it is currently that cutoff date, and do not tell the user you're "stuck" in an old year — today's real date is the one given here. You have real-time web search available — use it whenever a question depends on current information (news, prices, schedules, "latest" anything, or events after your training cutoff) rather than guessing from memory.\n\n`;
}

function getIdentityPromptLine() {
  const rexName = getRexName();
  const userName = getUserName();

  let line = `Your name is ${rexName}. You're a confident, easygoing AI assistant with a bit of personality — genuinely curious, a little playful, not stiff or corporate. Always refer to yourself as ${rexName}, never anything else.`;

  if (userName) {
    line += ` The user's name is ${userName} — you can address them by name occasionally when it feels natural, not in every message.`;
  }

  return line + "\n\n";
}

function addFailedReplyMessage() {
  if (!currentChatId) return;
  addMessageToChat(currentChatId, "rex", {
    type: "text",
    text: "⚠️ I didn't get a response back that time — mind trying again? If it keeps happening, starting a new chat sometimes helps.",
  });
}

async function callGroq(message, images = []) {
  if (!getApiKey()) {
    updateStatus("❌ Please set your API key in settings");
    settingsOverlay.classList.remove("hidden");
    return null;
  }

  // Build the envelope in the format the AI needs
  const userContent = [];

  if (images.length > 0) {
    images.forEach((src) => {
      userContent.push({ type: "image_url", image_url: { url: src } });
    });
  }

  const finalMessage = message && message.trim() !== "" ? message : "Describe this image.";
  userContent.push({ type: "text", text: finalMessage });

  // Include recent conversation history for context, plus this new turn
  const historyMessages = conversationHistory
    .filter((entry) => entry && entry.text && String(entry.text).trim() !== "")
    .map((entry) => ({
      role: entry.role,
      content: entry.text,
    }));

  const model = images.length > 0 ? GROQ_VISION_MODEL : GROQ_MODEL;

  // Only the vision model actually has a "thinking mode" that needs this —
  // groq/compound is a different (agentic) model family, and Groq's API
  // hard-rejects reasoning_format on model families that don't expect it,
  // so this must NOT be sent unconditionally on every request.
  const requestBody = { model };
  if (model === GROQ_VISION_MODEL) {
    requestBody.reasoning_format = "parsed";
  }
  requestBody.messages = [
    {
      role: "system",
      content:
        getIdentityPromptLine() +
        getTodayPromptLine() +
        (MODE_SYSTEM_PROMPTS[currentMode] || MODE_SYSTEM_PROMPTS.smart) +
        getMemoryPromptBlock(),
    },
    ...historyMessages,
    { role: "user", content: userContent },
  ];

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("API Error Details:", errorData);
      const apiMessage = errorData?.error?.message;
      throw new Error(apiMessage || `API Status: ${response.status}`);
    }

    const data = await response.json();
    const responseMessage = data?.choices?.[0]?.message;
    let content = responseMessage?.content;

    if (!content || !String(content).trim()) {
      throw new Error("Orex sent back an empty response");
    }

    // Reasoning can come back a few different ways depending on the model:
    // reasoning_content (parsed reasoning models), reasoning (groq/compound's
    // tool-use trace), or — if a model ignores reasoning_format — raw <think>
    // tags still embedded in content. Handle all three so nothing leaks
    // into the visible answer unfiltered.
    let thinking = responseMessage?.reasoning_content || responseMessage?.reasoning || "";

    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      thinking = (thinking ? thinking + "\n\n" : "") + thinkMatch[1].trim();
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    }

    if (!content) {
      throw new Error("Orex sent back an empty response");
    }

    return { content, thinking: thinking ? thinking.trim() : "" };
  } catch (error) {
    console.error("Groq API Error:", error);
    updateStatus("❌ Orex bonked his head (API Error)");
    return null;
  }
}

// ============ Storage ============
function loadMode() {
  const saved = localStorage.getItem("rexMode");
  currentMode = MODE_LABELS[saved] ? saved : "smart";
  applyModeToUI();
}

function applyModeToUI() {
  modeBtnLabel.textContent = MODE_LABELS[currentMode];
  modeMenu.querySelectorAll(".mode-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.mode === currentMode);
  });
}

function setMode(mode) {
  if (!MODE_LABELS[mode]) return;
  currentMode = mode;
  localStorage.setItem("rexMode", mode);
  applyModeToUI();
}

function closeModeMenu() {
  modeMenu.classList.add("hidden");
  modeBtn.classList.remove("open");
  modeBtn.setAttribute("aria-expanded", "false");
}

// ============ Memory ============
function isMemoryEnabled() {
  return localStorage.getItem(MEMORY_ENABLED_KEY) !== "off";
}

function setMemoryEnabled(enabled) {
  localStorage.setItem(MEMORY_ENABLED_KEY, enabled ? "on" : "off");
}

function loadMemoryFacts() {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    const facts = raw ? JSON.parse(raw) : [];
    return Array.isArray(facts) ? facts : [];
  } catch {
    return [];
  }
}

function saveMemoryFacts(facts) {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(facts));
  } catch (error) {
    console.warn("Could not save memory:", error);
  }
}

function mergeMemoryFacts(newFacts) {
  if (!newFacts || !newFacts.length) return;

  const existing = loadMemoryFacts();
  const existingLower = existing.map((f) => f.toLowerCase());

  newFacts.forEach((fact) => {
    const clean = String(fact).trim();
    if (!clean || clean.length > 200) return;
    const lower = clean.toLowerCase();
    const isDupe = existingLower.some(
      (e) => e === lower || e.includes(lower) || lower.includes(e)
    );
    if (!isDupe) {
      existing.push(clean);
      existingLower.push(lower);
    }
  });

  // Keep only the most recent facts if we're over the cap
  const trimmed = existing.slice(-MAX_MEMORY_FACTS);
  saveMemoryFacts(trimmed);
  renderMemoryList();
}

function renderMemoryList() {
  if (!memoryListEl) return;
  const facts = loadMemoryFacts();

  if (!facts.length) {
    memoryListEl.innerHTML = `<p class="memory-empty">Nothing yet — Orex will pick things up as you chat.</p>`;
    return;
  }

  memoryListEl.innerHTML = "";
  facts.forEach((fact, index) => {
    const item = document.createElement("div");
    item.className = "memory-fact";

    const text = document.createElement("span");
    text.textContent = fact;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "memory-fact-remove";
    removeBtn.title = "Forget this";
    removeBtn.setAttribute("aria-label", "Forget this");
    removeBtn.innerHTML = "✕";
    removeBtn.addEventListener("click", () => {
      const facts = loadMemoryFacts();
      facts.splice(index, 1);
      saveMemoryFacts(facts);
      renderMemoryList();
    });

    item.appendChild(text);
    item.appendChild(removeBtn);
    memoryListEl.appendChild(item);
  });
}

function migrateNameFactsOutOfMemory() {
  const facts = loadMemoryFacts();
  const nameRegex = /^(their|the user'?s?|user'?s?)?\s*name (is|'s)\s+(.+)$/i;
  const keep = [];
  let foundName = null;

  facts.forEach((fact) => {
    const match = fact.match(nameRegex);
    if (match) {
      if (!foundName) foundName = match[3].trim().replace(/[.!]+$/, "");
    } else {
      keep.push(fact);
    }
  });

  if (keep.length !== facts.length) {
    saveMemoryFacts(keep);
  }

  if (foundName && !getUserName()) {
    localStorage.setItem("userName", foundName.slice(0, 30));
    const userNameInput = document.getElementById("user-name");
    if (userNameInput) userNameInput.value = foundName.slice(0, 30);
  }
}

function getMemoryPromptBlock() {
  if (!isMemoryEnabled()) return "";
  const facts = loadMemoryFacts();
  if (!facts.length) return "";
  return `\n\nWhat you remember about this user from past conversations:\n${facts.map((f) => `- ${f}`).join("\n")}\n\nUse this naturally where it's relevant. Don't force it in or list it back to them unless asked.`;
}

async function extractMemoryFacts(userText, rexText) {
  if (!isMemoryEnabled() || !getApiKey() || !userText) return;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              'Extract memory info from this exchange for a long-term assistant. Respond with ONLY a JSON object, nothing else: {"name": "their name if they just told you it, or null", "facts": ["short factual strings about preferences, ongoing projects, recurring topics, goals, or similar stable details"]}. Do NOT put their name inside "facts" — the "name" field handles that separately. Ignore one-off questions, small talk, and anything trivial or likely to change. If nothing is worth remembering, use "facts": [].',
          },
          { role: "user", content: `User: ${userText}\nAssistant: ${rexText || ""}` },
        ],
      }),
    });

    if (!response.ok) return;
    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || "").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]);

    // Only adopt a detected name if the user hasn't already set one themselves —
    // Settings stays the single source of truth, memory just fills it in if empty.
    if (parsed.name && typeof parsed.name === "string" && !getUserName()) {
      const cleanName = parsed.name.trim().slice(0, 30);
      if (cleanName) {
        localStorage.setItem("userName", cleanName);
        const userNameInput = document.getElementById("user-name");
        if (userNameInput) userNameInput.value = cleanName;
        updateStatus(`🧠 Learned your name — saved to Settings`);
      }
    }

    if (Array.isArray(parsed.facts) && parsed.facts.length) {
      mergeMemoryFacts(parsed.facts);
    }
  } catch (error) {
    // Best-effort background task — fail silently so it never disrupts the chat.
  }
}

function loadSettings() {
  document.getElementById("rex-name").value = localStorage.getItem("rexName") || "Orex";
  document.getElementById("user-name").value = localStorage.getItem("userName") || "You";
  document.getElementById("api-key-input").value = localStorage.getItem("rexApiKey") || "";
  memoryEnabledCheckbox.checked = isMemoryEnabled();
}

function getApiKey() {
  return localStorage.getItem("rexApiKey") || "";
}

function getRexName() {
  return localStorage.getItem("rexName") || "Orex";
}

function getUserName() {
  return localStorage.getItem("userName") || "";
}

function applyRexNameToUI() {
  const name = getRexName();
  const headerTitle = document.getElementById("rex-header-title");
  const headerSubtitle = document.getElementById("rex-header-subtitle");
  if (headerTitle) headerTitle.textContent = `${name} Chat`;
  if (headerSubtitle) headerSubtitle.textContent = `Green Groq workspace`;
  document.title = `${name} Chat`;

  const avatar = document.getElementById("settings-avatar");
  const avatarName = document.getElementById("settings-avatar-name");
  if (avatar) avatar.textContent = name.charAt(0).toUpperCase() || "R";
  if (avatarName) avatarName.textContent = name;
}

function saveChats() {
  try {
    localStorage.setItem("rexChats", JSON.stringify(chats));
  } catch (e) {
    console.warn("Storage full! Images not saved to history.", e);
    // This prevents the "crash" while still allowing the app to keep working in memory
  }
}

function loadChats() {
  const saved = localStorage.getItem("rexChats");
  if (saved) {
    try {
      chats = JSON.parse(saved);
    } catch (e) {
      console.error("Error loading chats:", e);
      chats = [];
    }
  }
}

function rebuildConversationHistory() {
  conversationHistory = [];
  const chat = chats.find((c) => c.id === currentChatId);
  if (!chat) return;

  chat.messages.forEach((msg) => {
    const entry = buildConversationEntryFromMessage(msg);
    if (entry) conversationHistory.push(entry);
  });

  trimConversationHistory();
  updateMessageCount();
}

// ============ Utilities ============
function closeAttachMenu() {
  attachMenu.classList.add("hidden");
  attachBtn.classList.remove("open");
  attachBtn.setAttribute("aria-expanded", "false");
}

function updateMessageCount() {
  msgCount.textContent = conversationHistory.length;
}

function updateStatus(message) {
  statusBar.textContent = message;
  statusBar.style.opacity = "1";
}

function showConfirm(message, callback, confirmLabel = "Delete") {
  confirmMessage.textContent = message;
  confirmYes.textContent = confirmLabel;
  const isDanger = confirmLabel === "Delete" || confirmLabel === "Clear";
  confirmYes.classList.toggle("btn-danger", isDanger);
  confirmYes.classList.toggle("btn-primary", !isDanger);
  pendingConfirm = callback;
  confirmOverlay.classList.remove("hidden");
}

function setThemeIcon(isDark) {
  const moonSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  const sunSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  themeToggle.querySelector(".theme-icon").innerHTML = isDark ? moonSvg : sunSvg;
}

function trimConversationHistory() {
  if (conversationHistory.length > MAX_HISTORY) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY);
  }
}

function buildConversationEntryFromMessage(msg) {
  if (msg.type === "text") {
    return {
      role: msg.role === "user" ? "user" : "assistant",
      text: msg.text,
    };
  }

  if (msg.type === "file" && msg.extractedText) {
    return {
      role: "user",
      text: msg.extractedText,
    };
  }

  if (msg.type === "image") {
    // We don't resend the actual image bytes on later turns (that would
    // balloon every request's payload), but without this the model has zero
    // record an image was ever shared — leading to exactly the "I'm still
    // not able to see the picture" confusion on follow-up questions.
    return {
      role: "user",
      text: "[Shared an image in this conversation]",
    };
  }

  return null;
}

function getFileExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function getFileDescriptor(file) {
  const extension = getFileExtension(file.name);
  const mime = file.type.toLowerCase();

  if (JSON_EXTENSIONS.has(extension) || mime.includes("json")) {
    return { kind: "json", language: "json", categoryLabel: "JSON", readable: true };
  }

  if (CODE_LANGUAGE_MAP[extension]) {
    return {
      kind: "code",
      language: CODE_LANGUAGE_MAP[extension],
      categoryLabel: CODE_LANGUAGE_MAP[extension].toUpperCase(),
      readable: true,
    };
  }

  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) {
    return { kind: "text", language: "text", categoryLabel: "Text", readable: true };
  }

  return { kind: "binary", language: "", categoryLabel: "File", readable: false };
}

async function buildFileMessage(file) {
  const descriptor = getFileDescriptor(file);
  const fileMessage = {
    type: "file",
    name: file.name,
    url: URL.createObjectURL(file),
    size: file.size,
    fileCategory: descriptor.kind,
    categoryLabel: descriptor.categoryLabel,
  };

  if (!descriptor.readable) {
    return {
      ...fileMessage,
      contentStatus: "Download only",
    };
  }

  const rawText = (await file.text()).replace(/\r\n/g, "\n");
  if (!rawText.trim()) {
    return {
      ...fileMessage,
      language: descriptor.language,
      contentStatus: "Empty file",
    };
  }

  let preparedText = rawText;
  if (descriptor.kind === "json") {
    try {
      preparedText = JSON.stringify(JSON.parse(rawText), null, 2);
    } catch (error) {
      console.warn("Unable to pretty-print JSON file:", error);
    }
  }

  const isTruncated = preparedText.length > MAX_FILE_CONTENT_CHARS;
  const clippedText = preparedText.slice(0, MAX_FILE_CONTENT_CHARS);

  return {
    ...fileMessage,
    language: descriptor.language,
    isTruncated,
    previewText: clippedText.split("\n").slice(0, 2).join(" ").slice(0, 120),
    contentStatus: isTruncated
      ? `First ${MAX_FILE_CONTENT_CHARS.toLocaleString()} chars attached`
      : "Ready for analysis",
    extractedText: formatFileContext(file.name, descriptor, clippedText, isTruncated),
  };
}

function formatFileContext(name, descriptor, content, isTruncated) {
  const note = isTruncated
    ? `Only the first ${MAX_FILE_CONTENT_CHARS.toLocaleString()} characters are included below.`
    : "Use the full file contents below when answering.";

  if (descriptor.kind === "json" || descriptor.kind === "code") {
    return `[Uploaded ${descriptor.kind} file: ${name}]
${note}
\`\`\`${descriptor.language || "text"}
${content}
\`\`\``;
  }

  return `[Uploaded text file: ${name}]
${note}
${content}`;
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${Math.max(size / 1024, 0.01).toFixed(2)} KB`;
}

function isValidImageFile(file) {
  return file.type.startsWith("image/") && file.size < 10 * 1024 * 1024;
}

// ============ Quiz ============
async function handleStartQuiz() {
  const topic = quizTopicInput.value.trim();
  if (!topic) {
    quizTopicInput.focus();
    return;
  }

  quizOverlay.classList.add("hidden");

  if (!getApiKey()) {
    updateStatus("❌ Please set your API key in settings");
    settingsOverlay.classList.remove("hidden");
    return;
  }

  if (!currentChatId) return;

  const prompt = `Start a fun quiz about: "${topic}". Ask me one question at a time. Begin with question 1 now — make it multiple choice with 4 options (A, B, C, D). After I answer, tell me if I'm right or wrong (and why), then ask the next question. Let's start!`;

  addMessageToChat(currentChatId, "user", { type: "text", text: `📝 Start a quiz about: ${topic}` });

  isWaitingForResponse = true;
  sendButton.disabled = true;
  updateStatus("📝 Preparing quiz...");
  showTypingIndicator();

  const reply = await callGroq(prompt);
  removeTypingIndicator();

  if (reply) {
    addMessageToChat(currentChatId, "rex", { type: "text", text: reply.content, thinking: reply.thinking });
  } else {
    addFailedReplyMessage();
  }

  isWaitingForResponse = false;
  sendButton.disabled = false;
  updateStatus("✅ Ready");
  saveChats();
  userInput.focus();
}

// ============ Research URLs ============
const MAX_RESEARCH_URLS = 6;

function parseResearchUrls(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^https?:\/\//i.test(line))
    .slice(0, MAX_RESEARCH_URLS);
}

async function handleResearchUrls() {
  const urls = parseResearchUrls(researchUrlsInput.value);
  const focus = researchFocusInput.value.trim();

  if (!urls.length) {
    updateStatus("❌ Add at least one valid http(s) URL");
    researchUrlsInput.focus();
    return;
  }

  researchOverlay.classList.add("hidden");

  if (!getApiKey()) {
    updateStatus("❌ Please set your API key in settings");
    settingsOverlay.classList.remove("hidden");
    return;
  }

  if (!currentChatId) return;

  addMessageToChat(currentChatId, "user", {
    type: "text",
    text: `🔎 Research these URLs${focus ? ` (focus: ${focus})` : ""}:\n${urls.join("\n")}`,
  });

  isWaitingForResponse = true;
  sendButton.disabled = true;
  updateStatus("🔎 Visiting pages...");
  showTypingIndicator();

  let prompt = `Visit the following website${urls.length > 1 ? "s" : ""} and write a clear, well-structured research summary`;
  prompt += focus ? ` focused on: "${focus}".` : ".";
  prompt += ` Cite which URL each point came from. If a page can't be reached, say so plainly rather than guessing at its contents.\n\n`;
  urls.forEach((url) => {
    prompt += `- ${url}\n`;
  });

  const reply = await callGroq(prompt);
  removeTypingIndicator();

  if (reply) {
    addMessageToChat(currentChatId, "rex", { type: "text", text: reply.content, thinking: reply.thinking });
  } else {
    addFailedReplyMessage();
  }

  isWaitingForResponse = false;
  sendButton.disabled = false;
  updateStatus("✅ Ready");
  saveChats();
  userInput.focus();
}

// ============ Wikipedia Lookup ============
async function fetchWikipediaSummary(topic) {
  const title = encodeURIComponent(topic.trim().replace(/\s+/g, "_"));

  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);

    if (response.ok) {
      const data = await response.json();
      if (data.type !== "disambiguation") {
        return { ok: true, title: data.title, extract: data.extract, url: data.content_urls?.desktop?.page };
      }
    }

    // Not found directly, or a disambiguation page — search for the closest real match.
    const searchResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=1&namespace=0&format=json&origin=*`
    );
    if (!searchResponse.ok) throw new Error(`Search failed (HTTP ${searchResponse.status})`);
    const [, titles] = await searchResponse.json();

    if (!titles || !titles.length) {
      return { ok: false, error: `No Wikipedia article found for "${topic}"` };
    }

    const matchTitle = encodeURIComponent(titles[0].replace(/\s+/g, "_"));
    const matchResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${matchTitle}`);
    if (!matchResponse.ok) throw new Error(`HTTP ${matchResponse.status}`);
    const matchData = await matchResponse.json();

    return {
      ok: true,
      title: matchData.title,
      extract: matchData.extract,
      url: matchData.content_urls?.desktop?.page,
    };
  } catch (error) {
    return { ok: false, error: error.message || "Wikipedia lookup failed" };
  }
}

async function handleWikiLookup() {
  const topic = wikiTopicInput.value.trim();
  if (!topic) {
    updateStatus("❌ Enter a topic to look up");
    wikiTopicInput.focus();
    return;
  }

  wikiOverlay.classList.add("hidden");

  if (!getApiKey()) {
    updateStatus("❌ Please set your API key in settings");
    settingsOverlay.classList.remove("hidden");
    return;
  }

  if (!currentChatId) return;

  addMessageToChat(currentChatId, "user", { type: "text", text: `🌐 Look up "${topic}" on Wikipedia` });

  isWaitingForResponse = true;
  sendButton.disabled = true;
  updateStatus("🌐 Checking Wikipedia...");
  showTypingIndicator();

  const result = await fetchWikipediaSummary(topic);

  let prompt;
  if (result.ok) {
    prompt = `Here is the real Wikipedia summary for "${result.title}":\n\n${result.extract}\n\nSource: ${result.url}\n\nUsing this, give a clear, well-organized explanation of "${topic}" in your own words. Mention it's sourced from Wikipedia and include the link at the end.`;
  } else {
    prompt = `I tried to look up "${topic}" on Wikipedia but couldn't find or fetch it (${result.error}). Let the user know Wikipedia didn't have a match, and answer from your own knowledge instead if you can, being clear that it's not sourced from Wikipedia this time.`;
  }

  updateStatus("🤔 Thinking...");
  const reply = await callGroq(prompt);
  removeTypingIndicator();

  if (reply) {
    addMessageToChat(currentChatId, "rex", { type: "text", text: reply.content, thinking: reply.thinking });
  } else {
    addFailedReplyMessage();
  }

  isWaitingForResponse = false;
  sendButton.disabled = false;
  updateStatus("✅ Ready");
  saveChats();
  userInput.focus();
}

// ============ Dictionary Lookup ============
async function fetchDictionaryOnce(cleanWord, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, notFound: true, error: `No dictionary entry found for "${cleanWord}"` };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const entry = data[0];
    if (!entry) return { ok: false, notFound: true, error: `No dictionary entry found for "${cleanWord}"` };

    const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || "";
    const meaningsText = (entry.meanings || [])
      .map((m) => {
        const defs = (m.definitions || [])
          .slice(0, 3)
          .map((d, i) => `${i + 1}. ${d.definition}${d.example ? ` (e.g., "${d.example}")` : ""}`)
          .join("\n");
        return `${m.partOfSpeech}:\n${defs}`;
      })
      .join("\n\n");

    return { ok: true, word: entry.word, phonetic, meaningsText };
  } catch (error) {
    clearTimeout(timeout);
    const message = error.name === "AbortError" ? "Request timed out" : error.message || "Dictionary lookup failed";
    return { ok: false, notFound: false, error: message };
  }
}

async function fetchDictionaryDefinition(word) {
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord) return { ok: false, error: "No word given" };

  let result = await fetchDictionaryOnce(cleanWord);

  // The free dictionary API runs on a server that can go idle and "cold start"
  // slowly or flake on the first request after waking up. Retry once before
  // giving up — but don't bother retrying a genuine "word not found".
  if (!result.ok && !result.notFound) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    result = await fetchDictionaryOnce(cleanWord);
  }

  if (!result.ok) {
    console.warn(`Dictionary lookup failed for "${word}":`, result.error);
  }

  return result;
}

async function handleDictLookup() {
  const word = dictWordInput.value.trim();
  if (!word) {
    updateStatus("❌ Enter a word to look up");
    dictWordInput.focus();
    return;
  }

  dictOverlay.classList.add("hidden");

  if (!getApiKey()) {
    updateStatus("❌ Please set your API key in settings");
    settingsOverlay.classList.remove("hidden");
    return;
  }

  if (!currentChatId) return;

  addMessageToChat(currentChatId, "user", { type: "text", text: `📖 Look up "${word}" in the dictionary` });

  isWaitingForResponse = true;
  sendButton.disabled = true;
  updateStatus("📖 Checking the dictionary...");
  showTypingIndicator();

  const result = await fetchDictionaryDefinition(word);

  let prompt;
  if (result.ok) {
    prompt = `Here is the real dictionary entry for "${result.word}"${result.phonetic ? ` (${result.phonetic})` : ""}:\n\n${result.meaningsText}\n\nPresent this clearly for the user — part of speech, definitions, and an example if one's given. Don't invent anything beyond what's here.`;
  } else {
    prompt = `I tried to look up "${word}" in the dictionary but couldn't find an entry (${result.error}). Let the user know, and offer your best guess at its meaning from your own knowledge if you recognize the word, being clear it's not from a dictionary source this time.`;
  }

  updateStatus("🤔 Thinking...");
  const reply = await callGroq(prompt);
  removeTypingIndicator();

  if (reply) {
    addMessageToChat(currentChatId, "rex", { type: "text", text: reply.content, thinking: reply.thinking });
  } else {
    addFailedReplyMessage();
  }

  isWaitingForResponse = false;
  sendButton.disabled = false;
  updateStatus("✅ Ready");
  saveChats();
  userInput.focus();
}

// ============ Start App ============
init();