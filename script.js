(function(){
    'use strict';

    // DOM 元素
    const nameInput = document.getElementById('configName');
    const modelInput = document.getElementById('modelName');
    const keyInput = document.getElementById('apiKey');
    const proxyInput = document.getElementById('proxyUrl');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusDiv = document.getElementById('status');

    const STORAGE_KEY = 'ai_config_v1';

    // ---------- 辅助函数：显示消息 ----------
    function addMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.textContent = content;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function setStatus(text, isError = false) {
        statusDiv.textContent = text;
        statusDiv.style.color = isError ? '#dc2626' : '#64748b';
        if (!isError) {
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }
    }

    // ---------- 保存配置 ----------
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

        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        setStatus('✓ 配置已保存');
        return true;
    }

    // ---------- 加载配置到表单 ----------
    function loadConfigToForm() {
        const saved = localStorage.getItem(STORAGE_KEY);
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

    // ---------- 发送对话请求 ----------
    async function sendMessage() {
        const saved = localStorage.getItem(STORAGE_KEY);
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

            // 解析常见响应格式
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

    // ---------- 绑定事件 ----------
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('loadConfigBtn').addEventListener('click', loadConfigToForm);
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ---------- 初始化：如果有保存的配置，静默填充非敏感字段（不填key）----------
    (function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const config = JSON.parse(saved);
                nameInput.value = config.name || '';
                modelInput.value = config.model || '';
                proxyInput.value = config.proxyUrl || '';
                // key 留空，用户需手动加载或输入
                setStatus('ℹ️ 检测到已保存配置，点击“加载”填入 API Key', false);
            } catch (e) {}
        }
    })();

})();