// 现代ChatGPT界面交互逻辑
class ModernGPT {
  constructor() {
    this.chats = [];
    this.currentChatId = null;
    this.currentModel = localStorage.getItem('selected_model') || '';
    this.availableModels = [];
    this.apiKey = localStorage.getItem('openai_api_key') || '';
    this.apiUrl = localStorage.getItem('openai_api_url') || 'https://api.openai.com/v1';
    this.systemPrompt = localStorage.getItem('system_prompt') || '';
    this.attachedFiles = [];
    this.imageGenMode = false;  // 生图模式标志
    this.currentOption = 'none';  // 当前选中的选项: none, attach, image, thinking

    // 彩蛋设置
    this.settings = {
      showTimestamp: localStorage.getItem('showTimestamp') === 'true',
      mouseTrail: localStorage.getItem('mouseTrail') === 'true',
      clickFireworks: localStorage.getItem('clickFireworks') === 'true'
    };

    // 系统级对话框与图片预览
    this.dialog = this.createSystemDialog();
    this.imagePreview = null;

    this.init();
  }

  init() {
    this.loadChats();
    this.bindEvents();
    this.bindSessionPromptModal();

    // 设置当前模型显示
    const modelNameEl = document.querySelector('.model-name');
    if (modelNameEl) {
      modelNameEl.textContent = this.currentModel;
    }

    // 如果没有聊天记录或需要新建，才创建新聊天
    if (this.chats.length === 0) {
      this.createNewChat();
    } else {
      // 选择最近的聊天
      this.currentChatId = this.chats[0].id;
      this.switchChat(this.currentChatId);
    }

    // 如果有API Key，尝试获取模型列表
    if (this.apiKey) {
      this.fetchModels();
    }

    // 初始化彩蛋效果
    if (typeof Effects !== 'undefined') {
      this.effects = new Effects(this);
      this.effects.init();
    }
  }

  // 加载聊天记录
  loadChats() {
    const saved = localStorage.getItem('modern_gpt_chats');
    if (saved) {
      try {
        this.chats = JSON.parse(saved);
      } catch (e) {
        this.chats = [];
      }
    }
  }

  // 保存聊天记录
  saveChats() {
    localStorage.setItem('modern_gpt_chats', JSON.stringify(this.chats));
  }

  // 创建新聊天
  createNewChat() {
    const chat = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '新的聊天',
      messages: [],
      sessionPrompt: '',  // 会话提示词
      deepThinking: false,  // 深度思考模式
      created: Date.now(),
      updated: Date.now()
    };

    this.chats.unshift(chat);
    this.currentChatId = chat.id;
    this.saveChats();
    this.renderChatList();
    this.showWelcomeScreen();

    // 清空输入框
    const input = document.getElementById('message-input');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }

    // 关闭侧边栏（移动端）
    if (window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  // 切换聊天
  switchChat(chatId) {
    this.currentChatId = chatId;
    const chat = this.chats.find(c => c.id === chatId);

    if (chat && chat.messages.length > 0) {
      this.hideWelcomeScreen();
      this.renderMessages(chat.messages);
    } else {
      this.showWelcomeScreen();
    }

    // 同步选项菜单状态
    if (chat) {
      if (chat.deepThinking) {
        this.selectOption('thinking');
      } else if (this.imageGenMode) {
        this.selectOption('image');
      } else {
        this.selectOption('none');
      }
    }

    this.renderChatList();
  }

  // 删除聊天
  async deleteChat(chatId, event) {
    event.stopPropagation();

    const confirmed = await this.dialog.confirm('确定要删除这个对话吗？', '确认操作');
    if (!confirmed) return;

    this.chats = this.chats.filter(c => c.id !== chatId);

    if (this.currentChatId === chatId) {
      if (this.chats.length > 0) {
        this.switchChat(this.chats[0].id);
      } else {
        this.createNewChat();
      }
    }

    this.saveChats();
    this.renderChatList();
  }

  // 渲染聊天列表
  renderChatList(chatsToRender = null) {
    const container = document.getElementById('chat-list');
    if (!container) return;

    container.innerHTML = '';

    const chats = chatsToRender || this.chats;

    if (chats.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 13px;">没有找到匹配的聊天记录</div>';
      return;
    }

    chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item';
      if (chat.id === this.currentChatId) {
        item.classList.add('active');
      }

      item.textContent = chat.title;
      item.onclick = () => {
        this.switchChat(chat.id);
        if (window.innerWidth <= 768) {
          this.closeSidebar();
        }
      };

      // 添加删除按钮
      const deleteBtn = document.createElement('button');
      deleteBtn.style.cssText = 'float: right; background: none; border: none; color: #999; cursor: pointer; padding: 0 4px;';
      deleteBtn.innerHTML = '×';
      deleteBtn.onclick = (e) => this.deleteChat(chat.id, e);

      if (this.chats.length > 1) {
        item.appendChild(deleteBtn);
      }

      container.appendChild(item);
    });
  }

  // 显示欢迎界面
  showWelcomeScreen() {
    const welcome = document.getElementById('welcome-screen');
    const messages = document.getElementById('messages-container');

    if (welcome) welcome.style.display = 'flex';
    if (messages) messages.style.display = 'none';

    // 添加打字机效果
    const titleEl = document.getElementById('welcome-title');
    if (titleEl && !titleEl.classList.contains('typing')) {
      const text = titleEl.textContent;
      titleEl.textContent = '';
      titleEl.classList.add('typing');

      text.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.animationDelay = `${index * 0.05}s`;
        titleEl.appendChild(span);
      });
    }
  }

  // 隐藏欢迎界面
  hideWelcomeScreen() {
    const welcome = document.getElementById('welcome-screen');
    const messages = document.getElementById('messages-container');

    if (welcome) welcome.style.display = 'none';
    if (messages) messages.style.display = 'block';
  }

  // 渲染消息 - 气泡样式
  renderMessages(messages) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    // 定位当前消息所属的会话,用于渲染决策
    const relatedChat = this.chats.find(chatItem => chatItem.messages === messages) || null;

    container.innerHTML = '';

    messages.forEach((msg, index) => {
      const group = document.createElement('div');
      group.className = `message-group ${msg.role}`;
      group.dataset.index = index;

      const wrapper = document.createElement('div');
      wrapper.className = 'message-wrapper';

      const avatar = document.createElement('div');
      avatar.className = msg.role === 'user' ? 'message-avatar user-avatar' : 'message-avatar assistant-avatar';

      if (msg.role === 'user') {
        avatar.textContent = 'U';
      } else {
        avatar.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;">
          <path d="M11.2475 18.25C10.6975 18.25 10.175 18.1455 9.67999 17.9365C9.18499 17.7275 8.74499 17.436 8.35999 17.062C7.94199 17.205 7.50749 17.2765 7.05649 17.2765C6.31949 17.2765 5.63749 17.095 5.01049 16.732C4.38349 16.369 3.87749 15.874 3.49249 15.247C3.11849 14.62 2.93149 13.9215 2.93149 13.1515C2.93149 12.8325 2.97549 12.486 3.06349 12.112C2.62349 11.705 2.28249 11.2375 2.04049 10.7095C1.79849 10.1705 1.67749 9.6095 1.67749 9.0265C1.67749 8.4325 1.80399 7.8605 2.05699 7.3105C2.30999 6.7605 2.66199 6.2875 3.11299 5.8915C3.57499 5.4845 4.10849 5.204 4.71349 5.05C4.83449 4.423 5.08749 3.862 5.47249 3.367C5.86849 2.861 6.35249 2.465 6.92449 2.179C7.49649 1.893 8.10699 1.75 8.75599 1.75C9.30599 1.75 9.82849 1.8545 10.3235 2.0635C10.8185 2.2725 11.2585 2.564 11.6435 2.938C12.0615 2.795 12.496 2.7235 12.947 2.7235C13.684 2.7235 14.366 2.905 14.993 3.268C15.62 3.631 16.1205 4.126 16.4945 4.753C16.8795 5.38 17.072 6.0785 17.072 6.8485C17.072 7.1675 17.028 7.514 16.94 7.888C17.38 8.295 17.721 8.768 17.963 9.307C18.205 9.835 18.326 10.3905 18.326 10.9735C18.326 11.5675 18.1995 12.1395 17.9465 12.6895C17.6935 13.2395 17.336 13.718 16.874 14.125C16.423 14.521 15.895 14.796 15.29 14.95C15.169 15.577 14.9105 16.138 14.5145 16.633C14.1295 17.139 13.651 17.535 13.079 17.821C12.507 18.107 11.8965 18.25 11.2475 18.25ZM7.17199 16.1875C7.72199 16.1875 8.20049 16.072 8.60749 15.841L11.7095 14.059C11.8195 13.982 11.8745 13.8775 11.8745 13.7455V12.3265L7.88149 14.62C7.63949 14.763 7.39749 14.763 7.15549 14.62L4.03699 12.8215C4.03699 12.8545 4.03149 12.893 4.02049 12.937C4.02049 12.981 4.02049 13.047 4.02049 13.135C4.02049 13.696 4.15249 14.213 4.41649 14.686C4.69149 15.148 5.07099 15.511 5.55499 15.775C6.03899 16.05 6.57799 16.1875 7.17199 16.1875ZM7.33699 13.498C7.40299 13.531 7.46349 13.5475 7.51849 13.5475C7.57349 13.5475 7.62849 13.531 7.68349 13.498L8.92099 12.7885L4.94449 10.4785C4.70249 10.3355 4.58149 10.121 4.58149 9.835V6.2545C4.03149 6.4965 3.59149 6.8705 3.26149 7.3765C2.93149 7.8715 2.76649 8.4215 2.76649 9.0265C2.76649 9.5655 2.90399 10.0825 3.17899 10.5775C3.45399 11.0725 3.81149 11.4465 4.25149 11.6995L7.33699 13.498ZM11.2475 17.161C11.8305 17.161 12.3585 17.029 12.8315 16.765C13.3045 16.501 13.6785 16.138 13.9535 15.676C14.2285 15.214 14.366 14.697 14.366 14.125V10.561C14.366 10.429 14.311 10.33 14.201 10.264L12.947 9.538V14.1415C12.947 14.4275 12.826 14.642 12.584 14.785L9.46549 16.5835C10.0045 16.9685 10.5985 17.161 11.2475 17.161ZM11.8745 11.122V8.878L10.01 7.822L8.12899 8.878V11.122L10.01 12.178L11.8745 11.122ZM7.05649 5.8585C7.05649 5.5725 7.17749 5.358 7.41949 5.215L10.538 3.4165C9.99899 3.0315 9.40499 2.839 8.75599 2.839C8.17299 2.839 7.64499 2.971 7.17199 3.235C6.69899 3.499 6.32499 3.862 6.04999 4.324C5.78599 4.786 5.65399 5.303 5.65399 5.875V9.4225C5.65399 9.5545 5.70899 9.659 5.81899 9.736L7.05649 10.462V5.8585ZM15.4385 13.7455C15.9885 13.5035 16.423 13.1295 16.742 12.6235C17.072 12.1175 17.237 11.5675 17.237 10.9735C17.237 10.4345 17.0995 9.9175 16.8245 9.4225C16.5495 8.9275 16.192 8.5535 15.752 8.3005L12.6665 6.5185C12.6005 6.4745 12.54 6.458 12.485 6.469C12.43 6.469 12.375 6.4855 12.32 6.5185L11.0825 7.2115L15.0755 9.538C15.1965 9.604 15.2845 9.692 15.3395 9.802C15.4055 9.901 15.4385 10.022 15.4385 10.165V13.7455ZM12.122 5.3635C12.364 5.2095 12.606 5.2095 12.848 5.3635L15.983 7.195C15.983 7.118 15.983 7.019 15.983 6.898C15.983 6.37 15.851 5.8695 15.587 5.3965C15.334 4.9125 14.9655 4.5275 14.4815 4.2415C14.0085 3.9555 13.4585 3.8125 12.8315 3.8125C12.2815 3.8125 11.803 3.928 11.396 4.159L8.29399 5.941C8.18399 6.018 8.12899 6.1225 8.12899 6.2545V7.6735L12.122 5.3635Z"/>
        </svg>`;
      }

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';

      // 添加时间戳tooltip
      if (msg.timestamp && this.settings?.showTimestamp) {
        const date = new Date(msg.timestamp);
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        bubble.title = formatted;
      } else {
        bubble.removeAttribute('title');
      }

      // 处理消息内容显示
      let displayContent = '';

      // 显示附加的文件（分开显示）
      if (msg.attachedFiles && msg.attachedFiles.length > 0) {
        displayContent += '<div class="attached-files-display" style="margin-bottom: 12px;">';
        msg.attachedFiles.forEach(file => {
          if (file.type === 'image') {
            // 图片文件显示缩略图
            const imageItem = Array.isArray(msg.content) ? msg.content.find(item => item.type === 'image_url') : null;
            if (imageItem) {
              displayContent += `<div style="margin-bottom: 8px;">
                <img src="${imageItem.image_url.url}" style="max-width: 300px; max-height: 300px; border-radius: 8px; border: 1px solid var(--border-light);" alt="${file.name}">
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${file.name}</div>
              </div>`;
            }
          } else if (file.type === 'text') {
            // 文本文件显示文件名和图标
            displayContent += `<div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; margin-right: 8px; margin-bottom: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style="font-size: 13px;">${file.name}</span>
              <span style="font-size: 12px; color: var(--text-secondary);">${this.formatFileSize(file.size)}</span>
            </div>`;
          } else if (file.type === 'file') {
            // 其他文件
            displayContent += `<div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; margin-right: 8px; margin-bottom: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <span style="font-size: 13px;">${file.name}</span>
              <span style="font-size: 12px; color: var(--text-secondary);">${this.formatFileSize(file.size)}</span>
            </div>`;
          }
        });
        displayContent += '</div>';
      }

      // 显示用户输入的文本（不包含文件内容）
      const textToDisplay = msg.displayContent || msg.content;

      // 如果是 Vision API 格式的消息
      if (Array.isArray(msg.content)) {
        let textContent = '';

        msg.content.forEach(item => {
          if (item.type === 'text') {
            textContent = item.text;
          }
        });

        // 只显示用户输入的文本，不显示文件内容
        if (msg.displayContent) {
          displayContent += this.formatMessage(msg.displayContent);
        } else if (textContent) {
          displayContent += this.formatMessage(textContent);
        }
      } else {
        // 标准文本消息
        // Assistant消息使用renderMessageWithThinking处理思维链
        if (msg.role === 'assistant' && (msg.thinking || msg.content)) {
          displayContent += this.renderMessageWithThinking(msg, relatedChat);
        } else {
          // 用户消息或无thinking的消息
          if (msg.displayContent) {
            displayContent += this.formatMessage(msg.displayContent);
          } else {
            displayContent += this.formatMessage(msg.content);
          }
        }

        // 检查是否有生成的图片 URL（放在文字后面）
        if (msg.imageUrl) {
          displayContent += `<img src="${msg.imageUrl}" style="max-width: 512px; max-height: 512px; width: auto; height: auto; border-radius: 8px; margin: 8px 0; display: block;" alt="AI生成的图片">`;
        }
      }

      bubble.innerHTML = displayContent;
      this.bindImagePreview(bubble);

      // 添加代码复制按钮
      this.addCodeCopyButtons(bubble);

      // 创建消息内容容器
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';

      // 添加消息操作按钮
      const actions = document.createElement('div');
      actions.className = 'message-actions';

      if (msg.role === 'assistant') {
        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'message-action-btn';
        copyBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M12.668 10.667C12.668 9.95614 12.668 9.46258 12.6367 9.0791C12.6137 8.79732 12.5758 8.60761 12.5244 8.46387L12.4688 8.33399C12.3148 8.03193 12.0803 7.77885 11.793 7.60254L11.666 7.53125C11.508 7.45087 11.2963 7.39395 10.9209 7.36328C10.5374 7.33197 10.0439 7.33203 9.33301 7.33203H6.5C5.78896 7.33203 5.29563 7.33195 4.91211 7.36328C4.63016 7.38632 4.44065 7.42413 4.29688 7.47559L4.16699 7.53125C3.86488 7.68518 3.61186 7.9196 3.43555 8.20703L3.36524 8.33399C3.28478 8.49198 3.22795 8.70352 3.19727 9.0791C3.16595 9.46259 3.16504 9.95611 3.16504 10.667V13.5C3.16504 14.211 3.16593 14.7044 3.19727 15.0879C3.22797 15.4636 3.28473 15.675 3.36524 15.833L3.43555 15.959C3.61186 16.2466 3.86474 16.4807 4.16699 16.6348L4.29688 16.6914C4.44063 16.7428 4.63025 16.7797 4.91211 16.8027C5.29563 16.8341 5.78896 16.835 6.5 16.835H9.33301C10.0439 16.835 10.5374 16.8341 10.9209 16.8027C11.2965 16.772 11.508 16.7152 11.666 16.6348L11.793 16.5645C12.0804 16.3881 12.3148 16.1351 12.4688 15.833L12.5244 15.7031C12.5759 15.5594 12.6137 15.3698 12.6367 15.0879C12.6681 14.7044 12.668 14.211 12.668 13.5V10.667ZM13.998 12.665C14.4528 12.6634 14.8011 12.6602 15.0879 12.6367C15.4635 12.606 15.675 12.5492 15.833 12.4688L15.959 12.3975C16.2466 12.2211 16.4808 11.9682 16.6348 11.666L16.6914 11.5361C16.7428 11.3924 16.7797 11.2026 16.8027 10.9209C16.8341 10.5374 16.835 10.0439 16.835 9.33301V6.5C16.835 5.78896 16.8341 5.29563 16.8027 4.91211C16.7797 4.63025 16.7428 4.44063 16.6914 4.29688L16.6348 4.16699C16.4807 3.86474 16.2466 3.61186 15.959 3.43555L15.833 3.36524C15.675 3.28473 15.4636 3.22797 15.0879 3.19727C14.7044 3.16593 14.211 3.16504 13.5 3.16504H10.667C9.9561 3.16504 9.46259 3.16595 9.0791 3.19727C8.79739 3.22028 8.6076 3.2572 8.46387 3.30859L8.33399 3.36524C8.03176 3.51923 7.77886 3.75343 7.60254 4.04102L7.53125 4.16699C7.4508 4.32498 7.39397 4.53655 7.36328 4.91211C7.33985 5.19893 7.33562 5.54719 7.33399 6.00195H9.33301C10.022 6.00195 10.5791 6.00131 11.0293 6.03809C11.4873 6.07551 11.8937 6.15471 12.2705 6.34668L12.4883 6.46875C12.984 6.7728 13.3878 7.20854 13.6533 7.72949L13.7197 7.87207C13.8642 8.20859 13.9292 8.56974 13.9619 8.9707C13.9987 9.42092 13.998 9.97799 13.998 10.667V12.665ZM18.165 9.33301C18.165 10.022 18.1657 10.5791 18.1289 11.0293C18.0961 11.4302 18.0311 11.7914 17.8867 12.1279L17.8203 12.2705C17.5549 12.7914 17.1509 13.2272 16.6553 13.5313L16.4365 13.6533C16.0599 13.8452 15.6541 13.9245 15.1963 13.9619C14.8593 13.9895 14.4624 13.9935 13.9951 13.9951C13.9935 14.4624 13.9895 14.8593 13.9619 15.1963C13.9292 15.597 13.864 15.9576 13.7197 16.2939L13.6533 16.4365C13.3878 16.9576 12.9841 17.3941 12.4883 17.6982L12.2705 17.8203C11.8937 18.0123 11.4873 18.0915 11.0293 18.1289C10.5791 18.1657 10.022 18.165 9.33301 18.165H6.5C5.81091 18.165 5.25395 18.1657 4.80371 18.1289C4.40306 18.0962 4.04235 18.031 3.70606 17.8867L3.56348 17.8203C3.04244 17.5548 2.60585 17.151 2.30176 16.6553L2.17969 16.4365C1.98788 16.0599 1.90851 15.6541 1.87109 15.1963C1.83431 14.746 1.83496 14.1891 1.83496 13.5V10.667C1.83496 9.978 1.83432 9.42091 1.87109 8.9707C1.90851 8.5127 1.98772 8.10625 2.17969 7.72949L2.30176 7.51172C2.60586 7.0159 3.04236 6.6122 3.56348 6.34668L3.70606 6.28027C4.04237 6.136 4.40303 6.07083 4.80371 6.03809C5.14051 6.01057 5.53708 6.00551 6.00391 6.00391C6.00551 5.53708 6.01057 5.14051 6.03809 4.80371C6.0755 4.34588 6.15483 3.94012 6.34668 3.56348L6.46875 3.34473C6.77282 2.84912 7.20856 2.44514 7.72949 2.17969L7.87207 2.11328C8.20855 1.96886 8.56979 1.90385 8.9707 1.87109C9.42091 1.83432 9.978 1.83496 10.667 1.83496H13.5C14.1891 1.83496 14.746 1.83431 15.1963 1.87109C15.6541 1.90851 16.0599 1.98788 16.4365 2.17969L16.6553 2.30176C17.151 2.60585 17.5548 3.04244 17.8203 3.56348L17.8867 3.70606C18.031 4.04235 18.0962 4.40306 18.1289 4.80371C18.1657 5.25395 18.165 5.81091 18.165 6.5V9.33301Z"/>
        </svg>`;
        copyBtn.title = '复制';
        copyBtn.onclick = () => this.copyMessage(msg.content);
        actions.appendChild(copyBtn);

        // 重新生成按钮
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'message-action-btn';
        regenerateBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>`;
        regenerateBtn.title = '重新生成';
        regenerateBtn.onclick = () => this.regenerateResponse(index);
        actions.appendChild(regenerateBtn);
      } else if (msg.role === 'user') {
        const editBtn = document.createElement('button');
        editBtn.className = 'message-action-btn';
        editBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>`;
        editBtn.title = '编辑';
        editBtn.onclick = () => this.editMessage(index);
        actions.appendChild(editBtn);

        const resendBtn = document.createElement('button');
        resendBtn.className = 'message-action-btn';
        resendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>`;
        resendBtn.title = '重新发送';
        resendBtn.onclick = () => this.resendMessage(index);
        actions.appendChild(resendBtn);
      }

      messageContent.appendChild(bubble);
      messageContent.appendChild(actions);

      wrapper.appendChild(avatar);
      wrapper.appendChild(messageContent);
      group.appendChild(wrapper);
      container.appendChild(group);
    });

    // 给所有思维链添加点击事件监听
    this.initThinkingSectionListeners();

    // 滚动到底部
    setTimeout(() => {
      const wrapper = document.querySelector('.chat-wrapper');
      if (wrapper) {
        wrapper.scrollTop = wrapper.scrollHeight;
      }
    }, 100);
  }

  // 初始化思维链的展开/收起监听
  initThinkingSectionListeners() {
    document.querySelectorAll('.thinking-section').forEach(details => {
      // 检查是否已经添加过监听器
      if (details.dataset.listenerAdded === 'true') {
        return;
      }

      const summary = details.querySelector('.thinking-summary');
      if (!summary) return;

      // 标记已添加监听器
      details.dataset.listenerAdded = 'true';

      // 添加点击监听
      summary.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (details.hasAttribute('open')) {
          details.removeAttribute('open');
        } else {
          details.setAttribute('open', '');
        }
      });
    });
  }

  // 添加代码复制按钮和思考区域交互
  addCodeCopyButtons(element) {
    element.querySelectorAll('pre').forEach(pre => {
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = '复制代码';

      btn.onclick = () => {
        const code = pre.querySelector('code')?.textContent || pre.textContent;
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = '已复制!';
          setTimeout(() => btn.textContent = '复制代码', 2000);
        }).catch(err => {
          console.error('复制失败:', err);
          btn.textContent = '复制失败';
          setTimeout(() => btn.textContent = '复制代码', 2000);
        });
      };

      pre.appendChild(btn);
    });
  }

  // 复制消息
  copyMessage(content) {
    navigator.clipboard.writeText(content).then(() => {
      this.dialog.info('已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
      this.dialog.info('复制失败');
    });
  }

  // 编辑消息
  editMessage(index) {
    const chat = this.chats.find(c => c.id === this.currentChatId);
    if (!chat) return;

    const message = chat.messages[index];
    if (!message || message.role !== 'user') return;

    const input = document.getElementById('message-input');
    if (input) {
      input.value = message.content;
      input.focus();
      input.dispatchEvent(new Event('input'));

      // 删除该消息及之后的所有消息
      chat.messages = chat.messages.slice(0, index);
      this.saveChats();
      this.renderMessages(chat.messages);
    }
  }

  // 重新发送消息
  resendMessage(index) {
    const chat = this.chats.find(c => c.id === this.currentChatId);
    if (!chat) return;

    const message = chat.messages[index];
    if (!message || message.role !== 'user') return;

    // 删除该消息及之后的所有消息
    chat.messages = chat.messages.slice(0, index);
    this.saveChats();

    // 重新发送
    this.sendMessage(message.content);
  }

  // 重新生成回复
  async regenerateResponse(index) {
    const chat = this.chats.find(c => c.id === this.currentChatId);
    if (!chat) return;

    const message = chat.messages[index];
    if (!message || message.role !== 'assistant') return;

    // 删除当前assistant消息及之后的所有消息
    chat.messages = chat.messages.slice(0, index);
    this.saveChats();
    this.renderMessages(chat.messages);

    // 创建新的assistant消息占位符
    const assistantMsg = {
      role: 'assistant',
      content: '<span class="loading-dots"><span></span><span></span><span></span></span>',
      thinking: '',
      showThinking: !!chat.deepThinking,
      isLoading: true
    };
    chat.messages.push(assistantMsg);
    this.renderMessages(chat.messages);

    try {
      // 获取流式响应
      const stream = await this.callOpenAI(chat.messages.slice(0, -1));
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content;
            const reasoning = data.choices?.[0]?.delta?.reasoning_content ||
                            data.choices?.[0]?.delta?.thinking ||
                            data.reasoning;

            // 第一次接收到任何内容时,清空占位符
            if ((reasoning || delta) && assistantMsg.isLoading) {
              assistantMsg.content = '';
              assistantMsg.isLoading = false;
            }

            // 处理思考内容
            if (assistantMsg.showThinking && reasoning) {
              assistantMsg.thinking += reasoning;
            }

            // 处理正常内容
            if (delta) {
              assistantMsg.content += delta;
            }

            // 只要有内容更新就增量更新内容
            if (delta || reasoning) {
              const lastBubble = document.querySelector('.message-group.assistant:last-child .message-bubble');
              if (lastBubble) {
                lastBubble.querySelectorAll('.loading-dots').forEach(dot => dot.remove());
                let thinkingSection = lastBubble.querySelector('.thinking-section');

                // 如果有思考内容但还没有思维链区域,创建它
                if (!assistantMsg.showThinking && thinkingSection) {
                  thinkingSection.remove();
                  thinkingSection = null;
                }

                if (assistantMsg.showThinking && assistantMsg.thinking && !thinkingSection) {
                  const thinkingHTML = `
                    <details class="thinking-section" open>
                      <summary class="thinking-summary">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="thinking-icon">
                          <path d="M14.3352 10.0257C14.3352 7.6143 12.391 5.66554 10.0002 5.66537C7.60929 5.66537 5.66528 7.61419 5.66528 10.0257C5.66531 11.5493 6.44221 12.8881 7.61938 13.6683H12.3811C13.558 12.8881 14.3352 11.5491 14.3352 10.0257ZM8.84399 16.9984C9.07459 17.3983 9.50543 17.6683 10.0002 17.6683C10.495 17.6682 10.926 17.3984 11.1565 16.9984H8.84399ZM8.08813 15.6683H11.9114V14.9984H8.08813V15.6683ZM1.66626 9.33529L1.80103 9.34896C2.10381 9.41116 2.3313 9.67914 2.3313 10.0003C2.33115 10.3214 2.10377 10.5896 1.80103 10.6517L1.66626 10.6654H0.833252C0.466091 10.6654 0.168389 10.3674 0.168213 10.0003C0.168213 9.63306 0.465983 9.33529 0.833252 9.33529H1.66626ZM19.1663 9.33529L19.301 9.34896C19.6038 9.41116 19.8313 9.67914 19.8313 10.0003C19.8311 10.3214 19.6038 10.5896 19.301 10.6517L19.1663 10.6654H18.3333C17.9661 10.6654 17.6684 10.3674 17.6682 10.0003C17.6682 9.63306 17.966 9.33529 18.3333 9.33529H19.1663ZM3.0481 3.04818C3.2753 2.82099 3.62593 2.79189 3.88403 2.96224L3.98853 3.04818L4.57739 3.63705L4.66235 3.74154C4.83285 3.99966 4.80464 4.35021 4.57739 4.57748C4.35013 4.80474 3.99958 4.83293 3.74146 4.66244L3.63696 4.57748L3.0481 3.98861L2.96216 3.88412C2.79181 3.62601 2.82089 3.27538 3.0481 3.04818ZM16.012 3.04818C16.2717 2.7886 16.6927 2.78852 16.9524 3.04818C17.2117 3.30786 17.2119 3.72901 16.9524 3.98861L16.3625 4.57748C16.1028 4.83717 15.6818 4.83718 15.4221 4.57748C15.1626 4.31776 15.1625 3.89669 15.4221 3.63705L16.012 3.04818ZM9.33521 1.66634V0.833336C9.33521 0.466067 9.63297 0.168297 10.0002 0.168297C10.3674 0.168472 10.6653 0.466175 10.6653 0.833336V1.66634C10.6653 2.0335 10.3674 2.33121 10.0002 2.33138C9.63297 2.33138 9.33521 2.03361 9.33521 1.66634ZM15.6653 10.0257C15.6653 11.9571 14.7058 13.6634 13.2415 14.6917V16.3333C13.2415 16.7004 12.9444 16.9971 12.5774 16.9974C12.282 18.1473 11.2423 18.9982 10.0002 18.9984C8.75792 18.9984 7.71646 18.1476 7.42114 16.9974C7.05476 16.9964 6.75806 16.7 6.75806 16.3333V14.6917C5.29383 13.6634 4.33523 11.957 4.33521 10.0257C4.33521 6.88608 6.86835 4.33529 10.0002 4.33529C13.132 4.33547 15.6653 6.88618 15.6653 10.0257Z"></path>
                        </svg>
                        <span class="thinking-title">思维链</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" class="chevron-icon">
                          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                      </summary>
                      <div class="thinking-content"></div>
                    </details>
                  `;
                  const contentDiv = lastBubble.querySelector('.message-content') || lastBubble;
                  contentDiv.insertAdjacentHTML('afterbegin', thinkingHTML);

                  // 为新创建的思维链添加监听器
                  thinkingSection = lastBubble.querySelector('.thinking-section');
                  this.initThinkingSectionListeners();
                }

                // 更新思考内容
                if (assistantMsg.showThinking && thinkingSection && assistantMsg.thinking) {
                  const thinkingContent = thinkingSection.querySelector('.thinking-content');
                  if (thinkingContent) {
                    thinkingContent.innerHTML = this.formatMessage(assistantMsg.thinking);
                  }
                }

                // 更新或创建主内容区域
                let contentArea = lastBubble.querySelector('.message-content');
                if (!contentArea) {
                  contentArea = document.createElement('div');
                  contentArea.className = 'message-content';
                  lastBubble.appendChild(contentArea);
                }

                // 更新主内容
                contentArea.innerHTML = this.formatMessage(assistantMsg.content);
                this.bindImagePreview(lastBubble);

                // 添加代码复制按钮
                this.addCodeCopyButtons(lastBubble);
              }

              // 自动滚动
              const wrapper = document.querySelector('.chat-wrapper');
              if (wrapper) {
                const isNearBottom = wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight < 100;
                if (isNearBottom) {
                  wrapper.scrollTop = wrapper.scrollHeight;
                }
              }
            }
          } catch (e) {
            console.error('解析SSE数据失败:', e, line);
          }
        }
      }

      // 保存完整消息
      chat.updated = Date.now();
      this.saveChats();

      // 重新渲染完整消息列表,确保显示所有操作按钮
      this.renderMessages(chat.messages);

    } catch (error) {
      // 删除失败的消息
      chat.messages.pop();
      this.renderMessages(chat.messages);
      this.dialog.info('重新生成失败: ' + error.message);
    }
  }

  // 渲染包含思考过程的消息
  renderMessageWithThinking(msg, chat) {
    let html = '';

    // 如果有思考内容,先渲染思考区域
    if (this.shouldShowThinking(msg, chat)) {
      html += `
        <details class="thinking-section" open>
          <summary class="thinking-summary">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="thinking-icon">
              <path d="M14.3352 10.0257C14.3352 7.6143 12.391 5.66554 10.0002 5.66537C7.60929 5.66537 5.66528 7.61419 5.66528 10.0257C5.66531 11.5493 6.44221 12.8881 7.61938 13.6683H12.3811C13.558 12.8881 14.3352 11.5491 14.3352 10.0257ZM8.84399 16.9984C9.07459 17.3983 9.50543 17.6683 10.0002 17.6683C10.495 17.6682 10.926 17.3984 11.1565 16.9984H8.84399ZM8.08813 15.6683H11.9114V14.9984H8.08813V15.6683ZM1.66626 9.33529L1.80103 9.34896C2.10381 9.41116 2.3313 9.67914 2.3313 10.0003C2.33115 10.3214 2.10377 10.5896 1.80103 10.6517L1.66626 10.6654H0.833252C0.466091 10.6654 0.168389 10.3674 0.168213 10.0003C0.168213 9.63306 0.465983 9.33529 0.833252 9.33529H1.66626ZM19.1663 9.33529L19.301 9.34896C19.6038 9.41116 19.8313 9.67914 19.8313 10.0003C19.8311 10.3214 19.6038 10.5896 19.301 10.6517L19.1663 10.6654H18.3333C17.9661 10.6654 17.6684 10.3674 17.6682 10.0003C17.6682 9.63306 17.966 9.33529 18.3333 9.33529H19.1663ZM3.0481 3.04818C3.2753 2.82099 3.62593 2.79189 3.88403 2.96224L3.98853 3.04818L4.57739 3.63705L4.66235 3.74154C4.83285 3.99966 4.80464 4.35021 4.57739 4.57748C4.35013 4.80474 3.99958 4.83293 3.74146 4.66244L3.63696 4.57748L3.0481 3.98861L2.96216 3.88412C2.79181 3.62601 2.82089 3.27538 3.0481 3.04818ZM16.012 3.04818C16.2717 2.7886 16.6927 2.78852 16.9524 3.04818C17.2117 3.30786 17.2119 3.72901 16.9524 3.98861L16.3625 4.57748C16.1028 4.83717 15.6818 4.83718 15.4221 4.57748C15.1626 4.31776 15.1625 3.89669 15.4221 3.63705L16.012 3.04818ZM9.33521 1.66634V0.833336C9.33521 0.466067 9.63297 0.168297 10.0002 0.168297C10.3674 0.168472 10.6653 0.466175 10.6653 0.833336V1.66634C10.6653 2.0335 10.3674 2.33121 10.0002 2.33138C9.63297 2.33138 9.33521 2.03361 9.33521 1.66634ZM15.6653 10.0257C15.6653 11.9571 14.7058 13.6634 13.2415 14.6917V16.3333C13.2415 16.7004 12.9444 16.9971 12.5774 16.9974C12.282 18.1473 11.2423 18.9982 10.0002 18.9984C8.75792 18.9984 7.71646 18.1476 7.42114 16.9974C7.05476 16.9964 6.75806 16.7 6.75806 16.3333V14.6917C5.29383 13.6634 4.33523 11.957 4.33521 10.0257C4.33521 6.88608 6.86835 4.33529 10.0002 4.33529C13.132 4.33547 15.6653 6.88618 15.6653 10.0257Z"></path>
            </svg>
            <span class="thinking-title">思维链</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" class="chevron-icon">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </summary>
          <div class="thinking-content">
            ${this.formatMessage(msg.thinking)}
          </div>
        </details>
      `;
    }

    // 渲染正常回复内容
    html += this.formatMessage(msg.content || '');

    return html;
  }

  // 判断当前消息是否需要展示思维链
  shouldShowThinking(msg, chat) {
    if (!msg || !msg.thinking || !msg.thinking.trim()) {
      return false;
    }

    if (typeof msg.showThinking !== 'undefined') {
      return !!msg.showThinking;
    }

    if (chat && typeof chat.deepThinking !== 'undefined') {
      return !!chat.deepThinking;
    }

    return false;
  }

  // 格式化消息 - 使用Markdown渲染
  formatMessage(content) {
    // 配置marked选项
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        highlight: function(code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) {
              console.error('代码高亮失败:', e);
            }
          }
          return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
        },
        breaks: true, // 支持GitHub风格的换行
        gfm: true, // 启用GitHub风格Markdown
        tables: true, // 支持表格
        sanitize: false, // 允许HTML
        headerIds: false // 禁用header ID
      });

      // 使用marked渲染Markdown
      return marked.parse(content);
    }

    // 降级方案：基础HTML转义和格式化
    content = content.replace(/&/g, '&amp;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;');
    content = content.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="$1">$2</code></pre>');
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    content = content.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('');
    return content;
  }

  // 文件转base64
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 读取文件内容为文本
  async fileToText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 发送消息 - 流式版本
  async sendMessage(content) {
    if (!content.trim() && this.attachedFiles.length === 0) return;

    const chat = this.chats.find(c => c.id === this.currentChatId);
    if (!chat) return;

    // 检查是否是生图模式
    if (this.imageGenMode && this.attachedFiles.length === 0) {
      // 处理生图请求
      await this.generateImage(content, chat);
      return;
    }

    // 处理附件 - 只处理图片，其他文件仅显示信息
    const imageContents = [];
    const fileContents = []; // 存储文件内容，用于发送给API
    const attachedFileInfo = []; // 存储文件信息，用于UI显示

    if (this.attachedFiles.length > 0) {
      for (const file of this.attachedFiles) {
        if (file.type.startsWith('image/')) {
          // 处理图片文件 - Vision API 支持
          const base64 = await this.fileToBase64(file);
          imageContents.push({
            type: 'image_url',
            image_url: {
              url: base64,
              detail: 'auto'
            }
          });
          attachedFileInfo.push({ name: file.name, type: 'image', size: file.size });
        } else if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|js|json|html|css|py|java|cpp|c|h|xml|csv|log)$/i)) {
          // 读取文本文件内容
          try {
            const textContent = await this.fileToText(file);
            fileContents.push(`[文件: ${file.name}]\n\`\`\`\n${textContent}\n\`\`\``);
            attachedFileInfo.push({ name: file.name, type: 'text', size: file.size, content: textContent });
          } catch (e) {
            attachedFileInfo.push({ name: file.name, type: 'error', size: file.size });
          }
        } else {
          // 其他文件只显示基本信息，不读取内容
          attachedFileInfo.push({ name: file.name, type: 'file', size: file.size });
        }
      }
    }

    // 创建API消息内容（包含文件内容）
    let apiMessageContent = content;
    if (fileContents.length > 0) {
      apiMessageContent = fileContents.join('\n\n') + (content ? `\n\n${content}` : '');
    }

    // 创建用户消息
    const timestamp = new Date().toISOString();
    let userMsg;
    if (imageContents.length > 0) {
      // Vision API 格式的消息
      userMsg = {
        role: 'user',
        content: [
          { type: 'text', text: apiMessageContent },
          ...imageContents
        ],
        displayContent: content, // 用于UI显示的纯文本
        attachedFiles: attachedFileInfo,
        timestamp: timestamp
      };
    } else {
      // 标准文本消息
      userMsg = {
        role: 'user',
        content: apiMessageContent,
        displayContent: content, // 用于UI显示的纯文本
        attachedFiles: attachedFileInfo.length > 0 ? attachedFileInfo : undefined,
        timestamp: timestamp
      };
    }

    chat.messages.push(userMsg);

    // 清空附件列表
    this.attachedFiles = [];
    this.renderAttachedFiles();

    // 更新标题
    if (chat.messages.length === 1) {
      chat.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }

    chat.updated = Date.now();
    this.saveChats();
    this.hideWelcomeScreen();
    this.renderMessages(chat.messages);
    this.renderChatList();

    // 创建助手消息占位符
    const assistantMsg = {
      role: 'assistant',
      content: '<span class="loading-dots"><span></span><span></span><span></span></span>',
      thinking: '',
      showThinking: !!chat.deepThinking,
      timestamp: new Date().toISOString(),
      isLoading: true
    };
    chat.messages.push(assistantMsg);
    this.renderMessages(chat.messages);

    try {
      // 获取流式响应
      const stream = await this.callOpenAI(chat.messages.slice(0, -1));
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content;
            const reasoning = data.choices?.[0]?.delta?.reasoning_content ||
                            data.choices?.[0]?.delta?.thinking ||
                            data.reasoning;

            // 第一次接收到任何内容时,清空占位符
            if ((reasoning || delta) && assistantMsg.isLoading) {
              assistantMsg.content = '';
              assistantMsg.isLoading = false;
            }

            // 处理思考内容
            if (assistantMsg.showThinking && reasoning) {
              assistantMsg.thinking += reasoning;
            }

            // 处理正常内容
            if (delta) {
              assistantMsg.content += delta;
            }

            // 只要有内容更新就增量更新内容
            if (delta || reasoning) {
              const lastBubble = document.querySelector('.message-group.assistant:last-child .message-bubble');
              if (lastBubble) {
                lastBubble.querySelectorAll('.loading-dots').forEach(dot => dot.remove());
                let thinkingSection = lastBubble.querySelector('.thinking-section');

                if (!assistantMsg.showThinking && thinkingSection) {
                  thinkingSection.remove();
                  thinkingSection = null;
                }

                // 如果有思考内容但还没有思维链区域,创建它
                if (assistantMsg.showThinking && assistantMsg.thinking && !thinkingSection) {
                  const thinkingHTML = `
                    <details class="thinking-section" open>
                      <summary class="thinking-summary">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="thinking-icon">
                          <path d="M14.3352 10.0257C14.3352 7.6143 12.391 5.66554 10.0002 5.66537C7.60929 5.66537 5.66528 7.61419 5.66528 10.0257C5.66531 11.5493 6.44221 12.8881 7.61938 13.6683H12.3811C13.558 12.8881 14.3352 11.5491 14.3352 10.0257ZM8.84399 16.9984C9.07459 17.3983 9.50543 17.6683 10.0002 17.6683C10.495 17.6682 10.926 17.3984 11.1565 16.9984H8.84399ZM8.08813 15.6683H11.9114V14.9984H8.08813V15.6683ZM1.66626 9.33529L1.80103 9.34896C2.10381 9.41116 2.3313 9.67914 2.3313 10.0003C2.33115 10.3214 2.10377 10.5896 1.80103 10.6517L1.66626 10.6654H0.833252C0.466091 10.6654 0.168389 10.3674 0.168213 10.0003C0.168213 9.63306 0.465983 9.33529 0.833252 9.33529H1.66626ZM19.1663 9.33529L19.301 9.34896C19.6038 9.41116 19.8313 9.67914 19.8313 10.0003C19.8311 10.3214 19.6038 10.5896 19.301 10.6517L19.1663 10.6654H18.3333C17.9661 10.6654 17.6684 10.3674 17.6682 10.0003C17.6682 9.63306 17.966 9.33529 18.3333 9.33529H19.1663ZM3.0481 3.04818C3.2753 2.82099 3.62593 2.79189 3.88403 2.96224L3.98853 3.04818L4.57739 3.63705L4.66235 3.74154C4.83285 3.99966 4.80464 4.35021 4.57739 4.57748C4.35013 4.80474 3.99958 4.83293 3.74146 4.66244L3.63696 4.57748L3.0481 3.98861L2.96216 3.88412C2.79181 3.62601 2.82089 3.27538 3.0481 3.04818ZM16.012 3.04818C16.2717 2.7886 16.6927 2.78852 16.9524 3.04818C17.2117 3.30786 17.2119 3.72901 16.9524 3.98861L16.3625 4.57748C16.1028 4.83717 15.6818 4.83718 15.4221 4.57748C15.1626 4.31776 15.1625 3.89669 15.4221 3.63705L16.012 3.04818ZM9.33521 1.66634V0.833336C9.33521 0.466067 9.63297 0.168297 10.0002 0.168297C10.3674 0.168472 10.6653 0.466175 10.6653 0.833336V1.66634C10.6653 2.0335 10.3674 2.33121 10.0002 2.33138C9.63297 2.33138 9.33521 2.03361 9.33521 1.66634ZM15.6653 10.0257C15.6653 11.9571 14.7058 13.6634 13.2415 14.6917V16.3333C13.2415 16.7004 12.9444 16.9971 12.5774 16.9974C12.282 18.1473 11.2423 18.9982 10.0002 18.9984C8.75792 18.9984 7.71646 18.1476 7.42114 16.9974C7.05476 16.9964 6.75806 16.7 6.75806 16.3333V14.6917C5.29383 13.6634 4.33523 11.957 4.33521 10.0257C4.33521 6.88608 6.86835 4.33529 10.0002 4.33529C13.132 4.33547 15.6653 6.88618 15.6653 10.0257Z"></path>
                        </svg>
                        <span class="thinking-title">思维链</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" class="chevron-icon">
                          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                      </summary>
                      <div class="thinking-content"></div>
                    </details>
                  `;
                  lastBubble.insertAdjacentHTML('afterbegin', thinkingHTML);

                  // 为新创建的思维链添加监听器
                  thinkingSection = lastBubble.querySelector('.thinking-section');
                  this.initThinkingSectionListeners();
                }

                // 更新思考内容
                if (assistantMsg.showThinking && thinkingSection && assistantMsg.thinking) {
                  const thinkingContent = thinkingSection.querySelector('.thinking-content');
                  if (thinkingContent) {
                    thinkingContent.innerHTML = this.formatMessage(assistantMsg.thinking);
                  }
                }

                // 找到或创建主内容容器
                let mainContent = lastBubble.querySelector('.main-content');
                if (!mainContent) {
                  mainContent = document.createElement('div');
                  mainContent.className = 'main-content';
                  lastBubble.appendChild(mainContent);
                }

                // 更新主内容
                mainContent.innerHTML = this.formatMessage(assistantMsg.content);
                this.bindImagePreview(lastBubble);
                // 添加代码复制按钮
                this.addCodeCopyButtons(lastBubble);

                // 更新或创建消息操作按钮
                const messageContent = lastBubble.parentElement;
                let actions = messageContent.querySelector('.message-actions');

                if (!actions) {
                  actions = document.createElement('div');
                  actions.className = 'message-actions';
                  messageContent.appendChild(actions);
                }

                actions.innerHTML = '';
                const copyBtn = document.createElement('button');
                copyBtn.className = 'message-action-btn';
                copyBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M12.668 10.667C12.668 9.95614 12.668 9.46258 12.6367 9.0791C12.6137 8.79732 12.5758 8.60761 12.5244 8.46387L12.4688 8.33399C12.3148 8.03193 12.0803 7.77885 11.793 7.60254L11.666 7.53125C11.508 7.45087 11.2963 7.39395 10.9209 7.36328C10.5374 7.33197 10.0439 7.33203 9.33301 7.33203H6.5C5.78896 7.33203 5.29563 7.33195 4.91211 7.36328C4.63016 7.38632 4.44065 7.42413 4.29688 7.47559L4.16699 7.53125C3.86488 7.68518 3.61186 7.9196 3.43555 8.20703L3.36524 8.33399C3.28478 8.49198 3.22795 8.70352 3.19727 9.0791C3.16595 9.46259 3.16504 9.95611 3.16504 10.667V13.5C3.16504 14.211 3.16593 14.7044 3.19727 15.0879C3.22797 15.4636 3.28473 15.675 3.36524 15.833L3.43555 15.959C3.61186 16.2466 3.86474 16.4807 4.16699 16.6348L4.29688 16.6914C4.44063 16.7428 4.63025 16.7797 4.91211 16.8027C5.29563 16.8341 5.78896 16.835 6.5 16.835H9.33301C10.0439 16.835 10.5374 16.8341 10.9209 16.8027C11.2965 16.772 11.508 16.7152 11.666 16.6348L11.793 16.5645C12.0804 16.3881 12.3148 16.1351 12.4688 15.833L12.5244 15.7031C12.5759 15.5594 12.6137 15.3698 12.6367 15.0879C12.6681 14.7044 12.668 14.211 12.668 13.5V10.667ZM13.998 12.665C14.4528 12.6634 14.8011 12.6602 15.0879 12.6367C15.4635 12.606 15.675 12.5492 15.833 12.4688L15.959 12.3975C16.2466 12.2211 16.4808 11.9682 16.6348 11.666L16.6914 11.5361C16.7428 11.3924 16.7797 11.2026 16.8027 10.9209C16.8341 10.5374 16.835 10.0439 16.835 9.33301V6.5C16.835 5.78896 16.8341 5.29563 16.8027 4.91211C16.7797 4.63025 16.7428 4.44063 16.6914 4.29688L16.6348 4.16699C16.4807 3.86474 16.2466 3.61186 15.959 3.43555L15.833 3.36524C15.675 3.28473 15.4636 3.22797 15.0879 3.19727C14.7044 3.16593 14.211 3.16504 13.5 3.16504H10.667C9.9561 3.16504 9.46259 3.16595 9.0791 3.19727C8.79739 3.22028 8.6076 3.2572 8.46387 3.30859L8.33399 3.36524C8.03176 3.51923 7.77886 3.75343 7.60254 4.04102L7.53125 4.16699C7.4508 4.32498 7.39397 4.53655 7.36328 4.91211C7.33985 5.19893 7.33562 5.54719 7.33399 6.00195H9.33301C10.022 6.00195 10.5791 6.00131 11.0293 6.03809C11.4873 6.07551 11.8937 6.15471 12.2705 6.34668L12.4883 6.46875C12.984 6.7728 13.3878 7.20854 13.6533 7.72949L13.7197 7.87207C13.8642 8.20859 13.9292 8.56974 13.9619 8.9707C13.9987 9.42092 13.998 9.97799 13.998 10.667V12.665ZM18.165 9.33301C18.165 10.022 18.1657 10.5791 18.1289 11.0293C18.0961 11.4302 18.0311 11.7914 17.8867 12.1279L17.8203 12.2705C17.5549 12.7914 17.1509 13.2272 16.6553 13.5313L16.4365 13.6533C16.0599 13.8452 15.6541 13.9245 15.1963 13.9619C14.8593 13.9895 14.4624 13.9935 13.9951 13.9951C13.9935 14.4624 13.9895 14.8593 13.9619 15.1963C13.9292 15.597 13.864 15.9576 13.7197 16.2939L13.6533 16.4365C13.3878 16.9576 12.9841 17.3941 12.4883 17.6982L12.2705 17.8203C11.8937 18.0123 11.4873 18.0915 11.0293 18.1289C10.5791 18.1657 10.022 18.165 9.33301 18.165H6.5C5.81091 18.165 5.25395 18.1657 4.80371 18.1289C4.40306 18.0962 4.04235 18.031 3.70606 17.8867L3.56348 17.8203C3.04244 17.5548 2.60585 17.151 2.30176 16.6553L2.17969 16.4365C1.98788 16.0599 1.90851 15.6541 1.87109 15.1963C1.83431 14.746 1.83496 14.1891 1.83496 13.5V10.667C1.83496 9.978 1.83432 9.42091 1.87109 8.9707C1.90851 8.5127 1.98772 8.10625 2.17969 7.72949L2.30176 7.51172C2.60586 7.0159 3.04236 6.6122 3.56348 6.34668L3.70606 6.28027C4.04237 6.136 4.40303 6.07083 4.80371 6.03809C5.14051 6.01057 5.53708 6.00551 6.00391 6.00391C6.00551 5.53708 6.01057 5.14051 6.03809 4.80371C6.0755 4.34588 6.15483 3.94012 6.34668 3.56348L6.46875 3.34473C6.77282 2.84912 7.20856 2.44514 7.72949 2.17969L7.87207 2.11328C8.20855 1.96886 8.56979 1.90385 8.9707 1.87109C9.42091 1.83432 9.978 1.83496 10.667 1.83496H13.5C14.1891 1.83496 14.746 1.83431 15.1963 1.87109C15.6541 1.90851 16.0599 1.98788 16.4365 2.17969L16.6553 2.30176C17.151 2.60585 17.5548 3.04244 17.8203 3.56348L17.8867 3.70606C18.031 4.04235 18.0962 4.40306 18.1289 4.80371C18.1657 5.25395 18.165 5.81091 18.165 6.5V9.33301Z"/>
                </svg>`;
                copyBtn.title = '复制';
                copyBtn.onclick = () => this.copyMessage(assistantMsg.content);
                actions.appendChild(copyBtn);
              }

              // 自动滚动
              const wrapper = document.querySelector('.chat-wrapper');
              if (wrapper) {
                const isNearBottom = wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight < 100;
                if (isNearBottom) {
                  wrapper.scrollTop = wrapper.scrollHeight;
                }
              }
            }
          } catch (e) {
            console.error('解析SSE数据失败:', e, line);
          }
        }
      }

      // 保存完整消息
      chat.updated = Date.now();
      this.saveChats();

      // 重新渲染完整消息列表,确保显示所有操作按钮
      this.renderMessages(chat.messages);

    } catch (error) {
      // 删除失败的消息
      chat.messages.pop();
      this.renderMessages(chat.messages);
      this.dialog.info('发送失败: ' + error.message);
    }
  }

  // 选择功能选项
  selectOption(option) {
    this.currentOption = option;

    // 图标映射
    const icons = {
      'none': '<path d="M10 3C10.5523 3 11 3.44772 11 4C11 4.55228 10.5523 5 10 5C9.44772 5 9 4.55228 9 4C9 3.44772 9.44772 3 10 3ZM10 9C10.5523 9 11 9.44772 11 10C11 10.5523 10.5523 11 10 11C9.44772 11 9 10.5523 9 10C9 9.44772 9.44772 9 10 9ZM10 15C10.5523 15 11 15.4477 11 16C11 16.5523 10.5523 17 10 17C9.44772 17 9 16.5523 9 16C9 15.4477 9.44772 15 10 15Z"></path>',
      'attach': '<path d="M4.33496 12.5V7.5C4.33496 7.13273 4.63273 6.83496 5 6.83496C5.36727 6.83496 5.66504 7.13273 5.66504 7.5V12.5C5.66504 14.8942 7.60585 16.835 10 16.835C12.3942 16.835 14.335 14.8942 14.335 12.5V5.83301C14.3348 4.35959 13.1404 3.16522 11.667 3.16504C10.1934 3.16504 8.99822 4.35948 8.99805 5.83301V12.5C8.99805 13.0532 9.44679 13.502 10 13.502C10.5532 13.502 11.002 13.0532 11.002 12.5V7.5C11.002 7.13273 11.2997 6.83496 11.667 6.83496C12.0341 6.83514 12.332 7.13284 12.332 7.5V12.5C12.332 13.7877 11.2877 14.832 10 14.832C8.71226 14.832 7.66797 13.7877 7.66797 12.5V5.83301C7.66814 3.62494 9.45888 1.83496 11.667 1.83496C13.875 1.83514 15.6649 3.62505 15.665 5.83301V12.5C15.665 15.6287 13.1287 18.165 10 18.165C6.87131 18.165 4.33496 15.6287 4.33496 12.5Z"></path>',
      'image': '<path d="M9.38759 8.53403C10.0712 8.43795 10.7036 8.91485 10.7997 9.59849C10.8956 10.2819 10.4195 10.9133 9.73622 11.0096C9.05259 11.1057 8.4202 10.6298 8.32411 9.94614C8.22804 9.26258 8.70407 8.63022 9.38759 8.53403Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M10.3886 5.58677C10.8476 5.5681 11.2608 5.5975 11.6581 5.74204L11.8895 5.83677C12.4185 6.07813 12.8721 6.46152 13.1991 6.94614L13.2831 7.07993C13.4673 7.39617 13.5758 7.74677 13.6571 8.14048C13.7484 8.58274 13.8154 9.13563 13.8993 9.81919L14.245 12.6317L14.3554 13.5624C14.3852 13.8423 14.4067 14.0936 14.4159 14.3192C14.4322 14.7209 14.4118 15.0879 14.3095 15.4393L14.2606 15.5887C14.0606 16.138 13.7126 16.6202 13.2577 16.9823L13.0565 17.1297C12.7061 17.366 12.312 17.4948 11.8622 17.5877C11.6411 17.6334 11.3919 17.673 11.1132 17.7118L10.1835 17.8299L7.37098 18.1756C6.68748 18.2596 6.13466 18.3282 5.68348 18.3465C5.28176 18.3628 4.9148 18.3424 4.56337 18.2401L4.41395 18.1913C3.86454 17.9912 3.38258 17.6432 3.0204 17.1883L2.87294 16.9872C2.63655 16.6367 2.50788 16.2427 2.41493 15.7928C2.36926 15.5717 2.32964 15.3226 2.29091 15.0438L2.17274 14.1141L1.82704 11.3016C1.74311 10.6181 1.67455 10.0653 1.65614 9.61411C1.63747 9.15518 1.66697 8.74175 1.81141 8.34458L1.90614 8.11313C2.14741 7.58441 2.53115 7.13051 3.01552 6.80356L3.1493 6.71958C3.46543 6.53545 3.8163 6.42688 4.20985 6.34556C4.65206 6.25423 5.20506 6.18729 5.88856 6.10337L8.70106 5.75767L9.63173 5.64731C9.91161 5.61744 10.163 5.59597 10.3886 5.58677ZM6.75673 13.0594C6.39143 12.978 6.00943 13.0106 5.66298 13.1522C5.5038 13.2173 5.32863 13.3345 5.06923 13.5829C4.80403 13.8368 4.49151 14.1871 4.04091 14.6932L3.64833 15.1327C3.67072 15.2763 3.69325 15.4061 3.71766 15.5243C3.79389 15.893 3.87637 16.0961 3.97548 16.243L4.06141 16.3602C4.27134 16.6237 4.5507 16.8253 4.86903 16.9413L5.00477 16.9813C5.1536 17.0148 5.34659 17.0289 5.6288 17.0174C6.01317 17.0018 6.50346 16.9419 7.20888 16.8553L10.0214 16.5106L10.9306 16.3944C11.0173 16.3824 11.0997 16.3693 11.1776 16.3573L8.61513 14.3065C8.08582 13.8831 7.71807 13.5905 7.41395 13.3846C7.19112 13.2338 7.02727 13.1469 6.88856 13.0975L6.75673 13.0594ZM10.4432 6.91587C10.2511 6.9237 10.0319 6.94288 9.77333 6.97056L8.86317 7.07798L6.05067 7.42271C5.34527 7.50932 4.85514 7.57047 4.47841 7.64829C4.20174 7.70549 4.01803 7.76626 3.88173 7.83481L3.75966 7.9061C3.47871 8.09575 3.25597 8.35913 3.1161 8.66587L3.06141 8.79966C3.00092 8.96619 2.96997 9.18338 2.98524 9.55942C3.00091 9.94382 3.06074 10.4341 3.14735 11.1395L3.42274 13.3895L3.64442 13.1434C3.82631 12.9454 3.99306 12.7715 4.1493 12.6219C4.46768 12.3171 4.78299 12.0748 5.16005 11.9208L5.38661 11.8377C5.92148 11.6655 6.49448 11.6387 7.04579 11.7616L7.19325 11.7987C7.53151 11.897 7.8399 12.067 8.15907 12.2831C8.51737 12.5256 8.9325 12.8582 9.4452 13.2684L12.5966 15.7889C12.7786 15.6032 12.9206 15.3806 13.0106 15.1336L13.0507 14.9979C13.0842 14.8491 13.0982 14.6561 13.0868 14.3739C13.079 14.1817 13.0598 13.9625 13.0321 13.704L12.9247 12.7938L12.58 9.9813C12.4933 9.27584 12.4322 8.78581 12.3544 8.40903C12.2972 8.13219 12.2364 7.94873 12.1679 7.81235L12.0966 7.69028C11.9069 7.40908 11.6437 7.18669 11.3368 7.04673L11.203 6.99204C11.0364 6.93147 10.8195 6.90059 10.4432 6.91587Z"></path>',
      'thinking': '<path d="M14.3352 10.0257C14.3352 7.6143 12.391 5.66554 10.0002 5.66537C7.60929 5.66537 5.66528 7.61419 5.66528 10.0257C5.66531 11.5493 6.44221 12.8881 7.61938 13.6683H12.3811C13.558 12.8881 14.3352 11.5491 14.3352 10.0257ZM8.84399 16.9984C9.07459 17.3983 9.50543 17.6683 10.0002 17.6683C10.495 17.6682 10.926 17.3984 11.1565 16.9984H8.84399ZM8.08813 15.6683H11.9114V14.9984H8.08813V15.6683ZM1.66626 9.33529L1.80103 9.34896C2.10381 9.41116 2.3313 9.67914 2.3313 10.0003C2.33115 10.3214 2.10377 10.5896 1.80103 10.6517L1.66626 10.6654H0.833252C0.466091 10.6654 0.168389 10.3674 0.168213 10.0003C0.168213 9.63306 0.465983 9.33529 0.833252 9.33529H1.66626ZM19.1663 9.33529L19.301 9.34896C19.6038 9.41116 19.8313 9.67914 19.8313 10.0003C19.8311 10.3214 19.6038 10.5896 19.301 10.6517L19.1663 10.6654H18.3333C17.9661 10.6654 17.6684 10.3674 17.6682 10.0003C17.6682 9.63306 17.966 9.33529 18.3333 9.33529H19.1663ZM3.0481 3.04818C3.2753 2.82099 3.62593 2.79189 3.88403 2.96224L3.98853 3.04818L4.57739 3.63705L4.66235 3.74154C4.83285 3.99966 4.80464 4.35021 4.57739 4.57748C4.35013 4.80474 3.99958 4.83293 3.74146 4.66244L3.63696 4.57748L3.0481 3.98861L2.96216 3.88412C2.79181 3.62601 2.82089 3.27538 3.0481 3.04818ZM16.012 3.04818C16.2717 2.7886 16.6927 2.78852 16.9524 3.04818C17.2117 3.30786 17.2119 3.72901 16.9524 3.98861L16.3625 4.57748C16.1028 4.83717 15.6818 4.83718 15.4221 4.57748C15.1626 4.31776 15.1625 3.89669 15.4221 3.63705L16.012 3.04818ZM9.33521 1.66634V0.833336C9.33521 0.466067 9.63297 0.168297 10.0002 0.168297C10.3674 0.168472 10.6653 0.466175 10.6653 0.833336V1.66634C10.6653 2.0335 10.3674 2.33121 10.0002 2.33138C9.63297 2.33138 9.33521 2.03361 9.33521 1.66634ZM15.6653 10.0257C15.6653 11.9571 14.7058 13.6634 13.2415 14.6917V16.3333C13.2415 16.7004 12.9444 16.9971 12.5774 16.9974C12.282 18.1473 11.2423 18.9982 10.0002 18.9984C8.75792 18.9984 7.71646 18.1476 7.42114 16.9974C7.05476 16.9964 6.75806 16.7 6.75806 16.3333V14.6917C5.29383 13.6634 4.33523 11.957 4.33521 10.0257C4.33521 6.88608 6.86835 4.33529 10.0002 4.33529C13.132 4.33547 15.6653 6.88618 15.6653 10.0257Z"></path>'
    };

    // 更新菜单按钮状态和图标
    const optionsMenuBtn = document.getElementById('options-menu-btn');
    if (optionsMenuBtn) {
      const svg = optionsMenuBtn.querySelector('svg');
      if (svg && icons[option]) {
        svg.innerHTML = icons[option];
      }

      if (option !== 'none') {
        optionsMenuBtn.classList.add('active');
      } else {
        optionsMenuBtn.classList.remove('active');
      }
    }

    // 更新所有选项的选中状态
    document.querySelectorAll('.options-item').forEach(item => {
      if (item.dataset.option === option) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    const input = document.getElementById('message-input');
    const fileUpload = document.getElementById('file-upload');
    const chat = this.chats.find(c => c.id === this.currentChatId);

    // 根据选项执行相应操作
    switch (option) {
      case 'none':
        this.imageGenMode = false;
        if (chat) chat.deepThinking = false;
        if (input) input.placeholder = '给 ChatGPT 发送消息';
        break;

      case 'attach':
        this.imageGenMode = false;
        if (chat) chat.deepThinking = false;
        if (input) input.placeholder = '给 ChatGPT 发送消息';
        // 触发文件选择
        fileUpload?.click();
        break;

      case 'image':
        this.imageGenMode = true;
        if (chat) chat.deepThinking = false;
        if (input) input.placeholder = '描述您想生成的图片...';
        break;

      case 'thinking':
        this.imageGenMode = false;
        if (chat) {
          chat.deepThinking = true;
          this.saveChats();
        }
        if (input) input.placeholder = '给 ChatGPT 发送消息 (深度思考模式)';
        break;
    }
  }

  // 获取API基础URL（去除多余路径）
  getBaseApiUrl() {
    let url = this.apiUrl;
    // 移除末尾的 /chat/completions 或 /completions
    url = url.replace(/\/chat\/completions\/?$/, '');
    url = url.replace(/\/completions\/?$/, '');
    return url;
  }

  // 调用OpenAI API - 流式输出
  async callOpenAI(messages) {
    if (!this.apiKey) {
      throw new Error('请先在API设置中配置API Key');
    }

    // 处理消息格式，为 Vision API 准备
    // 重要: 移除 thinking 字段,因为思维链不应该被发送到下一轮对话
    const processedMessages = messages.map(msg => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        // Vision API 格式，保持原样
        return {
          role: msg.role,
          content: msg.content
        };
      } else {
        // 标准格式，只保留 role 和 content
        return {
          role: msg.role,
          content: msg.content
        };
      }
    });

    // 合并全局提示词和会话提示词
    const chat = this.chats.find(c => c.id === this.currentChatId);
    let systemContent = '';

    if (this.systemPrompt && this.systemPrompt.trim()) {
      systemContent = this.systemPrompt.trim();
    }

    if (chat && chat.sessionPrompt && chat.sessionPrompt.trim()) {
      if (systemContent) {
        systemContent += '\n\n' + chat.sessionPrompt.trim();
      } else {
        systemContent = chat.sessionPrompt.trim();
      }
    }

    // 如果有系统提示词,插入到消息列表最前面
    if (systemContent) {
      processedMessages.unshift({
        role: 'system',
        content: systemContent
      });
    }

    const model = this.currentModel;

    // 检测是否包含图片
    const hasImages = messages.some(msg =>
      Array.isArray(msg.content) &&
      msg.content.some(c => c.type === 'image_url')
    );

    // 构建请求体
    const requestBody = {
      model: model,
      messages: processedMessages,
      temperature: 0.7,
      stream: true,  // 启用流式输出
      max_tokens: hasImages ? 4096 : undefined  // Vision API 可能需要更多tokens
    };

    // 如果开启深度思考,注入思考参数
    if (chat && chat.deepThinking) {
      // 检测模型类型并注入对应的思考参数
      const modelLower = model.toLowerCase();

      if (modelLower.includes('deepseek')) {
        // DeepSeek 使用 reasoningEffort
        requestBody.reasoningEffort = 'high';
      } else if (modelLower.includes('o1') || modelLower.includes('o3')) {
        // OpenAI o1/o3 系列使用 reasoning_effort
        requestBody.reasoning_effort = 'high';
      } else if (modelLower.includes('gemini')) {
        // Gemini 使用 thinkingConfig
        requestBody.thinkingConfig = { mode: 'EXTENDED' };
      } else if (modelLower.includes('qwen')) {
        // Qwen 使用 enable_thinking
        requestBody.enable_thinking = true;
      } else if (modelLower.includes('grok')) {
        // Grok 可能使用 thinking_mode
        requestBody.thinking_mode = 'deep';
      }
      // 其他模型如果不支持,参数会被忽略
    }

    const baseUrl = this.getBaseApiUrl();
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: '请求失败' } }));
      throw new Error(error.error?.message || '请求失败');
    }

    return response.body;
  }

  // 生成图片 - SiliconFlow/OpenAI兼容API
  async generateImage(prompt, chat) {
    // 添加用户消息
    const userMsg = { role: 'user', content: prompt };
    chat.messages.push(userMsg);

    // 更新标题
    if (chat.messages.length === 1) {
      chat.title = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
    }

    chat.updated = Date.now();
    this.saveChats();
    this.hideWelcomeScreen();
    this.renderMessages(chat.messages);
    this.renderChatList();

    // 创建助手消息占位符
    const assistantMsg = { role: 'assistant', content: '正在生成图片...' };
    chat.messages.push(assistantMsg);
    this.renderMessages(chat.messages);

    try {
      if (!this.apiKey) {
        throw new Error('请先在API设置中配置API Key');
      }

      if (!this.currentModel) {
        throw new Error('请先选择一个模型');
      }

      const baseUrl = this.getBaseApiUrl();

      // 使用当前选择的模型生成图片
      const requestBody = {
        model: this.currentModel,
        prompt: prompt
      };

      const response = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || error.error?.message || `图像生成失败 (${response.status})。请检查模型是否支持图像生成，或尝试更换其他图像模型。`);
      }

      const result = await response.json();

      // 兼容多种响应格式
      const imageUrl = result.images?.[0]?.url || result.data?.[0]?.url || result.url;

      if (imageUrl) {
        // 更新助手消息
        assistantMsg.content = '已为您生成图片：';
        assistantMsg.imageUrl = imageUrl;

        // 重新渲染消息
        this.renderMessages(chat.messages);

        // 保存消息
        chat.updated = Date.now();
        this.saveChats();
      } else {
        throw new Error('未能获取生成的图片');
      }

    } catch (error) {
      // 更新失败消息
      assistantMsg.content = `生成图片失败: ${error.message}`;
      this.renderMessages(chat.messages);
      chat.updated = Date.now();
      this.saveChats();
    }
  }

  // 获取模型列表
  async fetchModels() {
    if (!this.apiKey || !this.apiUrl) return;

    try {
      const baseUrl = this.getBaseApiUrl();
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.availableModels = data.data || [];
        this.updateModelDropdown();
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    }
  }

  // 更新模型下拉菜单
  updateModelDropdown() {
    const dropdown = document.getElementById('model-dropdown');
    if (!dropdown || this.availableModels.length === 0) return;

    dropdown.innerHTML = '';

    // 显示所有模型
    this.availableModels.forEach(model => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      if (model.id === this.currentModel) {
        item.classList.add('active');
      }

      item.innerHTML = `
        <div class="model-info">
          <div class="model-title">${model.id}</div>
        </div>
      `;

      item.onclick = () => {
        this.currentModel = model.id;
        localStorage.setItem('selected_model', model.id);
        const modelNameEl = document.querySelector('.model-name');
        if (modelNameEl) {
          modelNameEl.textContent = model.id;
        }
        document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        dropdown.style.display = 'none';
      };

      dropdown.appendChild(item);
    });

    // 确保当前模型在界面上显示正确
    const modelNameEl = document.querySelector('.model-name');
    if (modelNameEl && this.currentModel) {
      modelNameEl.textContent = this.currentModel;
    }
  }

  // 显示输入指示器
  showTypingIndicator() {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const indicator = document.createElement('div');
    indicator.className = 'message-group assistant typing-indicator-group';
    indicator.innerHTML = `
      <div class="message-wrapper">
        <div class="message-avatar assistant-avatar">
          <img src="https://cdn.oaistatic.com/assets/favicon-miwirzcw.ico" alt="GPT">
        </div>
        <div class="message-bubble">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>
    `;

    container.appendChild(indicator);

    // 滚动到底部
    const wrapper = document.querySelector('.chat-wrapper');
    if (wrapper) {
      wrapper.scrollTop = wrapper.scrollHeight;
    }
  }

  // 隐藏输入指示器
  hideTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator-group');
    if (indicator) {
      indicator.remove();
    }
  }

  // 折叠侧边栏到窄条
  collapseSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarMini = document.getElementById('sidebar-mini');

    if (window.innerWidth > 768) {
      // 桌面端: 切换到窄条
      if (sidebar) sidebar.classList.add('collapsed');
      if (sidebarMini) sidebarMini.classList.add('active');
    } else {
      // 移动端: 关闭侧边栏
      if (sidebar) sidebar.classList.remove('open');
    }
  }

  // 展开侧边栏
  expandSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarMini = document.getElementById('sidebar-mini');

    if (sidebar) sidebar.classList.remove('collapsed');
    if (sidebarMini) sidebarMini.classList.remove('active');
  }

  // 添加附件
  addAttachedFile(file) {
    this.attachedFiles.push(file);
    this.renderAttachedFiles();
    this.updateSendButton();
  }

  // 移除附件
  removeAttachedFile(index) {
    this.attachedFiles.splice(index, 1);
    this.renderAttachedFiles();
    this.updateSendButton();
  }

  // 更新发送按钮状态
  updateSendButton() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
      sendBtn.disabled = (!input || !input.value.trim()) && this.attachedFiles.length === 0;
    }
  }

  // 渲染附件列表
  renderAttachedFiles() {
    const container = document.getElementById('attached-files');
    if (!container) return;

    if (this.attachedFiles.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = this.attachedFiles.map((file, index) => {
      const isImage = file.type.startsWith('image/');
      const icon = isImage ? '🖼️' : '📄';
      return `
        <div class="attached-file">
          <span>${icon}</span>
          <span class="attached-file-name" title="${file.name}">${file.name}</span>
          <button class="attached-file-remove" onclick="app.removeAttachedFile(${index})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  }

  // 显示搜索框
  showSearch() {
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    if (searchContainer) {
      searchContainer.style.display = 'block';
      searchInput?.focus();
    }
  }

  // 隐藏搜索框
  hideSearch() {
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    if (searchContainer) {
      searchContainer.style.display = 'none';
      if (searchInput) searchInput.value = '';
      this.renderChatList();
    }
  }

  // 过滤聊天记录
  filterChats(keyword) {
    if (!keyword.trim()) {
      this.renderChatList();
      return;
    }

    const filtered = this.chats.filter(chat => {
      // 搜索标题
      if (chat.title.toLowerCase().includes(keyword.toLowerCase())) {
        return true;
      }
      // 搜索消息内容
      return chat.messages.some(msg =>
        msg.content.toLowerCase().includes(keyword.toLowerCase())
      );
    });

    this.renderChatList(filtered);
  }

  // 关闭侧边栏 (移动端)
  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
    }
  }

  // 打开侧边栏
  openSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.add('open');
    }
  }

  // 切换侧边栏
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      // 移动端使用open类
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
      }
    }
  }

  // 绑定事件
  bindEvents() {
    // 侧边栏开关
    document.getElementById('sidebar-close')?.addEventListener('click', () => this.collapseSidebar());
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => this.expandSidebar());

    // 新建聊天
    document.getElementById('new-chat-btn')?.addEventListener('click', () => this.createNewChat());
    document.getElementById('new-chat-mobile')?.addEventListener('click', () => this.createNewChat());
    document.getElementById('new-chat-mini')?.addEventListener('click', () => this.createNewChat());

    // 搜索聊天
    document.getElementById('search-chat-btn')?.addEventListener('click', () => {
      this.showSearch();
    });
    document.getElementById('search-chat-mini')?.addEventListener('click', () => {
      this.showSearch();
    });

    // 搜索输入
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => {
      this.filterChats(e.target.value);
    });

    // 关闭搜索
    document.getElementById('search-close')?.addEventListener('click', () => {
      this.hideSearch();
    });

    // API设置按钮已在 bindApiSettings() 中绑定

    // 输入框
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    if (input) {
      input.addEventListener('input', () => {
        // 自动调整高度
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';

        // 更新发送按钮状态
        if (sendBtn) {
          sendBtn.disabled = !input.value.trim() && this.attachedFiles.length === 0;
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (input.value.trim()) {
            this.sendMessage(input.value);
            input.value = '';
            input.style.height = 'auto';
            if (sendBtn) sendBtn.disabled = true;
          }
        }
      });
    }

    if (sendBtn) {
      sendBtn.onclick = () => {
        if (input && input.value.trim()) {
          this.sendMessage(input.value);
          input.value = '';
          input.style.height = 'auto';
          sendBtn.disabled = true;
        }
      };
    }

    // 快捷卡片
    document.querySelectorAll('.quick-action-card').forEach(card => {
      card.onclick = () => {
        const desc = card.querySelector('.card-desc');
        if (desc && input) {
          input.value = desc.textContent;
          input.dispatchEvent(new Event('input'));
          if (sendBtn) sendBtn.click();
        }
      };
    });

    // 模型选择器
    const modelSelector = document.getElementById('model-selector');
    const modelDropdown = document.getElementById('model-dropdown');

    if (modelSelector && modelDropdown) {
      modelSelector.onclick = (e) => {
        e.stopPropagation();
        modelDropdown.style.display = modelDropdown.style.display === 'none' ? 'block' : 'none';
      };

      // 点击外部关闭
      document.addEventListener('click', () => {
        modelDropdown.style.display = 'none';
      });
    }

    // 清空当前对话
    const clearContextBtn = document.getElementById('clear-context-btn');
    clearContextBtn?.addEventListener('click', async () => {
      const confirmed = await this.dialog.confirm('确定要清空当前对话吗？', '确认操作');
      if (!confirmed) return;

      const chat = this.chats.find(c => c.id === this.currentChatId);
      if (chat) {
        chat.messages = [];
        chat.title = '新的聊天';
        this.saveChats();
        this.renderMessages([]);
        this.showWelcomeScreen();
        this.renderChatList();
      }
    });

    // 选项菜单
    const optionsMenuBtn = document.getElementById('options-menu-btn');
    const optionsDropdown = document.getElementById('options-dropdown');
    const fileUpload = document.getElementById('file-upload');

    // 打开/关闭菜单
    optionsMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (optionsDropdown) {
        const isVisible = optionsDropdown.style.display !== 'none';
        if (isVisible) {
          optionsDropdown.style.display = 'none';
        } else {
          // 先显示以获取尺寸
          optionsDropdown.style.display = 'block';
          optionsDropdown.style.visibility = 'hidden';

          // 计算菜单位置
          const btnRect = optionsMenuBtn.getBoundingClientRect();
          const dropdownHeight = optionsDropdown.offsetHeight;

          optionsDropdown.style.left = btnRect.left + 'px';
          optionsDropdown.style.top = (btnRect.top - dropdownHeight - 8) + 'px';
          optionsDropdown.style.visibility = 'visible';
        }
      }
    });

    // 点击外部关闭菜单
    document.addEventListener('click', (e) => {
      if (optionsDropdown && !optionsDropdown.contains(e.target) && e.target !== optionsMenuBtn) {
        optionsDropdown.style.display = 'none';
      }
    });

    // 菜单选项点击
    document.querySelectorAll('.options-item').forEach(item => {
      item.addEventListener('click', () => {
        const option = item.dataset.option;
        this.selectOption(option);
        optionsDropdown.style.display = 'none';
      });
    });

    // 文件上传
    fileUpload?.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          this.addAttachedFile(files[i]);
        }
      }
      e.target.value = '';
    });

    // 导出对话
    const exportChatBtn = document.getElementById('export-chat-btn');
    exportChatBtn?.addEventListener('click', () => {
      const chat = this.chats.find(c => c.id === this.currentChatId);
      if (!chat || chat.messages.length === 0) {
        this.dialog.info('当前对话为空，无法导出');
        return;
      }

      // 生成 Markdown 格式
      let markdown = `# ${chat.title}\n\n`;
      markdown += `导出时间: ${new Date().toLocaleString()}\n\n`;
      markdown += `---\n\n`;

      chat.messages.forEach(msg => {
        const role = msg.role === 'user' ? '👤 用户' : '🤖 助手';
        markdown += `## ${role}\n\n${msg.content}\n\n`;
      });

      // 下载文件
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chat.title}_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // 会话提示词
    const sessionPromptBtn = document.getElementById('session-prompt-btn');
    sessionPromptBtn?.addEventListener('click', () => {
      this.openSessionPromptModal();
    });

    // API设置
    this.bindApiSettings();
  }

  // 打开会话提示词弹窗
  openSessionPromptModal() {
    const chat = this.chats.find(c => c.id === this.currentChatId);
    if (!chat) {
      this.dialog.info('请先创建一个会话');
      return;
    }

    const modal = document.getElementById('session-prompt-modal');
    const textarea = document.getElementById('session-prompt-textarea');

    if (modal && textarea) {
      textarea.value = chat.sessionPrompt || '';
      modal.style.display = 'flex';
      textarea.focus();
    }
  }

  // 保存会话提示词
  saveSessionPrompt() {
    const chat = this.chats.find(c => c.id === this.currentChatId);
    if (!chat) return;

    const textarea = document.getElementById('session-prompt-textarea');
    if (textarea) {
      chat.sessionPrompt = textarea.value.trim();
      this.saveChats();

      const modal = document.getElementById('session-prompt-modal');
      if (modal) modal.style.display = 'none';

      this.dialog.info('会话提示词已保存');
    }
  }

  // 绑定会话提示词弹窗事件
  bindSessionPromptModal() {
    const modal = document.getElementById('session-prompt-modal');
    const overlay = document.getElementById('session-prompt-overlay');
    const closeBtn = document.getElementById('session-prompt-close');
    const cancelBtn = document.getElementById('session-prompt-cancel');
    const saveBtn = document.getElementById('session-prompt-save');

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    overlay?.addEventListener('click', closeModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    saveBtn?.addEventListener('click', () => this.saveSessionPrompt());
  }

  // 绑定API设置事件
  bindApiSettings() {
    const modal = document.getElementById('api-modal');
    const overlay = document.getElementById('modal-overlay');
    const apiBtn = document.getElementById('api-settings-btn');
    const apiBtnMini = document.getElementById('api-settings-mini');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('cancel-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const fetchBtn = document.getElementById('fetch-models-btn');
    const toggleBtn = document.getElementById('toggle-password');
    const urlInput = document.getElementById('api-url-input');
    const keyInput = document.getElementById('api-key-input');
    const systemPromptInput = document.getElementById('system-prompt-input');

    // 彩蛋开关
    const timestampToggle = document.getElementById('timestamp-toggle');
    const mouseTrailToggle = document.getElementById('mouse-trail-toggle');
    const fireworksToggle = document.getElementById('fireworks-toggle');
    const intensitySlider = document.getElementById('effects-intensity-slider');
    const intensityValue = document.getElementById('intensity-value');
    const intensityContainer = document.getElementById('intensity-slider-container');

    // 更新滑块显示状态的函数
    this.updateIntensitySliderVisibility = () => {
      if (intensityContainer) {
        const showSlider = mouseTrailToggle?.checked || fireworksToggle?.checked;
        intensityContainer.style.display = showSlider ? 'block' : 'none';
      }
    };

    // 打开弹窗
    const openModal = () => {
      modal.style.display = 'flex';
      urlInput.value = this.apiUrl;
      keyInput.value = this.apiKey;
      if (systemPromptInput) systemPromptInput.value = this.systemPrompt;

      // 设置彩蛋开关状态
      if (timestampToggle) timestampToggle.checked = this.settings.showTimestamp;
      if (mouseTrailToggle) mouseTrailToggle.checked = this.settings.mouseTrail;
      if (fireworksToggle) fireworksToggle.checked = this.settings.clickFireworks;

      // 更新滑块显示状态
      this.updateIntensitySliderVisibility();

      // 设置强度滑块
      if (intensitySlider && this.effects) {
        const savedIntensity = parseFloat(localStorage.getItem('effectsIntensity') || '30');
        intensitySlider.value = savedIntensity;
        if (intensityValue) intensityValue.textContent = savedIntensity + '%';
        intensitySlider.style.background = `linear-gradient(to right, var(--accent) ${savedIntensity}%, var(--border-light) ${savedIntensity}%)`;
      }
    };

    apiBtn?.addEventListener('click', openModal);
    apiBtnMini?.addEventListener('click', openModal);

    // 关闭弹窗
    const closeModal = () => {
      modal.style.display = 'none';
    };

    overlay?.addEventListener('click', closeModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // 切换密码可见性
    toggleBtn?.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = '🔒';
      } else {
        keyInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });

    // 特效开关变化时更新滑块显示
    mouseTrailToggle?.addEventListener('change', () => {
      this.updateIntensitySliderVisibility();
    });

    fireworksToggle?.addEventListener('change', () => {
      this.updateIntensitySliderVisibility();
    });

    // 强度滑块事件
    intensitySlider?.addEventListener('input', (e) => {
      const value = e.target.value;
      if (intensityValue) intensityValue.textContent = value + '%';
      e.target.style.background = `linear-gradient(to right, var(--accent) ${value}%, var(--border-light) ${value}%)`;
    });

    // 获取模型列表
    fetchBtn?.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      const key = keyInput.value.trim();

      if (!url || !key) {
        this.dialog.info('请填写API URL和API Key');
        return;
      }

      fetchBtn.disabled = true;
      fetchBtn.textContent = '获取中...';

      try {
        // 处理URL，去除多余路径
        let baseUrl = url.replace(/\/chat\/completions\/?$/, '').replace(/\/completions\/?$/, '');

        const response = await fetch(`${baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${key}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const models = data.data || [];

          // 显示模型列表
          const modelsList = document.getElementById('models-list');
          const container = document.getElementById('available-models');

          if (models.length > 0) {
            container.innerHTML = '';

            // 不再筛选，显示所有模型
            models.forEach(model => {
              const item = document.createElement('div');
              item.className = 'model-item';
              item.textContent = model.id;

              item.onclick = () => {
                document.querySelectorAll('.model-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.currentModel = model.id;
              };

              if (model.id === this.currentModel) {
                item.classList.add('selected');
              }

              container.appendChild(item);
            });

            modelsList.style.display = 'block';
          } else {
            this.dialog.info('未找到可用模型');
          }
        } else {
          const errorText = await response.text();
          this.dialog.info(`获取模型列表失败 (${response.status}): ${errorText}`);
        }
      } catch (error) {
        this.dialog.info('连接失败: ' + error.message);
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = '获取模型列表';
      }
    });

    // 清除缓存
    clearCacheBtn?.addEventListener('click', async () => {
      const confirmed = await this.dialog.confirm('确定要清除所有缓存吗？这将删除所有聊天记录、API设置和选择的模型。', '确认操作');
      if (!confirmed) return;

      localStorage.clear();
      this.dialog.info('缓存已清除，页面将刷新');
      location.reload();
    });

    // 保存设置
    saveBtn?.addEventListener('click', () => {
      const url = urlInput.value.trim();
      const key = keyInput.value.trim();
      const systemPrompt = systemPromptInput?.value.trim() || '';

      if (!url || !key) {
        this.dialog.info('请填写API URL和API Key');
        return;
      }

      this.apiUrl = url;
      this.apiKey = key;
      this.systemPrompt = systemPrompt;

      localStorage.setItem('openai_api_url', url);
      localStorage.setItem('openai_api_key', key);
      localStorage.setItem('system_prompt', systemPrompt);

      // 保存彩蛋设置
      this.settings.showTimestamp = timestampToggle?.checked || false;
      this.settings.mouseTrail = mouseTrailToggle?.checked || false;
      this.settings.clickFireworks = fireworksToggle?.checked || false;

      localStorage.setItem('showTimestamp', this.settings.showTimestamp);
      localStorage.setItem('mouseTrail', this.settings.mouseTrail);
      localStorage.setItem('clickFireworks', this.settings.clickFireworks);

      const activeChat = this.chats.find(chat => chat.id === this.currentChatId);
      if (activeChat) {
        this.renderMessages(activeChat.messages);
      }

      // 保存特效强度
      if (intensitySlider && this.effects) {
        const intensity = parseFloat(intensitySlider.value);
        this.effects.setIntensity(intensity);
      }

      // 更新模型显示
      if (this.currentModel) {
        document.querySelector('.model-name').textContent = this.currentModel;
      }

      // 获取最新模型列表
      this.fetchModels();

      this.dialog.info('设置已保存');
      closeModal();
    });
  }

  createSystemDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'system-dialog-overlay';
    overlay.innerHTML = `
      <div class="system-dialog" role="dialog" aria-modal="true">
        <div class="system-dialog-header">
          <div class="system-dialog-title">提示</div>
          <button class="system-dialog-close" aria-label="关闭"></button>
        </div>
        <div class="system-dialog-body">
          <div class="system-dialog-message"></div>
        </div>
        <div class="system-dialog-actions"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const titleEl = overlay.querySelector('.system-dialog-title');
    const messageEl = overlay.querySelector('.system-dialog-message');
    const actionsEl = overlay.querySelector('.system-dialog-actions');
    const closeBtn = overlay.querySelector('.system-dialog-close');
    const dialogEl = overlay.querySelector('.system-dialog');

    let resolver = null;

    const hide = (result) => {
      if (!resolver) return;
      overlay.classList.remove('visible');
      dialogEl.classList.remove('visible');
      document.removeEventListener('keydown', handleKeyDown);
      const resolve = resolver;
      resolver = null;
      setTimeout(() => resolve(result), 160);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        hide(false);
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        hide(false);
      }
    });
    closeBtn.addEventListener('click', () => hide(false));

    const show = ({ title = '提示', message = '', actions = [] } = {}) => {
      overlay.classList.add('visible');
      dialogEl.classList.add('visible');
      titleEl.textContent = title;
      messageEl.textContent = message;
      actionsEl.innerHTML = '';

      const finalActions = actions.length > 0 ? actions : [{ label: '确定', value: true, primary: true }];

      return new Promise((resolve) => {
        resolver = resolve;
        document.addEventListener('keydown', handleKeyDown);

        finalActions.forEach((action, index) => {
          const btn = document.createElement('button');
          btn.className = 'system-dialog-btn';
          if (action.primary) btn.classList.add('primary');
          btn.textContent = action.label;
          btn.addEventListener('click', () => hide(action.value));
          actionsEl.appendChild(btn);
          if (index === finalActions.length - 1) {
            requestAnimationFrame(() => btn.focus());
          }
        });
      });
    };

    return {
      show,
      info: (message, title = '提示', confirmText = '确定') =>
        show({
          title,
          message,
          actions: [{ label: confirmText, value: true, primary: true }]
        }),
      confirm: (message, title = '确认', { confirmText = '确定', cancelText = '取消' } = {}) =>
        show({
          title,
          message,
          actions: [
            { label: cancelText, value: false },
            { label: confirmText, value: true, primary: true }
          ]
        })
    };
  }

  ensureImagePreview() {
    if (this.imagePreview) return this.imagePreview;

    const overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.innerHTML = `
      <div class="image-preview-inner">
        <button class="image-preview-close" aria-label="关闭预览"></button>
        <img class="image-preview-img" alt="预览图片" />
        <div class="image-preview-caption"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const img = overlay.querySelector('.image-preview-img');
    const caption = overlay.querySelector('.image-preview-caption');
    const closeBtn = overlay.querySelector('.image-preview-close');

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    const close = () => {
      overlay.classList.remove('visible');
      document.removeEventListener('keydown', onKeyDown);
      img.src = '';
      caption.textContent = '';
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close();
      }
    });
    closeBtn.addEventListener('click', close);

    this.imagePreview = { overlay, img, caption, close, onKeyDown };
    return this.imagePreview;
  }

  openImagePreview(src, altText = '') {
    const preview = this.ensureImagePreview();
    preview.img.src = src;
    preview.img.alt = altText || '预览图片';
    preview.caption.textContent = altText || '';
    preview.overlay.classList.add('visible');
    document.removeEventListener('keydown', preview.onKeyDown);
    document.addEventListener('keydown', preview.onKeyDown);
  }

  bindImagePreview(container) {
    if (!container) return;
    container.querySelectorAll('img').forEach(img => {
      if (img.dataset.previewBound === 'true') return;
      img.dataset.previewBound = 'true';
      img.style.cursor = 'zoom-in';
      img.addEventListener('dblclick', () => {
        const source = img.dataset.full || img.src;
        this.openImagePreview(source, img.alt || '');
      });
    });
  }
}


// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ModernGPT();
});




