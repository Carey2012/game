(function() {
    'use strict';

    // DOM 元素
    const nameInput = document.getElementById('configName');
    const modelInput = document.getElementById('modelName');
    const keyInput = document.getElementById('apiKey');
    const proxyInput = document.getElementById('proxyUrl');
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('userInput');
    const statusSpan = document.getElementById('status');

    const STORAGE_KEY = 'user_ai_config';

    // 保存配置
    function saveConfig() {
        const config = {
            name: nameInput.value.trim() || '翻译',
            model: modelInput.value.trim() || 'gpt-5.4',
            key: keyInput.value.trim(),
            proxyUrl: proxyInput.value.trim()
        };
        
        if (!config.key) {
            alert('请填写 API KEY');
            return false;
        }
        if (!config.proxyUrl) {
            alert('请填写 Proxy API 地址');
            return false;
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            statusSpan.textContent = '✓ 配置已保存';
            setTimeout(() => statusSpan.textContent = '', 2500);
            return true;
        } catch (e) {
            alert('保存失败: ' + e.message);
            return false;
        }
    }

    // 加载配置
    function loadConfig() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            alert('没有已保存的配置');
            return;
        }
        try {
            const config = JSON.parse(saved);
            nameInput.value = config.name || '翻译';
            modelInput.value = config.model || 'gpt-5.4';
            keyInput.value = config.key || '';
            proxyInput.value = config.proxyUrl || '';
            statusSpan.textContent = '✓ 配置已加载';
            setTimeout(() => statusSpan.textContent = '', 2500);
        } catch (e) {
            alert('配置数据损坏，请重新保存');
        }
    }

    // 发送 AI 请求
    async function callAI() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            alert('请先保存配置');
            return;
        }

        const config = JSON.parse(saved);
        const userMessage = userInput.value.trim();
        if (!userMessage) {
            alert('请输入问题');
            return;
        }

        chatBox.textContent = '⏳ 正在请求 AI ...';
        statusSpan.textContent = '请求中...';

        const requestBody = {
            model: config.model,
            messages: [{ role: 'user', content: userMessage }],
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
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            // 兼容多种响应格式
            let reply = '无法解析响应内容';
            if (data.choices?.[0]?.message?.content) {
                reply = data.choices[0].message.content;
            } else if (data.content) {
                reply = data.content;
            } else if (data.reply) {
                reply = data.reply;
            } else {
                reply = JSON.stringify(data, null, 2);
            }

            chatBox.textContent = `🤖 ${reply}`;
            statusSpan.textContent = '✓ 请求成功';
            setTimeout(() => statusSpan.textContent = '', 2500);
        } catch (error) {
            chatBox.textContent = `❌ 请求失败：${error.message}`;
            statusSpan.textContent = '✗ 请求失败';
            setTimeout(() => statusSpan.textContent = '', 3000);
            console.error('API 调用错误:', error);
        }
    }

    // 事件绑定
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('loadConfigBtn').addEventListener('click', loadConfig);
    document.getElementById('sendBtn').addEventListener('click', callAI);

    // 页面初始化：若存在配置则预填非敏感字段（不自动填 key）
    (function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const config = JSON.parse(saved);
                nameInput.value = config.name || '翻译';
                modelInput.value = config.model || 'gpt-5.4';
                proxyInput.value = config.proxyUrl || '';
                // 不自动填充密钥，需用户手动加载或输入
                statusSpan.textContent = 'ℹ️ 检测到已保存配置，点击“加载”可填入 KEY';
                setTimeout(() => statusSpan.textContent = '', 4000);
            } catch (e) {}
        }
    })();
})();