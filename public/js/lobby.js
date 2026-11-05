import { themeManager } from './theme.js';

/**
 * 内置预置游戏元数据 (保障离线/弱网/未握手瞬间 UI 依然有默认选项可用)
 */
const DEFAULT_GAMES = [
  {
    id: 'gomoku',
    name: '五子棋 (Gomoku)',
    description: '经典双人轮流落子，横竖斜率先连成五子者获胜',
    minPlayers: 2,
    maxPlayers: 2,
    icon: ''
  },
  {
    id: 'dice_battle',
    name: '骰子大决战 (Dice Battle)',
    description: '动态 2~4 人对战，每人掷骰比拼点数总和与幸运组合',
    minPlayers: 2,
    maxPlayers: 4,
    icon: ''
  }
];

/**
 * 实时对战大厅与多游戏动态交互控制器 (Lobby & Game Controller)
 */
export class LobbyController {
  constructor(socket, state) {
    this.socket = socket;
    this.state = state;

    // 默认使用内置游戏清单预填充，绝不出现空下拉
    this.gamesList = [...DEFAULT_GAMES];
    this.tablesList = [];
    this.currentTable = null;
    this.mySeatIndex = -1;
    this.gameState = null;
    this.activeFilter = 'all';

    this.initDOMElements();
    this.initSocketEvents();
    this.initUIEventListeners();

    // 初始立即渲染一次预置游戏与下拉
    this.renderFilterChips();
    this.populateGameSelect();

    // 发起服务端数据同步
    this.activate();
  }

  initDOMElements() {
    this.dom = {
      viewport: document.getElementById('gameLobbyViewport'),
      lobbyBrowser: document.getElementById('lobbyBrowser'),
      tableStage: document.getElementById('tableStage'),
      tablesGrid: document.getElementById('tablesGrid'),
      gameFilterChips: document.getElementById('gameFilterChips'),
      refreshBtn: document.getElementById('refreshTablesBtn'),
      openCreateModalBtn: document.getElementById('openCreateTableModalBtn'),
      closeCreateModalBtn: document.getElementById('closeCreateTableModalBtn'),
      cancelCreateBtn: document.getElementById('cancelCreateTableBtn'),
      createModal: document.getElementById('createTableModal'),
      createForm: document.getElementById('createTableForm'),
      newTableNameInput: document.getElementById('newTableNameInput'),
      randomizeTableNameBtn: document.getElementById('randomizeTableNameBtn'),
      selectGameType: document.getElementById('selectGameType'),
      createGameCardsGrid: document.getElementById('createGameCardsGrid'),
      gameMetaDesc: document.getElementById('gameMetaDesc'),
      selectedGamePlayerCount: document.getElementById('selectedGamePlayerCount'),
      selectedGameTypeTag: document.getElementById('selectedGameTypeTag'),

      // 桌台舞台
      leaveTableBtn: document.getElementById('leaveTableBtn'),
      currentTableName: document.getElementById('currentTableName'),
      currentGameTag: document.getElementById('currentGameTag'),
      tableStatusHint: document.getElementById('tableStatusHint'),
      tableReadyBtn: document.getElementById('tableReadyBtn'),
      tableStartBtn: document.getElementById('tableStartBtn'),
      seatsRow: document.getElementById('seatsRow'),

      // 竞技场
      gameArenaContainer: document.getElementById('gameArenaContainer'),
      gameHud: document.getElementById('gameHud'),
      turnIndicator: document.getElementById('turnIndicator'),
      myRoleBadge: document.getElementById('myRoleBadge'),
      gameRenderBox: document.getElementById('gameRenderBox'),

      // 结算弹窗
      gameOverModal: document.getElementById('gameOverModal'),
      gameOverIcon: document.getElementById('gameOverIcon'),
      gameOverTitle: document.getElementById('gameOverTitle'),
      gameOverDesc: document.getElementById('gameOverDesc'),
      closeGameOverModalBtn: document.getElementById('closeGameOverModalBtn')
    };
  }

  activate() {
    // 拉取游戏列表和大厅桌台
    this.socket.emit('table:get_games', (res) => {
      if (res?.success && Array.isArray(res.games) && res.games.length > 0) {
        this.gamesList = res.games;
        this.renderFilterChips();
        this.populateGameSelect();
      }
    });

    this.socket.emit('table:get_list', (res) => {
      if (res?.success) {
        this.tablesList = res.tables;
        this.renderTablesGrid();
      }
    });
  }

  initSocketEvents() {
    // 连接成功后自动刷新游戏列表与桌台
    this.socket.on('connect', () => {
      this.activate();
    });

    // 监听服务端主动推送的游戏列表
    this.socket.on('table:games_list', ({ games }) => {
      if (Array.isArray(games) && games.length > 0) {
        this.gamesList = games;
        this.renderFilterChips();
        this.populateGameSelect();
      }
    });

    // 桌台列表更新
    this.socket.on('table:list_updated', ({ tables }) => {
      this.tablesList = tables;
      this.renderTablesGrid();
    });

    this.socket.on('table:list_response', ({ tables }) => {
      this.tablesList = tables;
      this.renderTablesGrid();
    });

    // 成功进入桌台
    this.socket.on('table:joined', ({ table, mySeatIndex }) => {
      this.currentTable = table;
      this.mySeatIndex = mySeatIndex;
      this.showTableStage();
      this.renderTableStage();
    });

    // 桌台状态更新 (有人准备/离开/进入)
    this.socket.on('table:updated', ({ table, canStart, canStartReason }) => {
      this.currentTable = table;
      // 重新推算自己的座位
      const mySeat = table.seats.findIndex(s => s?.userId === this.getUserId());
      this.mySeatIndex = mySeat;
      this.renderTableStage(canStart, canStartReason);
    });

    // 退出桌台
    this.socket.on('table:left', () => {
      this.currentTable = null;
      this.mySeatIndex = -1;
      this.gameState = null;
      this.showLobbyBrowser();
    });

    // 游戏开启
    this.socket.on('game:started', ({ table, gameState }) => {
      this.currentTable = table;
      this.gameState = gameState;
      this.renderGameArena();
    });

    // 对战状态同步
    this.socket.on('game:state_sync', ({ table, gameState }) => {
      this.currentTable = table;
      this.gameState = gameState;
      this.renderGameArena();
    });

    // 胜负结算
    this.socket.on('game:over', ({ table, gameOver }) => {
      this.currentTable = table;
      this.showGameOverModal(gameOver);
    });

    // 异常报错
    this.socket.on('table:error', ({ error }) => {
      alert(`提示: ${error}`);
    });
  }

  getUserId() {
    return this.state.user?.userId || this.state.currentUser?.userId || '';
  }

  getUsername() {
    return this.state.user?.username || this.state.currentUser?.username || '玩家';
  }

  initUIEventListeners() {
    this.dom.refreshBtn.addEventListener('click', () => {
      this.socket.emit('table:get_list');
    });

    this.dom.openCreateModalBtn.addEventListener('click', () => {
      // 每次打开弹窗前确保卡片与下拉框选项完整并刷新描述
      this.populateGameSelect();
      this.dom.newTableNameInput.value = `${this.getUsername()} 的游戏桌`;
      this.dom.createModal.classList.remove('hidden');
      setTimeout(() => this.dom.newTableNameInput.focus(), 50);
    });

    // 随机桌台名称按钮
    if (this.dom.randomizeTableNameBtn) {
      const funNames = [
        '巅峰博弈厅',
        '极客对弈社',
        '快乐摸鱼局',
        '幸运骰王擂台',
        '高手切磋雅室',
        '黑白棋道馆',
        '友谊第一交流室',
        '云端闲趣局',
        '周末决战夜'
      ];
      this.dom.randomizeTableNameBtn.addEventListener('click', () => {
        const randName = funNames[Math.floor(Math.random() * funNames.length)];
        const suffix = Math.floor(100 + Math.random() * 900);
        this.dom.newTableNameInput.value = `${randName} #${suffix}`;
        this.dom.newTableNameInput.focus();
      });
    }

    const closeModal = () => this.dom.createModal.classList.add('hidden');
    this.dom.closeCreateModalBtn.addEventListener('click', closeModal);
    this.dom.cancelCreateBtn.addEventListener('click', closeModal);

    // 点击模态背景关闭
    this.dom.createModal.addEventListener('click', (e) => {
      if (e.target === this.dom.createModal) closeModal();
    });

    // 下拉框切换触发元信息描述变更
    this.dom.selectGameType.addEventListener('change', () => {
      this.renderCreateGameCards();
      this.updateGameMetaDesc();
    });

    // 提交创建桌台
    this.dom.createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const gameId = this.dom.selectGameType.value;
      const tableName = this.dom.newTableNameInput.value.trim();
      if (!gameId) {
        alert('请选择一个小游戏');
        return;
      }
      this.socket.emit('table:create', { gameId, tableName }, (res) => {
        if (!res?.success) {
          alert(res?.error || '创建桌台失败');
        } else {
          closeModal();
        }
      });
    });

    // 离开桌台
    this.dom.leaveTableBtn.addEventListener('click', () => {
      if (!this.currentTable) return;
      this.socket.emit('table:leave', { tableId: this.currentTable.tableId });
    });

    // 准备按钮
    this.dom.tableReadyBtn.addEventListener('click', () => {
      if (!this.currentTable) return;
      this.socket.emit('table:ready', { tableId: this.currentTable.tableId });
    });

    // 开始游戏
    this.dom.tableStartBtn.addEventListener('click', () => {
      if (!this.currentTable) return;
      this.socket.emit('table:start', { tableId: this.currentTable.tableId });
    });

    // 关闭结算弹窗
    this.dom.closeGameOverModalBtn.addEventListener('click', () => {
      this.dom.gameOverModal.classList.add('hidden');
      this.dom.gameArenaContainer.classList.add('hidden');
      this.renderTableStage();
    });
  }

  // ----------------------------------------
  // UI 渲染方法
  // ----------------------------------------

  getGameIconSvg(gameId) {
    if (gameId === 'gomoku') {
      return `<svg class="chip-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg>`;
    }
    if (gameId === 'dice_battle') {
      return `<svg class="chip-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>`;
    }
    return '';
  }

  renderFilterChips() {
    let html = `<button class="chip ${this.activeFilter === 'all' ? 'active' : ''}" data-game="all">全部游戏</button>`;
    this.gamesList.forEach(g => {
      html += `<button class="chip ${this.activeFilter === g.id ? 'active' : ''}" data-game="${g.id}">${this.getGameIconSvg(g.id)} <span>${g.name}</span></button>`;
    });
    this.dom.gameFilterChips.innerHTML = html;

    this.dom.gameFilterChips.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.gameFilterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.game;
        this.renderTablesGrid();
      });
    });
  }

  populateGameSelect() {
    this.dom.selectGameType.innerHTML = this.gamesList.map(g =>
      `<option value="${g.id}">${g.name} (${g.minPlayers}~${g.maxPlayers}人)</option>`
    ).join('');
    this.renderCreateGameCards();
    this.updateGameMetaDesc();
  }

  renderCreateGameCards() {
    if (!this.dom.createGameCardsGrid) return;
    const currentSelected = this.dom.selectGameType.value || this.gamesList[0]?.id;

    let html = '';
    this.gamesList.forEach(g => {
      const isSelected = g.id === currentSelected;
      const playerText = g.minPlayers === g.maxPlayers ? `${g.minPlayers}人对弈` : `${g.minPlayers}~${g.maxPlayers}人乱斗`;
      const shortName = g.name.split(' (')[0];
      html += `
        <div class="create-game-card ${isSelected ? 'active' : ''}" data-game-id="${g.id}">
          <div class="create-game-card-icon">
            ${this.getGameIconSvg(g.id)}
          </div>
          <div class="create-game-card-info">
            <div class="create-game-card-name">${shortName}</div>
            <div class="create-game-card-players">${playerText}</div>
          </div>
          <div class="create-game-card-check">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
      `;
    });

    this.dom.createGameCardsGrid.innerHTML = html;

    this.dom.createGameCardsGrid.querySelectorAll('.create-game-card').forEach(card => {
      card.addEventListener('click', () => {
        const gameId = card.getAttribute('data-game-id');
        this.dom.selectGameType.value = gameId;
        this.renderCreateGameCards();
        this.updateGameMetaDesc();
      });
    });
  }

  updateGameMetaDesc() {
    const selectedId = this.dom.selectGameType.value;
    const game = this.gamesList.find(g => g.id === selectedId);
    if (game) {
      this.dom.gameMetaDesc.textContent = game.description;
      if (this.dom.selectedGamePlayerCount) {
        this.dom.selectedGamePlayerCount.textContent = game.minPlayers === game.maxPlayers
          ? `${game.minPlayers}人对战`
          : `${game.minPlayers}~${game.maxPlayers}人对战`;
      }
      if (this.dom.selectedGameTypeTag) {
        this.dom.selectedGameTypeTag.textContent = game.id === 'gomoku' ? '经典策略' : '聚会娱乐';
      }
    }
  }

  renderTablesGrid() {
    const filtered = this.activeFilter === 'all'
      ? this.tablesList
      : this.tablesList.filter(t => t.gameId === this.activeFilter);

    if (filtered.length === 0) {
      this.dom.tablesGrid.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="6" x2="10" y1="12" y2="12"></line>
            <line x1="8" x2="8" y1="10" y2="14"></line>
            <line x1="15" x2="15.01" y1="13" y2="13"></line>
            <line x1="18" x2="18.01" y1="11" y2="11"></line>
            <rect width="20" height="12" x="2" y="6" rx="6"></rect>
          </svg>
          <p>暂无进行中的桌台，点击上方按钮创建第一张桌台</p>
        </div>
      `;
      return;
    }

    this.dom.tablesGrid.innerHTML = filtered.map(t => {
      const isPlaying = t.status === 'PLAYING';
      const statusPillClass = isPlaying ? 'playing' : 'waiting';
      const statusText = isPlaying ? '激战中' : '等待玩家';
      const isFull = t.seatedCount >= t.maxPlayers;

      return `
        <div class="table-card">
          <div class="table-card-top">
            <span class="table-game-badge">${t.gameName}</span>
            <span class="table-status-pill ${statusPillClass}">${statusText}</span>
          </div>
          <div class="table-name">${this.escapeHtml(t.tableName)}</div>
          <div class="table-meta-info">
            <span>房主: ${this.escapeHtml(t.hostUsername)}</span>
            <span>最低开局: ${t.minPlayers} 人</span>
          </div>
          <div class="table-card-footer">
            <span class="table-players-progress">座位: ${t.seatedCount}/${t.maxPlayers}</span>
            <button class="btn btn-sm btn-primary join-table-btn" data-table-id="${t.tableId}" ${isPlaying || isFull ? 'disabled' : ''}>
              ${isPlaying ? '对战中' : (isFull ? '已满座' : '加入桌台')}
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.dom.tablesGrid.querySelectorAll('.join-table-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tableId = btn.dataset.tableId;
        this.socket.emit('table:join', { tableId }, (res) => {
          if (!res?.success) alert(res?.error || '无法加入桌台');
        });
      });
    });
  }

  showLobbyBrowser() {
    this.dom.lobbyBrowser.classList.remove('hidden');
    this.dom.tableStage.classList.add('hidden');
    this.dom.gameOverModal.classList.add('hidden');
  }

  showTableStage() {
    this.dom.lobbyBrowser.classList.add('hidden');
    this.dom.tableStage.classList.remove('hidden');
  }

  renderTableStage(canStartHint = null, canStartReason = '') {
    if (!this.currentTable) return;
    const table = this.currentTable;
    this.dom.currentTableName.textContent = table.tableName;
    this.dom.currentGameTag.textContent = `${table.gameMeta.name} (桌号: ${table.tableId})`;

    const myUserId = this.getUserId();
    const isHost = table.hostUserId === myUserId;
    const seatedPlayers = table.seats.filter(s => s !== null);
    const mySeat = table.seats.find(s => s?.userId === myUserId);

    // 控制按钮状态
    if (table.status === 'PLAYING') {
      this.dom.tableReadyBtn.classList.add('hidden');
      this.dom.tableStartBtn.classList.add('hidden');
      this.dom.tableStatusHint.textContent = '游戏正在进行中...';
    } else if (isHost) {
      this.dom.tableReadyBtn.classList.add('hidden');
      this.dom.tableStartBtn.classList.remove('hidden');

      // 计算是否可开始
      const countReady = seatedPlayers.filter(s => s.isReady).length;
      const canStart = seatedPlayers.length >= table.minPlayers && countReady === seatedPlayers.length;

      this.dom.tableStartBtn.disabled = !canStart;
      if (canStart) {
        this.dom.tableStatusHint.textContent = `已满足最低 ${table.minPlayers} 人就绪，可以开启游戏`;
      } else {
        this.dom.tableStatusHint.textContent = `就坐 ${seatedPlayers.length}/${table.minPlayers} 人，就绪 ${countReady}/${seatedPlayers.length}`;
      }
    } else {
      this.dom.tableStartBtn.classList.add('hidden');
      this.dom.tableReadyBtn.classList.remove('hidden');
      const isReady = mySeat?.isReady || false;
      this.dom.tableReadyBtn.textContent = isReady ? '取消准备' : '准备';
      this.dom.tableReadyBtn.className = isReady ? 'btn btn-outline' : 'btn btn-success';
      this.dom.tableStatusHint.textContent = isReady ? '您已准备，等待房主开始...' : '请点击准备';
    }

    // 动态渲染座位卡片
    this.dom.seatsRow.innerHTML = table.seats.map((seat, index) => {
      if (!seat) {
        return `
          <div class="seat-card empty" data-seat="${index}">
            <span class="seat-empty-text">空位 ${index + 1}</span>
            <span style="font-size:0.7rem; color:var(--text-muted)">点击就坐</span>
          </div>
        `;
      }

      const isThisHost = seat.userId === table.hostUserId;
      const initial = (seat.username || '用')[0].toUpperCase();

      return `
        <div class="seat-card">
          ${isThisHost ? '<span class="seat-host-badge" title="房主">房主</span>' : ''}
          <div class="seat-avatar">${initial}</div>
          <div class="seat-name" title="${this.escapeHtml(seat.username)}">${this.escapeHtml(seat.username)}</div>
          <span class="seat-ready-tag ${seat.isReady ? 'ready' : 'waiting'}">
            ${seat.isReady ? '已就绪' : '等待中'}
          </span>
        </div>
      `;
    }).join('');

    // 点击空位换座
    this.dom.seatsRow.querySelectorAll('.seat-card.empty').forEach(el => {
      el.addEventListener('click', () => {
        const seatIndex = parseInt(el.dataset.seat, 10);
        this.socket.emit('table:join', { tableId: table.tableId, seatIndex });
      });
    });

    // 如果处于对战中且有对战状态
    if (table.status === 'PLAYING' && this.gameState) {
      this.renderGameArena();
    } else {
      this.dom.gameArenaContainer.classList.add('hidden');
    }
  }

  // ----------------------------------------
  // 竞技场及具体游戏动态渲染
  // ----------------------------------------

  renderGameArena() {
    if (!this.gameState || !this.currentTable) return;
    this.dom.gameArenaContainer.classList.remove('hidden');

    const gameId = this.currentTable.gameId;
    if (gameId === 'gomoku') {
      this.renderGomokuGame();
    } else if (gameId === 'dice_battle') {
      this.renderDiceGame();
    } else {
      this.dom.gameRenderBox.innerHTML = `<div>暂无该游戏的动态视图插件</div>`;
    }
  }

  /**
   * 渲染五子棋
   */
  renderGomokuGame() {
    const state = this.gameState;
    const myUserId = this.getUserId();
    const myRole = state.playerRoles[myUserId];

    if (myRole) {
      this.dom.myRoleBadge.textContent = `阵营: ${myRole.roleName}`;
    } else {
      this.dom.myRoleBadge.textContent = '身份: 旁观者';
    }

    const isMyTurn = state.currentTurnPlayerId === myUserId;
    const turnRoleName = state.currentTurnRole === 1 ? '黑方' : '白方';
    this.dom.turnIndicator.textContent = isMyTurn ? `轮到您落子 (${turnRoleName})` : `等待对方落子 (${turnRoleName})`;
    this.dom.turnIndicator.style.color = isMyTurn ? 'var(--accent-primary)' : 'var(--text-secondary)';

    // 如果退出对战或回合切换给对方，重置选中状态
    if (!isMyTurn || state.currentTurnPlayerId !== myUserId) {
      this.selectedGomokuMove = null;
    }

    const lastMove = state.moveHistory[state.moveHistory.length - 1];
    const isMobile = window.innerWidth <= 768;

    const equippedBoardId = themeManager?.getEquippedItem ? themeManager.getEquippedItem('game.gomoku.board') : 'board.classic';
    const boardSkinClass = themeManager?.items?.[equippedBoardId]?.className || 'board-style-classic';

    let gridHtml = `<div class="gomoku-board-wrap ${boardSkinClass}"><div class="gomoku-grid">`;
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const val = state.board[y][x];
        const isLast = lastMove && lastMove.x === x && lastMove.y === y;
        const isSelected = this.selectedGomokuMove && this.selectedGomokuMove.x === x && this.selectedGomokuMove.y === y;
        let pieceHtml = '';
        if (val === 1) {
          pieceHtml = `<div class="piece black ${isLast ? 'last-move' : ''}"></div>`;
        } else if (val === 2) {
          pieceHtml = `<div class="piece white ${isLast ? 'last-move' : ''}"></div>`;
        } else if (isSelected && myRole) {
          // 移动端选定位置虚影预览
          const roleClass = myRole.role === 1 ? 'black' : 'white';
          pieceHtml = `<div class="piece ${roleClass} preview"></div>`;
        }
        gridHtml += `<div class="gomoku-cell ${isSelected ? 'touch-selected' : ''}" data-x="${x}" data-y="${y}">${pieceHtml}</div>`;
      }
    }
    gridHtml += '</div></div>';

    // 移动端落子确认栏 (选定后激活)
    if (isMobile && isMyTurn && this.selectedGomokuMove) {
      gridHtml += `
        <div class="mobile-move-confirm-bar" id="gomokuConfirmBar">
          <div class="confirm-bar-info">
            <span>选定位置:</span>
            <span class="coord-tag">${this.selectedGomokuMove.x + 1}列, ${this.selectedGomokuMove.y + 1}行</span>
          </div>
          <div class="confirm-bar-actions">
            <button class="btn btn-sm btn-outline" id="cancelMoveBtn">重选</button>
            <button class="btn btn-sm btn-primary" id="confirmMoveBtn">确认落子</button>
          </div>
        </div>
      `;
    }

    this.dom.gameRenderBox.innerHTML = gridHtml;

    // 绑定落子/选点事件
    if (isMyTurn) {
      const sendMove = (x, y) => {
        this.selectedGomokuMove = null;
        this.socket.emit('game:action', {
          tableId: this.currentTable.tableId,
          action: { type: 'PLACE_PIECE', x, y }
        });
      };

      this.dom.gameRenderBox.querySelectorAll('.gomoku-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const x = parseInt(cell.dataset.x, 10);
          const y = parseInt(cell.dataset.y, 10);
          if (state.board[y][x] !== 0) return;

          if (!isMobile) {
            // PC 端保持直接单击即落子
            sendMove(x, y);
          } else {
            // 移动端：如果是再次点击同一格，直接落子；否则切换选定准星
            if (this.selectedGomokuMove && this.selectedGomokuMove.x === x && this.selectedGomokuMove.y === y) {
              sendMove(x, y);
            } else {
              this.selectedGomokuMove = { x, y };
              this.renderGomokuGame();
            }
          }
        });
      });

      // 移动端底部确认栏按钮监听
      const confirmBtn = document.getElementById('confirmMoveBtn');
      if (confirmBtn && this.selectedGomokuMove) {
        confirmBtn.addEventListener('click', () => {
          sendMove(this.selectedGomokuMove.x, this.selectedGomokuMove.y);
        });
      }

      const cancelBtn = document.getElementById('cancelMoveBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.selectedGomokuMove = null;
          this.renderGomokuGame();
        });
      }
    }
  }

  /**
   * 渲染骰子决战
   */
  renderDiceGame() {
    const state = this.gameState;
    const myUserId = this.getUserId();
    const myPlayer = state.playerStates[myUserId];

    this.dom.myRoleBadge.textContent = '骰子决战';
    this.dom.turnIndicator.textContent = '比拼点数总和，掷出点数';

    let html = `
      <div class="dice-arena-wrap">
        <div class="dice-players-row">
    `;

    Object.values(state.playerStates).forEach(p => {
      const isMe = p.userId === myUserId;
      const dicesStr = p.hasRolled
        ? p.dices.map(d => `<span class="dice-pip-token" aria-label="${d}点">${d}</span>`).join('')
        : '<span class="dice-pip-pending">- - -</span>';
      const scoreStr = p.hasRolled ? `${p.totalScore} 点` : '等待掷骰...';

      html += `
        <div class="dice-player-card" style="${isMe ? 'border-color: var(--accent);' : ''}">
          <div class="seat-name">${this.escapeHtml(p.username)} ${isMe ? '(我)' : ''}</div>
          <div class="dice-box">${dicesStr}</div>
          <div class="dice-score-tag">${scoreStr}</div>
        </div>
      `;
    });

    html += `
        </div>
        ${myPlayer && !myPlayer.hasRolled ? `
          <button class="btn btn-primary" id="rollDiceBtn" style="padding: 12px 32px; font-size: 1.1rem;">
            掷骰子
          </button>
        ` : (myPlayer?.hasRolled ? `<p style="color:var(--text-muted);font-size:0.85rem">您已完成掷骰，等待其他玩家...</p>` : '')}
      </div>
    `;

    this.dom.gameRenderBox.innerHTML = html;

    const rollBtn = document.getElementById('rollDiceBtn');
    if (rollBtn) {
      rollBtn.addEventListener('click', () => {
        this.socket.emit('game:action', {
          tableId: this.currentTable.tableId,
          action: { type: 'ROLL_DICE' }
        });
      });
    }
  }

  showGameOverModal(gameOver) {
    this.dom.gameOverModal.classList.remove('hidden');
    if (gameOver.isDraw) {
      this.dom.gameOverTitle.textContent = '握手言和';
    } else {
      this.dom.gameOverTitle.textContent = '对战胜负已分';
    }
    this.dom.gameOverDesc.textContent = gameOver.reason || '恭喜获胜玩家！';
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
