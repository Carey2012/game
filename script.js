(function(){
    'use strict';

    // ---------- 配置 marked（安全 + 标准换行）----------
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            gfm: true,
            sanitize: true,
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {}
                }
                return code;
            }
        });
    }

    // DOM 元素
    const configListEl = document.getElementById('configList');
    const noConfigMsg = document.getElementById('noConfigMsg');
    const nameInput = document.getElementById('configName');
    const modelInput = document.getElementById('modelName');
    const keyInput = document.getElementById('apiKey');
    const proxyInput = document.getElementById('proxyUrl');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusDiv = document.getElementById('status');
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    // 存储键
    const STORAGE_CONFIGS = 'ai_configs_list_v1';
    const STORAGE_ACTIVE_ID = 'ai_active_config_id_v1';
    const STORAGE_HISTORY = 'ai_chat_history_v1';
    const THEME_STORAGE_KEY = 'app_theme_preference';

    // 状态
    let configs = [];
    let activeConfigId = null;

    // ---------- 主题切换 ----------
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if (themeToggleBtn) themeToggleBtn.innerHTML = '☀️ 浅色';
        } else {
            document.body.classList.remove('dark-theme');
            if (themeToggleBtn) themeToggleBtn.innerHTML = '🌙 深色';
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.contains('dark-theme');
        const newTheme = isDark ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
    }

    // ---------- 配置管理（代码不变） ----------
    function loadConfigs() {
        const saved = localStorage.getItem(STORAGE_CONFIGS);
        if (saved) {
            try { configs = JSON.parse(saved); } catch (e) { configs = []; }
        }
        configs = configs.map(cfg => {
            if (!cfg.id) cfg.id = Date.now() + Math.random().toString(36);
            return cfg;
        });
    }

    function saveConfigsToStorage() {
        localStorage.setItem(STORAGE_CONFIGS, JSON.stringify(configs));
    }

    function loadActiveId() {
        const savedId = localStorage.getItem(STORAGE_ACTIVE_ID);
        if (savedId && configs.some(c => c.id === savedId)) {
            activeConfigId = savedId;
        } else if (configs.length > 0) {
            activeConfigId = configs[0].id;
        } else {
            activeConfigId = null;
        }
    }

    function saveActiveId() {
        if (activeConfigId) {
            localStorage.setItem(STORAGE_ACTIVE_ID, activeConfigId);
        } else {
            localStorage.removeItem(STORAGE_ACTIVE_ID);
        }
    }

    function renderConfigList() {
        configListEl.innerHTML = '';
        if (configs.length === 0) {
            noConfigMsg.style.display = 'block';
            return;
        }
        noConfigMsg.style.display = 'none';
        
        configs.forEach(cfg => {
            const li = document.createElement('li');
            li.dataset.id = cfg.id;
            if (cfg.id === activeConfigId) li.classList.add('active');

            const infoSpan = document.createElement('span');
            infoSpan.innerHTML = `<span class="config-name">${escapeHtml(cfg.name || '未命名')}</span><span class="config-model">${escapeHtml(cfg.model || '')}</span>`;
            
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-config-btn';
            delBtn.innerHTML = '✕';
            delBtn.title = '删除配置';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteConfig(cfg.id);
            });

            li.appendChild(infoSpan);
            li.appendChild(delBtn);
            li.addEventListener('click', () => setActiveConfig(cfg.id));
            configListEl.appendChild(li);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function setActiveConfig(id) {
        activeConfigId = id;
        saveActiveId();
        renderConfigList();
        const activeCfg = configs.find(c => c.id === id);
        if (activeCfg) {
            nameInput.value = activeCfg.name || '';
            modelInput.value = activeCfg.model || '';
            keyInput.value = activeCfg.key || '';
            proxyInput.value = activeCfg.proxyUrl || '';
            setStatus(`已切换到: ${activeCfg.name || '未命名'}`, false);
        }
    }

    function deleteConfig(id) {
        if (!confirm('确定删除此配置吗？')) return;
        configs = configs.filter(c => c.id !== id);
        saveConfigsToStorage();
        if (activeConfigId === id) {
            if (configs.length > 0) {
                setActiveConfig(configs[0].id);
            } else {
                activeConfigId = null;
                saveActiveId();
                nameInput.value = modelInput.value = keyInput.value = proxyInput.value = '';
            }
        }
        renderConfigList();
        setStatus('配置已删除', false);
    }

    function addNewConfig() {
        const name = nameInput.value.trim();
        const model = modelInput.value.trim();
        const key = keyInput.value.trim();
        const proxyUrl = proxyInput.value.trim();
        if (!name || !model || !key || !proxyUrl) {
            alert('请完整填写所有字段');
            return false;
        }
        const newConfig = { id: Date.now() + Math.random().toString(36), name, model, key, proxyUrl };
        configs.push(newConfig);
        saveConfigsToStorage();
        setActiveConfig(newConfig.id);
        renderConfigList();
        setStatus(`配置“${name}”已新增并激活`, false);
        return true;
    }

    function updateCurrentConfig() {
        if (!activeConfigId) { alert('没有激活的配置'); return; }
        const name = nameInput.value.trim();
        const model = modelInput.value.trim();
        const key = keyInput.value.trim();
        const proxyUrl = proxyInput.value.trim();
        if (!name || !model || !key || !proxyUrl) {
            alert('请完整填写所有字段');
            return;
        }
        const index = configs.findIndex(c => c.id === activeConfigId);
        if (index === -1) return;
        configs[index] = { ...configs[index], name, model, key, proxyUrl };
        saveConfigsToStorage();
        renderConfigList();
        setStatus(`配置“${name}”已更新`, false);
    }

    // ---------- 对话历史 ----------
    function saveChatHistory() {
        const messages = [];
        for (const msgEl of chatMessages.children) {
            if (msgEl.textContent === '⏳ 思考中...') continue;
            const role = Array.from(msgEl.classList).find(c => c === 'user' || c === 'assistant' || c === 'system');
            if (!role) continue;
            const content = msgEl.dataset.rawContent || msgEl.textContent;
            messages.push({ role, content });
        }
        localStorage.setItem(STORAGE_HISTORY, JSON.stringify(messages));
    }

    function _addMessageInternal(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        if (role === 'assistant' && typeof marked !== 'undefined') {
            try {
                msgDiv.innerHTML = marked.parse(content);
            } catch (e) {
                msgDiv.textContent = content;
            }
        } else {
            msgDiv.textContent = content;
        }
        msgDiv.dataset.rawContent = content;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessage(role, content) {
        _addMessageInternal(role, content);
        saveChatHistory();
    }

    function loadChatHistory() {
        const saved = localStorage.getItem(STORAGE_HISTORY);
        if (!saved) return;
        try {
            const messages = JSON.parse(saved);
            chatMessages.innerHTML = '';
            for (const msg of messages) _addMessageInternal(msg.role, msg.content);
        } catch (e) {}
    }

    function clearChatHistory() {
        chatMessages.innerHTML = '';
        const sysMsg = document.createElement('div');
        sysMsg.className = 'message system';
        sysMsg.textContent = '对话已清空。';
        sysMsg.dataset.rawContent = sysMsg.textContent;
        chatMessages.appendChild(sysMsg);
        saveChatHistory();
    }

    // ---------- 状态提示 ----------
    function setStatus(text, isError = false) {
        statusDiv.textContent = text;
        const style = getComputedStyle(document.body);
        const mutedColor = style.getPropertyValue('--text-muted').trim() || '#64748b';
        statusDiv.style.color = isError ? '#dc2626' : mutedColor;
        if (!isError) setTimeout(() => statusDiv.textContent = '', 3000);
    }

    // ---------- 网络搜索函数 ----------
    async function searchWeb(query) {
        try {
            const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
            if (!res.ok) return '';
            const data = await res.json();
            let context = '';
            if (data.Abstract) context += data.Abstract + '\n';
            if (data.AbstractText) context += data.AbstractText + '\n';
            if (data.AbstractURL) context += `来源: ${data.AbstractURL}\n`;
            if (data.RelatedTopics) {
                data.RelatedTopics.slice(0, 3).forEach(topic => {
                    if (topic.Text) context += topic.Text + '\n';
                });
            }
            return context.trim();
        } catch (e) {
            console.warn('搜索失败：', e);
            return '';
        }
    }

    // ---------- 发送消息（支持工具调用）----------
    async function sendMessage() {
        if (!activeConfigId) { alert('请先选择或新增一个配置'); return; }
        const activeCfg = configs.find(c => c.id === activeConfigId);
        if (!activeCfg) { alert('配置不存在'); return; }
        const message = userInput.value.trim();
        if (!message) return;

        addMessage('user', message);
        userInput.value = '';

        // 助手消息占位
        const assistantMsgDiv = document.createElement('div');
        assistantMsgDiv.className = 'message assistant';
        assistantMsgDiv.textContent = '⏳ 思考中...';
        chatMessages.appendChild(assistantMsgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        setStatus('请求中...');

        // 构建带工具定义的请求体
        const tools = [
            {
                type: "function",
                function: {
                    name: "search_web",
                    description: "当需要实时信息、最新动态或未知知识时，调用此工具搜索互联网。参数 query 为搜索关键词。",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "搜索关键词" }
                        },
                        required: ["query"]
                    }
                }
            }
        ];

        const initialBody = {
            model: activeCfg.model,
            messages: [{ role: 'user', content: message }],
            tools: tools,
            tool_choice: "auto",
            stream: false,   // 工具调用阶段使用非流式，便于解析
            temperature: 0.7
        };

        try {
            let response = await fetch(activeCfg.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeCfg.key}`
                },
                body: JSON.stringify(initialBody)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

            let data = await response.json();
            let chosenTool = data.choices?.[0]?.message?.tool_calls?.[0];
            
            // 如果模型请求调用搜索工具
            if (chosenTool && chosenTool.function.name === 'search_web') {
                const args = JSON.parse(chosenTool.function.arguments);
                const query = args.query;
                assistantMsgDiv.textContent = '🔍 正在搜索：' + query;
                setStatus('正在搜索...');
                
                const searchResult = await searchWeb(query);
                
                // 构建历史消息：包含用户的原始问题、模型的工具调用请求、搜索结果
                const messages = [
                    { role: 'user', content: message },
                    { role: 'assistant', content: null, tool_calls: [chosenTool] },
                    { role: 'tool', tool_call_id: chosenTool.id, content: searchResult || '无结果' }
                ];

                // 第二次请求：基于搜索结果生成最终答案，使用流式
                const finalBody = {
                    model: activeCfg.model,
                    messages: messages,
                    stream: true,
                    temperature: 0.7
                };

                assistantMsgDiv.textContent = ''; // 清空搜索状态
                setStatus('正在生成回复...');
                
                const streamResponse = await fetch(activeCfg.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${activeCfg.key}`
                    },
                    body: JSON.stringify(finalBody)
                });

                if (!streamResponse.ok) throw new Error(`HTTP ${streamResponse.status}: ${await streamResponse.text()}`);
                
                await handleStreamResponse(streamResponse, assistantMsgDiv);
            } else {
                // 模型直接回答（无工具调用），使用流式重新发起请求以获得打字机效果
                // 注意：第一次请求是非流式的，所以这里我们用同样的消息再发一次流式请求
                const streamBody = {
                    model: activeCfg.model,
                    messages: [{ role: 'user', content: message }],
                    stream: true,
                    temperature: 0.7
                };
                assistantMsgDiv.textContent = '';
                const streamResponse = await fetch(activeCfg.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${activeCfg.key}`
                    },
                    body: JSON.stringify(streamBody)
                });
                if (!streamResponse.ok) throw new Error(`HTTP ${streamResponse.status}: ${await streamResponse.text()}`);
                await handleStreamResponse(streamResponse, assistantMsgDiv);
            }

            // 保存原始 Markdown 并渲染
            const rawContent = assistantMsgDiv.dataset.rawContent || assistantMsgDiv.textContent;
            assistantMsgDiv.dataset.rawContent = rawContent;
            if (typeof marked !== 'undefined') {
                try {
                    assistantMsgDiv.innerHTML = marked.parse(rawContent);
                } catch (e) {
                    assistantMsgDiv.textContent = rawContent;
                }
            }
            saveChatHistory();
            setStatus('✓ 请求成功');

        } catch (error) {
            assistantMsgDiv.remove();
            addMessage('system', `❌ 请求失败：${error.message}`);
            setStatus(`✗ ${error.message}`, true);
            console.error('API Error:', error);
        }
    }

    // ---------- 流式响应处理 ----------
    async function handleStreamResponse(response, msgElement) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        msgElement.textContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') continue;
                    try {
                        const json = JSON.parse(dataStr);
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta) {
                            fullText += delta;
                            msgElement.textContent = fullText;
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
        }
        msgElement.dataset.rawContent = fullText;
    }

    // ---------- 提取回复（降级用，此版本未使用）----------
    function extractReplyContent(data) {
        if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
        if (data.content) return data.content;
        if (data.reply) return data.reply;
        if (data.message) return data.message;
        return JSON.stringify(data);
    }

    // ---------- 初始化 ----------
    function init() {
        loadTheme();
        loadConfigs();
        loadActiveId();
        renderConfigList();
        if (activeConfigId) {
            const activeCfg = configs.find(c => c.id === activeConfigId);
            if (activeCfg) {
                nameInput.value = activeCfg.name || '';
                modelInput.value = activeCfg.model || '';
                keyInput.value = activeCfg.key || '';
                proxyInput.value = activeCfg.proxyUrl || '';
            }
        }
        loadChatHistory();
        if (chatMessages.children.length === 0) {
            const sysMsg = document.createElement('div');
            sysMsg.className = 'message system';
            sysMsg.textContent = '在左侧选择或新增 API 配置，然后开始对话。AI 会在需要时自动搜索网络。';
            sysMsg.dataset.rawContent = sysMsg.textContent;
            chatMessages.appendChild(sysMsg);
        }
    }

    // 事件绑定
    document.getElementById('saveNewConfigBtn').addEventListener('click', addNewConfig);
    document.getElementById('updateConfigBtn').addEventListener('click', updateCurrentConfig);
    document.getElementById('clearChatBtn').addEventListener('click', clearChatHistory);
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    init();
})();