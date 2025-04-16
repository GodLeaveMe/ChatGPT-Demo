    let BASE_URL = '';
    let API_KEY = '';
    const INIT_ASSISTANT = { role: "assistant", content: "您好！我是 ChatGPT，有什么可以帮您的吗？" };
    const STORAGE_KEY = "gpt_chats_v1";
    let models = [];
    
    let chats = [];
    let currentChatId = null;
    let currentController = null;
    let currentModel = null;
    const textarea = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatContainer = document.getElementById('chat-container');
    const chatListDiv = document.getElementById('chat-list');
    const errorDiv = document.getElementById('error');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const modelSelect = document.getElementById('model-select');

    // 填充模型选择器
    function initModelSelector() {
      if (!models.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '请先在API设置中添加模型';
        option.disabled = true;
        modelSelect.appendChild(option);
        modelSelect.disabled = true;
        return;
      }
      modelSelect.disabled = false;
      models.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        modelSelect.appendChild(option);
      });
      modelSelect.value = currentModel ? currentModel.id : (models.length > 0 ? models[0].id : '');
      modelSelect.addEventListener('change', () => {
        currentModel = models.find(m => m.id === modelSelect.value);
      });
    }

    function loadChats() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          chats = JSON.parse(saved);
        }
        if (!Array.isArray(chats)) chats = [];
      } catch {
        chats = [];
      }
      if (chats.length === 0) {
        newChat(true);
      }
    }

    function saveChats() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    }

    function findChat(id) {
      return chats.find(c => c.id === id);
    }

    function updateCurrentChatTitle() {
      let cur = findChat(currentChatId);
      if (!cur) return;
      for (let m of cur.messages) {
        if (m.role === "user" && m.content.trim()) {
          let s = m.content.trim().split('\n')[0].slice(0, 30);
          if (s) {
            cur.title = s + (m.content.length > 30 ? "..." : "");
            saveChats();
            renderChatList();
            return;
          }
        }
      }
      cur.title = "未命名对话";
      saveChats();
      renderChatList();
    }

    function renderChatList() {
      chatListDiv.innerHTML = '';
      chats.sort((a, b) => b.updated - a.updated);
      let anyChecked = false;
      for (let chat of chats) {
        let div = document.createElement('div');
        div.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
        div.setAttribute('role', 'listitem');
        div.tabIndex = 0;
        div.title = chat.title;
        div.onclick = () => switchChat(chat.id);
        div.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            switchChat(chat.id);
          }
        };
        // 批量选择复选框
        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'chat-batch-checkbox';
        checkbox.style.marginRight = '0.5rem';
        checkbox.onclick = (e) => { e.stopPropagation(); updateBatchBar(); };
        div.appendChild(checkbox);
        let titleSpan = document.createElement('span');
        titleSpan.className = 'chat-item-title';
        titleSpan.textContent = chat.title;
        div.appendChild(titleSpan);
        if (chats.length > 1) {
          let del = document.createElement('span');
          del.className = 'chat-item-del';
          del.title = '删除此对话';
          del.setAttribute('role', 'button');
          del.setAttribute('tabindex', '0');
          del.innerHTML = '&times;';
          del.onclick = (e) => {
            e.stopPropagation();
            if (confirm('确定要删除此对话？')) {
              deleteChat(chat.id);
            }
          };
          del.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (confirm('确定要删除此对话？')) {
                deleteChat(chat.id);
              }
            }
          };
          div.appendChild(del);
        }
        chatListDiv.appendChild(div);
      }
      updateBatchBar();
    }

    function switchChat(id) {
      if (currentChatId === id) return;
      currentChatId = id;
      saveChats();
      renderChatList();
      renderChat();
      if (window.innerWidth <= 480) {
        toggleSidebar();
      }
    }

    function deleteChat(id) {
      let idx = chats.findIndex(c => c.id === id);
      if (idx !== -1) {
        chats.splice(idx, 1);
        if (!chats.length) {
          newChat(true);
          return;
        }
        if (currentChatId === id) {
          currentChatId = chats[0].id;
        }
        saveChats();
        renderChatList();
        renderChat();
      }
    }

    function clearAllChats() {
      if (!confirm('确定要清空全部对话吗？')) return;
      chats = [];
      localStorage.removeItem(STORAGE_KEY);
      newChat(true);
    }

    function newChat(skipRender) {
      let id = Date.now() + "_" + Math.floor(Math.random() * 10000);
      let chat = {
        id,
        title: "新对话",
        messages: [Object.assign({}, INIT_ASSISTANT)],
        created: Date.now(),
        updated: Date.now(),
      };
      chats.unshift(chat);
      currentChatId = id;
      saveChats();
      if (!skipRender) {
        renderChatList();
        renderChat();
      }
      textarea.value = "";
      textarea.style.height = "auto";
      sendBtn.disabled = true;
      errorDiv.style.display = "none";
      textarea.disabled = false;
      textarea.focus();
      if (window.innerWidth <= 480) {
        toggleSidebar();
      }
    }

    // 气泡模型渲染
    function renderChat() {
      chatContainer.innerHTML = "";
      errorDiv.style.display = "none";
      let cur = findChat(currentChatId);
      if (!cur) return;
      let anyChecked = false;
      for (let i = 0; i < cur.messages.length; i++) {
        let msg = cur.messages[i];
        const row = document.createElement("div");
        row.className = "message-row " + msg.role;
        // 批量选择复选框
        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'msg-batch-checkbox';
        checkbox.style.margin = '0 0.5rem';
        checkbox.onclick = (e) => { e.stopPropagation(); updateMsgBatchBar(); };
        row.appendChild(checkbox);
        const avatar = document.createElement("div");
        avatar.className = "avatar " + msg.role;
        if (msg.role === "assistant") {
          const img = document.createElement("img");
          img.src = "https://cdn.oaistatic.com/assets/favicon-miwirzcw.ico";
          img.alt = "AI";
          avatar.appendChild(img);
        } else {
          avatar.innerHTML = '<i class="fas fa-user"></i>';
        }
        const contentDiv = document.createElement("div");
        contentDiv.className = "message-content";
        const bubble = document.createElement("div");
        bubble.className = "message-bubble " + msg.role;
        if (typeof msg.content === "string") {
          bubble.innerHTML = '<p>' + formatMessageContent(msg.content) + '</p>';
          // 添加图片点击放大功能
          bubble.querySelectorAll('img').forEach(img => {
            img.style.cursor = 'zoom-in';
            img.onclick = function(e) {
              showImageModal(img.src, img.alt);
            };
          });
          bubble.querySelectorAll('pre').forEach(pre => { addCodeCopyButton(pre); });
        } else {
          bubble.textContent = msg.content;
        }
        const actions = document.createElement("div");
        actions.className = "message-actions";
        if (msg.role === "user") {
          const editBtn = document.createElement("button");
          editBtn.className = "message-action-btn";
          editBtn.title = "编辑";
          editBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
          editBtn.onclick = () => editMessage(row, bubble);
          actions.appendChild(editBtn);
        } else {
          const regenerateBtn = document.createElement("button");
          regenerateBtn.className = "message-action-btn";
          regenerateBtn.title = "重新生成";
          regenerateBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
          regenerateBtn.onclick = () => regenerateResponse(row);
          actions.appendChild(regenerateBtn);
        }
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "message-action-btn delete";
        deleteBtn.title = "删除";
        deleteBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        deleteBtn.onclick = () => deleteMessage(row);
        actions.appendChild(deleteBtn);
        const timestamp = document.createElement("div");
        timestamp.className = "message-timestamp";
        timestamp.textContent = formatTime(new Date(msg.timestamp || Date.now()));
        contentDiv.appendChild(bubble);
        contentDiv.appendChild(actions);
        contentDiv.appendChild(timestamp);
        row.appendChild(avatar);
        row.appendChild(contentDiv);
        chatContainer.appendChild(row);
      }
      updateMsgBatchBar();
    }

    function scrollToBottom() {
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 50);
    }

    textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
      sendBtn.disabled = this.value.trim().length === 0;
    });

    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    document.getElementById("chat-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      const value = textarea.value.trim();
      if (!value) return;

      // 检查是否有可用的模型
      if (!currentModel) {
        errorDiv.textContent = "请先在API设置中添加并选择模型";
        errorDiv.style.display = "block";
        return;
      }

      errorDiv.style.display = "none";
      let cur = findChat(currentChatId);
      if (!cur) return;

      // 添加用户消息
      appendMessage("user", value);
      cur.messages.push({ role: "user", content: value });
      cur.updated = Date.now();
      updateCurrentChatTitle();
      saveChats();

      textarea.value = "";
      textarea.style.height = "auto";
      sendBtn.disabled = true;

      await fetchAI(cur);
    });

    // 追加消息（发送时用，附带气泡样式）
    function appendMessage(role, content) {
      const row = document.createElement("div");
      row.className = "message-row " + role;

      const avatar = document.createElement("div");
      avatar.className = "avatar " + role;
      if (role === "assistant") {
        const img = document.createElement("img");
        img.src = "https://cdn.oaistatic.com/assets/favicon-miwirzcw.ico";
        img.alt = "AI";
        avatar.appendChild(img);
      } else {
        avatar.innerHTML = '<i class="fas fa-user"></i>';
      }

      const contentDiv = document.createElement("div");
      contentDiv.className = "message-content";

      const bubble = document.createElement("div");
      bubble.className = "message-bubble " + role;

      if (typeof content === "string") {
        bubble.innerHTML = '<p>' + formatMessageContent(content) + '</p>';
        // 添加图片点击放大功能
        bubble.querySelectorAll('img').forEach(img => {
          img.style.cursor = 'zoom-in';
          img.onclick = function(e) {
            showImageModal(img.src, img.alt);
          };
        });
        // 添加代码块复制按钮
        bubble.querySelectorAll('pre').forEach(pre => {
          addCodeCopyButton(pre);
        });
      } else {
        bubble.textContent = content;
      }

      // 添加消息操作按钮
      const actions = document.createElement("div");
      actions.className = "message-actions";

      if (role === "user") {
        const editBtn = document.createElement("button");
        editBtn.className = "message-action-btn";
        editBtn.title = "编辑";
        editBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        editBtn.onclick = () => editMessage(row, bubble);
        actions.appendChild(editBtn);
      } else {
        const regenerateBtn = document.createElement("button");
        regenerateBtn.className = "message-action-btn";
        regenerateBtn.title = "重新生成";
        regenerateBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
        regenerateBtn.onclick = () => regenerateResponse(row);
        actions.appendChild(regenerateBtn);
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "message-action-btn delete";
      deleteBtn.title = "删除";
      deleteBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
      deleteBtn.onclick = () => deleteMessage(row);
      actions.appendChild(deleteBtn);

      // 添加时间戳
      const timestamp = document.createElement("div");
      timestamp.className = "message-timestamp";
      timestamp.textContent = formatTime(new Date());

      contentDiv.appendChild(bubble);
      contentDiv.appendChild(actions);
      contentDiv.appendChild(timestamp);
      row.appendChild(avatar);
      row.appendChild(contentDiv);
      chatContainer.appendChild(row);

      // 代码高亮
      bubble.querySelectorAll('pre code').forEach(block => {
        hljs.highlightBlock(block);
      });

      scrollToBottom();
      return bubble;
    }

    async function fetchAI(cur) {
      if (!currentModel) {
        errorDiv.textContent = "请先在API设置中添加并选择模型";
        errorDiv.style.display = "block";
        return;
      }

      textarea.disabled = true;
      sendBtn.disabled = true;

      const contentDiv = appendMessage("assistant", "");
      const typingIndicator = document.createElement('div');
      typingIndicator.className = 'typing-indicator';
      typingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      `;
      contentDiv.innerHTML = '';
      contentDiv.appendChild(typingIndicator);

      const stopBtn = document.createElement("button");
      stopBtn.className = "stop-btn";
      stopBtn.textContent = "停止生成";
      let stopped = false;
      stopBtn.onclick = () => {
        stopped = true;
        if (currentController) currentController.abort();
        stopBtn.disabled = true;
        stopBtn.textContent = "已停止";
      };

      // 插入停止按钮在输入区内
      const inputArea = document.querySelector(".input-area");
      if (inputArea && !inputArea.contains(stopBtn)) {
        inputArea.appendChild(stopBtn);
      }

      currentController = new AbortController();
      let fullText = "";

      try {
        const resp = await fetch(BASE_URL, {
          method: "POST",
          signal: currentController.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + API_KEY,
          },
          body: JSON.stringify({
            model: currentModel.id,
            messages: cur.messages,
            stream: true,
          }),
        });

        if (!resp.ok) {
          let msg = resp.status + " " + resp.statusText;
          try {
            const j = await resp.json();
            msg = j.error?.message || msg;
          } catch {}
          throw new Error(msg);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let done = false;

        while (!done && !stopped) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) buffer += decoder.decode(value, { stream: true });

          let lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const l = line.trim();
            if (!l || !l.startsWith("data:")) continue;

            const data = l.slice(5).trim();
            if (data === "[DONE]") {
              done = true;
              break;
            }

            try {
              const delta = JSON.parse(data);
              const text = delta.choices?.[0]?.delta?.content ?? "";

              if (text) {
                fullText += text;

                // 移除打字指示器
                if (typingIndicator.parentNode) {
                  typingIndicator.remove();
                }

                let html = fullText
                  .replace(/```([a-z]*)\n([\s\S]*?)\n```/g, '<pre>$2</pre>')
                  .replace(/`([^`]+)`/g, '<code>$1</code>')
                  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                  .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
                  .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                  .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                  .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                  .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                  .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
                  .replace(/\n\n/g, '</p><p>')
                  .replace(/\n/g, '<br>');

                contentDiv.innerHTML = '<p>' + html + '</p>';
                scrollToBottom();
              }
            } catch (e) {
              console.error("Error parsing stream data:", e);
            }
          }
        }

        stopBtn.remove();

        if (fullText.trim() === "") {
          contentDiv.innerHTML = "<p>[无回复内容]</p>";
        }

        cur.messages.push({ role: "assistant", content: fullText });
        cur.updated = Date.now();
        saveChats();
        updateCurrentChatTitle();
      } catch (err) {
        stopBtn.remove();
        contentDiv.innerHTML = "<p>[出错]</p>";
        errorDiv.textContent = "请求失败：" + (err.message || err);
        errorDiv.style.display = "block";
      }

      textarea.disabled = false;
      textarea.focus();
      sendBtn.disabled = true;
      currentController = null;
    }

    function exportCurrentChat() {
      const cur = findChat(currentChatId);
      if (!cur) return;

      const data = {
        id: cur.id,
        title: cur.title,
        created: cur.created,
        updated: cur.updated,
        messages: cur.messages,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (cur.title.replace(/[\\\/:*?"<>|]/g, "_").slice(0, 24) || "chat") + ".json";
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 300);
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute("data-theme");
      const newTheme = current === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      
      // 更新主题切换按钮图标
      const themeIcon = document.querySelector('.theme-toggle-icon');
      themeIcon.innerHTML = newTheme === "dark" 
        ? '<i class="fas fa-moon"></i>' 
        : '<i class="fas fa-sun"></i>';
    }

    function toggleSidebar() {
      sidebar.classList.toggle('open');
    }

    function loadTheme() {
      let theme = localStorage.getItem("theme") || "light";
      document.documentElement.setAttribute("data-theme", theme);
      // 设置主题切换按钮图标
      const themeToggle = document.querySelector('.theme-toggle');
      themeToggle.innerHTML = `
        <div class="theme-toggle-icon">
          <i class="fas fa-${theme === 'dark' ? 'moon' : 'sun'}"></i>
        </div>
        <span>${theme === 'dark' ? '切换亮色' : '切换暗色'}</span>
      `;
    }

    function handleOutsideClick(e) {
      if (window.innerWidth > 480) return;
      if (!sidebar.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }

    // 初始化代码高亮
    hljs.configure({
      languages: ['javascript', 'python', 'java', 'cpp', 'html', 'css']
    });

    // 格式化时间
    function formatTime(date) {
      return new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }

    // 格式化代码
    function formatCode(code, language) {
      if (!language) return hljs.highlightAuto(code).value;
      try {
        return hljs.highlight(code, { language }).value;
      } catch (e) {
        return hljs.highlightAuto(code).value;
      }
    }

    // 添加代码块复制按钮
    function addCodeCopyButton(pre) {
      // 避免重复添加
      if (pre.querySelector('.code-copy-button')) return;
      const button = document.createElement('button');
      button.className = 'code-copy-button';
      button.innerHTML = '<i class="fas fa-copy"></i><span>复制代码</span>';
      button.onclick = async (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code').innerText;
        await navigator.clipboard.writeText(code);
        button.innerHTML = '<i class="fas fa-check"></i><span>已复制!</span>';
        setTimeout(() => {
          button.innerHTML = '<i class="fas fa-copy"></i><span>复制代码</span>';
        }, 2000);
      };
      pre.appendChild(button);
    }

    // 删除消息
    function deleteMessage(messageRow) {
      if (confirm('确定要删除这条消息吗？')) {
        const chat = findChat(currentChatId);
        const index = Array.from(chatContainer.children).indexOf(messageRow);
        chat.messages.splice(index, 1);
        messageRow.remove();
        saveChats();
      }
    }

    // 编辑消息
    function editMessage(messageRow, bubble) {
      const originalContent = bubble.querySelector('p').innerText;
      const editContainer = document.createElement('div');
      editContainer.className = 'edit-mode';
      
      const textarea = document.createElement('textarea');
      textarea.value = originalContent;
      
      const actions = document.createElement('div');
      actions.className = 'edit-actions';
      
      const saveBtn = document.createElement('button');
      saveBtn.className = 'message-action-btn';
      saveBtn.title = '保存';
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'message-action-btn';
      cancelBtn.title = '取消';
      cancelBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      
      editContainer.appendChild(textarea);
      editContainer.appendChild(actions);
      
      bubble.innerHTML = '';
      bubble.appendChild(editContainer);
      
      saveBtn.onclick = async () => {
        const newContent = textarea.value.trim();
        if (newContent) {
          const chat = findChat(currentChatId);
          const index = Array.from(chatContainer.children).indexOf(messageRow);
          chat.messages[index].content = newContent;
          
          // 更新消息显示
          bubble.innerHTML = '<p>' + formatMessageContent(newContent) + '</p>';
          
          // 重新添加代码高亮
          bubble.querySelectorAll('pre code').forEach(block => {
            hljs.highlightBlock(block);
            addCodeCopyButton(block.parentElement);
          });
          
          saveChats();
          
          // 如果是用户消息，重新请求AI回复
          if (messageRow.classList.contains('user')) {
            // 删除之后的所有消息
            while (messageRow.nextElementSibling) {
              const nextRow = messageRow.nextElementSibling;
              const chat = findChat(currentChatId);
              const index = Array.from(chatContainer.children).indexOf(nextRow);
              chat.messages.splice(index, 1);
              nextRow.remove();
            }
            // 重新请求AI回复
            await fetchAI(chat);
          }
        }
      };
      
      cancelBtn.onclick = () => {
        bubble.innerHTML = '<p>' + formatMessageContent(originalContent) + '</p>';
        // 重新添加代码高亮
        bubble.querySelectorAll('pre code').forEach(block => {
          hljs.highlightBlock(block);
          addCodeCopyButton(block.parentElement);
        });
      };
      
      textarea.focus();
    }

    // 重新生成回复
    async function regenerateResponse(messageRow) {
      const chat = findChat(currentChatId);
      const index = Array.from(chatContainer.children).indexOf(messageRow);
      
      // 删除当前的助手回复
      chat.messages.splice(index, 1);
      messageRow.remove();
      
      // 重新请求AI回复
      await fetchAI(chat);
    }

    // 格式化消息内容
    function formatMessageContent(content) {
      return content
        .replace(/```([a-z]*)\n([\s\S]*?)\n```/g, (_, lang, code) => {
          const highlighted = formatCode(code, lang);
          return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
        })
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    }

    // 2. 显示/隐藏批量操作栏
    function updateBatchBar() {
      const bar = document.getElementById('chat-batch-bar');
      const checkboxes = chatListDiv.querySelectorAll('.chat-batch-checkbox');
      let checked = Array.from(checkboxes).filter(cb => cb.checked);
      bar.style.display = checked.length > 0 ? '' : 'none';
    }

    // 3. 批量删除按钮事件
    const deleteSelectedChatsBtn = document.getElementById('delete-selected-chats');
    deleteSelectedChatsBtn.onclick = function() {
      const checkboxes = chatListDiv.querySelectorAll('.chat-batch-checkbox');
      let ids = [];
      checkboxes.forEach((cb, idx) => { if (cb.checked) ids.push(chats[idx].id); });
      if (ids.length && confirm('确定要批量删除选中的对话吗？')) {
        chats = chats.filter(c => !ids.includes(c.id));
        if (!chats.length) newChat(true);
        else currentChatId = chats[0].id;
        saveChats();
        renderChatList();
        renderChat();
      }
    };

    // 2. 消息批量操作栏
    if (!document.getElementById('msg-batch-bar')) {
      let bar = document.createElement('div');
      bar.id = 'msg-batch-bar';
      bar.style = 'display:none; position:fixed; bottom:90px; left:50%; transform:translateX(-50%); z-index:10; background:var(--bg); border:1px solid var(--input-border); border-radius:8px; padding:0.5rem 1rem; box-shadow:0 2px 8px rgba(0,0,0,0.08);';
      bar.innerHTML = '<button id="delete-selected-msgs" class="message-action-btn delete">批量删除消息</button>';
      document.body.appendChild(bar);
    }
    function updateMsgBatchBar() {
      const bar = document.getElementById('msg-batch-bar');
      const checkboxes = chatContainer.querySelectorAll('.msg-batch-checkbox');
      let checked = Array.from(checkboxes).filter(cb => cb.checked);
      bar.style.display = checked.length > 0 ? '' : 'none';
    }
    document.getElementById('delete-selected-msgs').onclick = function() {
      const checkboxes = chatContainer.querySelectorAll('.msg-batch-checkbox');
      let idxs = [];
      checkboxes.forEach((cb, idx) => { if (cb.checked) idxs.push(idx); });
      if (idxs.length && confirm('确定要批量删除选中的消息吗？')) {
        let cur = findChat(currentChatId);
        cur.messages = cur.messages.filter((m, i) => !idxs.includes(i));
        saveChats();
        renderChat();
      }
    };

    // 模态框相关函数
    function createModal(title, content, actions) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      
      const modal = document.createElement('div');
      modal.className = 'modal';
      
      modal.innerHTML = `
        <div class="modal-title">${title}</div>
        <div class="modal-content">${content}</div>
        <div class="modal-actions">${actions}</div>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      return overlay;
    }

    function showBatchModal(type) {
      const isDelete = type === 'delete';
      const title = isDelete ? '批量删除' : '批量导出';
      
      const content = `
        <div class="select-group">
          <label class="select-option">
            <input type="radio" name="batch-type" value="chats" checked>
            <span>${isDelete ? '删除选中的对话' : '导出选中的对话'}</span>
          </label>
          <label class="select-option">
            <input type="radio" name="batch-type" value="messages">
            <span>${isDelete ? '删除选中的消息' : '导出选中的消息'}</span>
          </label>
        </div>
        ${!isDelete ? `
        <div class="select-group">
          <label class="select-option">
            <input type="radio" name="export-format" value="json" checked>
            <span>JSON 格式</span>
          </label>
          <label class="select-option">
            <input type="radio" name="export-format" value="markdown">
            <span>Markdown 格式</span>
          </label>
          <label class="select-option">
            <input type="radio" name="export-format" value="txt">
            <span>纯文本格式</span>
          </label>
        </div>
        ` : ''}
      `;
      
      const actions = `
        <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="modal-btn primary" onclick="handleBatchAction('${type}', this)">确定</button>
      `;
      
      createModal(title, content, actions);
    }

    function handleBatchAction(type, btn) {
      const modal = btn.closest('.modal-overlay');
      const batchType = modal.querySelector('input[name="batch-type"]:checked').value;
      
      if (type === 'delete') {
        if (batchType === 'chats') {
          batchDeleteChats();
        } else {
          batchDeleteMessages();
        }
      } else {
        const format = modal.querySelector('input[name="export-format"]:checked').value;
        if (batchType === 'chats') {
          batchExportChats(format);
        } else {
          batchExportMessages(format);
        }
      }
      
      modal.remove();
    }

    // 批量删除函数
    function batchDeleteChats() {
      const checkboxes = document.querySelectorAll('.chat-batch-checkbox:checked');
      if (!checkboxes.length) return;
      
      if (confirm(`确定要删除选中的 ${checkboxes.length} 个对话吗？`)) {
        const ids = Array.from(checkboxes).map(cb => 
          chats[Array.from(chatListDiv.children).indexOf(cb.closest('.chat-item'))].id
        );
        chats = chats.filter(c => !ids.includes(c.id));
        if (!chats.length) newChat(true);
        else currentChatId = chats[0].id;
        saveChats();
        renderChatList();
        renderChat();
      }
    }

    function batchDeleteMessages() {
      const checkboxes = document.querySelectorAll('.msg-batch-checkbox:checked');
      if (!checkboxes.length) return;
      
      if (confirm(`确定要删除选中的 ${checkboxes.length} 条消息吗？`)) {
        const indices = Array.from(checkboxes).map(cb => 
          Array.from(chatContainer.children).indexOf(cb.closest('.message-row'))
        );
        let cur = findChat(currentChatId);
        cur.messages = cur.messages.filter((_, i) => !indices.includes(i));
        saveChats();
        renderChat();
      }
    }

    // 批量导出函数
    function batchExportChats(format) {
      const checkboxes = document.querySelectorAll('.chat-batch-checkbox:checked');
      if (!checkboxes.length) return;
      
      const selectedChats = Array.from(checkboxes).map(cb => 
        chats[Array.from(chatListDiv.children).indexOf(cb.closest('.chat-item'))]
      );
      
      let content;
      let filename;
      let type;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(selectedChats, null, 2);
          filename = 'chats.json';
          type = 'application/json';
          break;
        case 'markdown':
          content = selectedChats.map(chat => {
            return `# ${chat.title}\n\n` + chat.messages.map(msg => 
              `**${msg.role}**: ${msg.content}`
            ).join('\n\n');
          }).join('\n\n---\n\n');
          filename = 'chats.md';
          type = 'text/markdown';
          break;
        case 'txt':
          content = selectedChats.map(chat => {
            return `${chat.title}\n\n` + chat.messages.map(msg => 
              `${msg.role}: ${msg.content}`
            ).join('\n\n');
          }).join('\n\n==========\n\n');
          filename = 'chats.txt';
          type = 'text/plain';
          break;
      }
      
      downloadFile(content, filename, type);
    }

    function batchExportMessages(format) {
      const checkboxes = document.querySelectorAll('.msg-batch-checkbox:checked');
      if (!checkboxes.length) return;
      
      const cur = findChat(currentChatId);
      const selectedMessages = Array.from(checkboxes).map(cb => {
        const index = Array.from(chatContainer.children).indexOf(cb.closest('.message-row'));
        return cur.messages[index];
      });
      
      let content;
      let filename;
      let type;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(selectedMessages, null, 2);
          filename = 'messages.json';
          type = 'application/json';
          break;
        case 'markdown':
          content = selectedMessages.map(msg => 
            `**${msg.role}**: ${msg.content}`
          ).join('\n\n');
          filename = 'messages.md';
          type = 'text/markdown';
          break;
        case 'txt':
          content = selectedMessages.map(msg => 
            `${msg.role}: ${msg.content}`
          ).join('\n\n');
          filename = 'messages.txt';
          type = 'text/plain';
          break;
      }
      
      downloadFile(content, filename, type);
    }

    function downloadFile(content, filename, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    }

    window.onload = () => {
      loadTheme();
      loadChats();
      initModelSelector();
      renderChatList();
      renderChat();
      textarea.focus();

      // 点击侧边栏外部关闭侧边栏
      document.addEventListener('click', handleOutsideClick);

      // 阻止事件冒泡
      sidebar.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    };

    // ========== API设置相关 ==========
    const DEFAULT_BASE_URL = '';
    const DEFAULT_API_KEY = '';
    const DEFAULT_MODELS = [];

    function getApiConfig() {
      let config = localStorage.getItem('gpt_api_config');
      if (config) {
        try {
          return JSON.parse(config);
        } catch {}
      }
      return {
        base_url: DEFAULT_BASE_URL,
        api_key: DEFAULT_API_KEY,
        models: DEFAULT_MODELS.slice(),
      };
    }
    function setApiConfig(cfg) {
      localStorage.setItem('gpt_api_config', JSON.stringify(cfg));
    }
    function clearApiConfig() {
      localStorage.removeItem('gpt_api_config');
    }

    // 全局唯一API配置变量
    let apiConfig = getApiConfig();
    BASE_URL = apiConfig.base_url;
    API_KEY = apiConfig.api_key;
    window.models = apiConfig.models;
    window.currentModel = window.models[0];

    function showApiSettings() {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.minWidth = '400px';
      modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="modal-title">API 设置</div>
          <button onclick="this.closest('.modal-overlay').remove()" style="background:transparent;border:none;font-size:1.5rem;line-height:1;color:var(--text);cursor:pointer;" title="关闭">×</button>
        </div>
        <div class="modal-content">
          <label style="display:block;margin-bottom:0.5rem;">API URL
            <input id="api-url-input" type="text" style="width:100%;margin-top:0.25rem;padding:0.5rem;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);" value="${BASE_URL}">
          </label>
          <label style="display:block;margin-bottom:0.5rem;">API KEY
            <input id="api-key-input" type="text" style="width:100%;margin-top:0.25rem;padding:0.5rem;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);" value="${API_KEY}">
          </label>
          <div style="margin-bottom:0.5rem;">
            <div style="margin-bottom:0.25rem;">模型列表</div>
            <div id="model-list" style="display:flex;flex-direction:column;gap:0.25rem;"></div>
            <div style="margin-top:0.5rem;display:flex;gap:0.5rem;">
              <input id="new-model-id" type="text" placeholder="模型ID" style="flex:1;padding:0.3rem;border-radius:4px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);">
              <input id="new-model-name" type="text" placeholder="模型名称" style="flex:1;padding:0.3rem;border-radius:4px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);">
              <button id="add-model-btn" style="padding:0.3rem 0.8rem;border-radius:4px;background:var(--openai-green);color:#fff;border:none;cursor:pointer;">添加</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
          <button class="modal-btn" id="clear-api-btn">一键清除</button>
          <button class="modal-btn" id="reset-api-btn">恢复默认</button>
          <button class="modal-btn" id="test-api-btn">测试API</button>
          <button class="modal-btn primary" id="save-api-btn">保存</button>
        </div>
      `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // 渲染模型列表
      function renderModelList() {
        const list = modal.querySelector('#model-list');
        list.innerHTML = '';
        window.models.forEach((m, idx) => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '0.5rem';
          row.innerHTML = `<input type="text" value="${m.id}" style="flex:1;padding:0.2rem;border-radius:4px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);" disabled><input type="text" value="${m.name}" style="flex:1;padding:0.2rem;border-radius:4px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);" disabled><button style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem;" title="删除" data-idx="${idx}"><svg viewBox='0 0 24 24' width='16' height='16' stroke='currentColor' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'></polyline><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'></path><line x1='10' y1='11' x2='10' y2='17'></line><line x1='14' y1='11' x2='14' y2='17'></line></svg></button>`;
          row.querySelector('button').onclick = function() {
            window.models.splice(idx, 1);
            renderModelList();
          };
          list.appendChild(row);
        });
      }
      renderModelList();

      // 添加模型
      modal.querySelector('#add-model-btn').onclick = function() {
        const id = modal.querySelector('#new-model-id').value.trim();
        const name = modal.querySelector('#new-model-name').value.trim();
        if (id && name) {
          window.models.push({id, name});
          renderModelList();
          modal.querySelector('#new-model-id').value = '';
          modal.querySelector('#new-model-name').value = '';
          updateModelSelector(); // 新增：添加模型后刷新模型选择器
        }
      };

      // 一键清除
      modal.querySelector('#clear-api-btn').onclick = function() {
        window.BASE_URL = '';
        window.API_KEY = '';
        window.models = [];
        modal.querySelector('#api-url-input').value = '';
        modal.querySelector('#api-key-input').value = '';
        renderModelList();
        // 清空模型选择器
        if (window.modelSelect) {
          window.modelSelect.innerHTML = '';
        }
        // 清空localStorage
        clearApiConfig();
        updateModelSelector(); // 新增：清空后刷新模型选择器
      };

      // 恢复默认
      modal.querySelector('#reset-api-btn').onclick = function() {
        window.BASE_URL = '';
        window.API_KEY = '';
        window.models = [];
        modal.querySelector('#api-url-input').value = window.BASE_URL;
        modal.querySelector('#api-key-input').value = window.API_KEY;
        renderModelList();
      };

      // 测试API
      modal.querySelector('#test-api-btn').onclick = async function() {
        const url = modal.querySelector('#api-url-input').value.trim();
        const key = modal.querySelector('#api-key-input').value.trim();
        let result = '';
        try {
          // 尝试获取模型列表或做一次简单POST
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + key
            },
            body: JSON.stringify({
              model: window.models[0]?.id || '',
              messages: [{role: 'user', content: 'ping'}],
              stream: false
            })
          });
          if (!resp.ok) {
            result = '失败：' + resp.status + ' ' + resp.statusText;
            try {
              const j = await resp.json();
              result += '\n' + (j.error?.message || JSON.stringify(j));
            } catch {}
          } else {
            const data = await resp.json();
            result = '成功：' + JSON.stringify(data).slice(0, 300);
          }
        } catch (e) {
          result = '请求异常：' + e.message;
        }
        alert(result);
      };

      // 保存
      modal.querySelector('#save-api-btn').onclick = function() {
        BASE_URL = modal.querySelector('#api-url-input').value.trim();
        API_KEY = modal.querySelector('#api-key-input').value.trim();
        setApiConfig({base_url: BASE_URL, api_key: API_KEY, models});
        window.BASE_URL = BASE_URL;
        window.API_KEY = API_KEY;
        window.models = models;
        // 刷新模型选择器
        updateModelSelector();
        overlay.remove();
      };
    }

    function updateModelSelector() {
      modelSelect.innerHTML = '';
      if (!models.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '请先在API设置中添加模型';
        option.disabled = true;
        modelSelect.appendChild(option);
        modelSelect.disabled = true;
        return;
      }
      modelSelect.disabled = false;
      models.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        modelSelect.appendChild(option);
      });
      if (!currentModel && models.length > 0) {
        currentModel = models[0];
      }
      modelSelect.value = currentModel ? currentModel.id : '';
    }

    // 页面加载时优先使用本地配置
    apiConfig = getApiConfig();
    BASE_URL = apiConfig.base_url;
    API_KEY = apiConfig.api_key;
    models = apiConfig.models;
    currentModel = models[0];
    window.models = models;
    window.currentModel = currentModel;

    // 清除所有本地缓存
    function clearAllLocalStorage() {
      if (confirm('确定要清除所有本地缓存吗？这将删除所有聊天记录、API设置等数据，且无法恢复。')) {
        // 清除所有localStorage
        localStorage.clear();
        
        // 重置所有全局变量
        BASE_URL = '';
        API_KEY = '';
        models = [];
        currentModel = null;
        chats = [];
        currentChatId = null;
        
        // 刷新模型选择器
        updateModelSelector();
        
        // 创建新的空对话
        newChat(true);
        
        // 刷新界面
        renderChatList();
        renderChat();
        
        // 显示提示
        alert('本地缓存已清除，请重新设置API和模型。');
      }
    }

    // 图片放大弹窗函数
    function showImageModal(src, alt) {
      // 避免重复弹窗
      if (document.querySelector('.img-modal-overlay')) return;
      const overlay = document.createElement('div');
      overlay.className = 'img-modal-overlay';
      overlay.innerHTML = `
        <button class="img-modal-close" title="关闭">×</button>
        <img src="${src}" alt="${alt || ''}">
      `;
      document.body.appendChild(overlay);
      // 关闭事件
      overlay.onclick = function(e) {
        if (e.target === overlay) overlay.remove();
      };
      overlay.querySelector('.img-modal-close').onclick = function() {
        overlay.remove();
      };
    }