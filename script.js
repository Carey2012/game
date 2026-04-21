(function(){
    'use strict';

    // 配置 marked 并集成 highlight.js（可选）
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
    const nameInput = document.getElementById('configName');
    const modelInput = document.getElementById('modelName');
    const keyInput = document.getElementById('apiKey');
    const proxyInput = document.getElementById('proxyUrl');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusDiv = document.getElementById('status');

    const STORAGE_KEY_CONFIG = 'ai_config_v1';
    const STORAGE_KEY_HISTORY = 'ai_chat_history_v1';  // 新增：对话历史存储键

    // ---------- 对话历史保存与加载 ----------
    function saveChatHistory() {
        const messages = [];
        // 遍历 chatMessages 中的所有消息元素
        for (const msgEl of chatMessages.children) {
            // 跳过加载中的临时消息
            if (msgEl.textContent === '⏳ 思考中...') continue;
            
            const role = Array.from(msgEl.classList).find(c => 
                c === 'user' || c === 'assistant' || c === 'system'
            );
            if (!role) continue;
            
            // 对于助手消息，我们保存原始 Markdown 文本（需要额外存储）
            // 简单做法：直接从元素的 dataset 中读取原始内容
            const content = msgEl.dataset.rawContent || msgEl.textContent;
            messages.push({ role, content });
        }
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages));
    }

    function loadChatHistory() {
        const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (!saved) return;
        
        try {
            const messages = JSON.parse(saved);
            // 清空当前显示（但保留可能的系统欢迎语？这里我们完全替换）
            chatMessages.innerHTML = '';
            for (const msg of messages) {
                // 使用 addMessage 来渲染，但要避免重复保存触发递归
                _addMessageInternal(msg.role, msg.content);
            }
        } catch (e) {
            console.warn('加载对话历史失败', e);
        }
    }

    // 内部渲染方法（不触发保存，避免死循环）
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
        
        // 将原始内容存入 dataset，方便后续保存
        msgDiv.dataset.rawContent = content;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 对外暴露的添加消息方法（会触发保存）
    function addMessage(role, content) {
        _addMessageInternal(role, content);
        saveChatHistory();  // 每次添加后保存
    }

    // 清空对话历史
    function clearChatHistory() {
        chatMessages.innerHTML = '';
        // 可选：加回一条系统提示
        const sysMsg = document.createElement('div');
        sysMsg.className = 'message system';
        sysMsg.textContent = '对话已清空。';
        sysMsg.dataset.rawContent = '对话已清空。';
        chatMessages.appendChild(sysMsg);
        saveChatHistory();
    }

    // ---------- 原有功能（略作调整）----------
    function setStatus(text, isError = false) {
        statusDiv.textContent = text;
        statusDiv.style.color = isError ? '#dc2626' : '#64748b';
        if (!isError) {
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }
    }

    function saveConfig() {
        const config = {
            name: nameInput.value.trim(),
            model: modelInput.value.trim(),
            key: keyInput.value.trim(),
            proxyUrl: proxyInput.value.trim()
        };

        if (!config.key || !config.proxyUrl || !config.model) {
            alert('请至少填写模型、API Key 和代理地址');
            return false;
        }

        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
        setStatus('✓ 配置已保存');
        return true;
    }

    function loadConfigToForm() {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (!saved) {
            alert('没有已保存的配置');
            return;
        }
        try {
            const config = JSON.parse(saved);
            nameInput.value = config.name || '';
            modelInput.value = config.model || '';
            keyInput.value = config.key || '';
            proxyInput.value = config.proxyUrl || '';
            setStatus('✓ 配置已加载');
        } catch (e) {
            alert('配置数据损坏');
        }
    }

    async function sendMessage() {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (!saved) {
            alert('请先在左侧保存 API 配置');
            return;
        }

        const config = JSON.parse(saved);
        const message = userInput.value.trim();
        if (!message) return;

        // 显示用户消息
        addMessage('user', message);
        userInput.value = '';
        
        // 显示临时加载消息
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'message assistant';
        loadingMsg.textContent = '⏳ 思考中...';
        chatMessages.appendChild(loadingMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        setStatus('请求中...');

        const requestBody = {
            model: config.model,
            messages: [{ role: 'user', content: message }],
            stream: false,
            temperature: 0.7
        };

        try {
            const response = await fetch(config.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.key}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();
            
            // 移除加载消息
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

    // 绑定事件
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('loadConfigBtn').addEventListener('click', loadConfigToForm);
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 可选：添加清空对话按钮（需要在 HTML 中添加对应按钮）
    document.getElementById('clearChatBtn')?.addEventListener('click', clearChatHistory);

    // 初始化
    (function init() {
        // 加载配置预填
        const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                nameInput.value = config.name || '';
                modelInput.value = config.model || '';
                proxyInput.value = config.proxyUrl || '';
                setStatus('ℹ️ 检测到已保存配置，点击“加载”填入 API Key', false);
            } catch (e) {}
        }

        // 加载对话历史
        loadChatHistory();
        
        // 如果没有任何消息，显示一条默认欢迎语
        if (chatMessages.children.length === 0) {
            const sysMsg = document.createElement('div');
            sysMsg.className = 'message system';
            sysMsg.textContent = '在左侧填写 API 配置并保存，然后开始对话。';
            sysMsg.dataset.rawContent = '在左侧填写 API 配置并保存，然后开始对话。';
            chatMessages.appendChild(sysMsg);
        }
    })();

})();