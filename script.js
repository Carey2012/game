(function(){
    'use strict';

    // 配置 marked
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
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

    // 存储键
    const STORAGE_CONFIGS = 'ai_configs_list_v1';    // 配置数组
    const STORAGE_ACTIVE_ID = 'ai_active_config_id_v1';
    const STORAGE_HISTORY = 'ai_chat_history_v1';

    // 状态
    let configs = [];                // 所有配置 { id, name, model, key, proxyUrl }
    let activeConfigId = null;

    // ---------- 配置管理 ----------
    function loadConfigs() {
        const saved = localStorage.getItem(STORAGE_CONFIGS);
        if (saved) {
            try {
                configs = JSON.parse(saved);
            } catch (e) {
                configs = [];
            }
        }
        // 确保每个配置都有 id（兼容旧数据）
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

    // 渲染配置列表
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
            if (cfg.id === activeConfigId) {
                li.classList.add('active');
            }

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
            
            li.addEventListener('click', () => {
                setActiveConfig(cfg.id);
            });
            
            configListEl.appendChild(li);
        });
    }

    // 简易转义防止 XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 切换到指定配置
    function setActiveConfig(id) {
        activeConfigId = id;
        saveActiveId();
        renderConfigList();
        
        // 将激活配置填入表单
        const activeCfg = configs.find(c => c.id === id);
        if (activeCfg) {
            nameInput.value = activeCfg.name || '';
            modelInput.value = activeCfg.model || '';
            keyInput.value = activeCfg.key || '';
            proxyInput.value = activeCfg.proxyUrl || '';
            setStatus(`已切换到配置: ${activeCfg.name || '未命名'}`, false);
        }
    }

    // 删除配置
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
                nameInput.value = '';
                modelInput.value = '';
                keyInput.value = '';
                proxyInput.value = '';
            }
        }
        
        renderConfigList();
        setStatus('配置已删除', false);
    }

    // 新增配置
    function addNewConfig() {
        const name = nameInput.value.trim();
        const model = modelInput.value.trim();
        const key = keyInput.value.trim();
        const proxyUrl = proxyInput.value.trim();
        
        if (!name || !model || !key || !proxyUrl) {
            alert('请完整填写所有字段');
            return false;
        }
        
        const newConfig = {
            id: Date.now() + Math.random().toString(36),
            name, model, key, proxyUrl
        };
        
        configs.push(newConfig);
        saveConfigsToStorage();
        
        setActiveConfig(newConfig.id);
        renderConfigList();
        setStatus(`配置“${name}”已新增并激活`, false);
        return true;
    }

    // 更新当前配置
    function updateCurrentConfig() {
        if (!activeConfigId) {
            alert('没有激活的配置');
            return;
        }
        
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
        
        configs[index] = {
            ...configs[index],
            name, model, key, proxyUrl
        };
        
        saveConfigsToStorage();
        renderConfigList();
        setStatus(`配置“${name}”已更新`, false);
    }

    // ---------- 对话历史 ----------
    function saveChatHistory() {
        const messages = [];
        for (const msgEl of chatMessages.children) {
            if (msgEl.textContent === '⏳ 思考中...') continue;
            const role = Array.from(msgEl.classList).find(c => 
                c === 'user' || c === 'assistant' || c === 'system'
            );
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
            for (const msg of messages) {
                _addMessageInternal(msg.role, msg.content);
            }
        } catch (e) {}
    }

    function clearChatHistory() {
        chatMessages.innerHTML = '';
        const sysMsg = document.createElement('div');
        sysMsg.className = 'message system';
        sysMsg.textContent = '对话已清空。';
        sysMsg.dataset.rawContent = '对话已清空。';
        chatMessages.appendChild(sysMsg);
        saveChatHistory();
    }

    // ---------- 状态提示 ----------
    function setStatus(text, isError = false) {
        statusDiv.textContent = text;
        statusDiv.style.color = isError ? '#dc2626' : '#64748b';
        if (!isError) {
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }
    }

    // ---------- 发送请求 ----------
    async function sendMessage() {
        if (!activeConfigId) {
            alert('请先选择或新增一个配置');
            return;
        }
        
        const activeCfg = configs.find(c => c.id === activeConfigId);
        if (!activeCfg) {
            alert('配置不存在');
            return;
        }
        
        const message = userInput.value.trim();
        if (!message) return;

        addMessage('user', message);
        userInput.value = '';
        
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'message assistant';
        loadingMsg.textContent = '⏳ 思考中...';
        chatMessages.appendChild(loadingMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        setStatus('请求中...');

        const requestBody = {
            model: activeCfg.model,
            messages: [{ role: 'user', content: message }],
            stream: false,
            temperature: 0.7
        };

        try {
            const response = await fetch(activeCfg.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeCfg.key}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();
            loadingMsg.remove();

            let reply = '无法解析响应内容';
            if (data.choices?.[0]?.message?.content) {
                reply = data.choices[0].message.content;
            } else if (data.content) {
                reply = data.content;
            } else if (data.reply) {
                reply = data.reply;
            } else if (data.message) {
                reply = data.message;
            } else {
                reply = JSON.stringify(data);
            }

            addMessage('assistant', reply);
            setStatus('✓ 请求成功');

        } catch (error) {
            loadingMsg.remove();
            addMessage('system', `❌ 请求失败：${error.message}`);
            setStatus(`✗ ${error.message}`, true);
            console.error('API Error:', error);
        }
    }

    // ---------- 初始化 ----------
    function init() {
        loadConfigs();
        loadActiveId();
        
        // 渲染列表
        renderConfigList();
        
        // 如果有激活配置，填充表单
        if (activeConfigId) {
            const activeCfg = configs.find(c => c.id === activeConfigId);
            if (activeCfg) {
                nameInput.value = activeCfg.name || '';
                modelInput.value = activeCfg.model || '';
                keyInput.value = activeCfg.key || '';
                proxyInput.value = activeCfg.proxyUrl || '';
            }
        }
        
        // 加载对话历史
        loadChatHistory();
        if (chatMessages.children.length === 0) {
            const sysMsg = document.createElement('div');
            sysMsg.className = 'message system';
            sysMsg.textContent = '在左侧选择或新增 API 配置，然后开始对话。';
            sysMsg.dataset.rawContent = sysMsg.textContent;
            chatMessages.appendChild(sysMsg);
        }
    }

    // 事件绑定
    document.getElementById('saveNewConfigBtn').addEventListener('click', addNewConfig);
    document.getElementById('updateConfigBtn').addEventListener('click', updateCurrentConfig);
    document.getElementById('clearChatBtn').addEventListener('click', clearChatHistory);
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    init();
})();