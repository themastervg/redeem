let allGames = [];
let currentFilter = 'All';

async function loadData() {
  const response = await fetch('data/games.json');
  const masterData = await response.json();

  const loadedGames = await Promise.all(
    masterData.games.map(async item => {
      const res = await fetch(`data/${item.file}`);
      return await res.json();
    })
  );

  allGames = loadedGames;

  renderFilters();
  renderGames(allGames);
  updateStats(allGames);
  initSearch();
  setupCopyButtons();
}

function renderFilters() {
  const filters = document.getElementById('gameFilters');
  filters.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.textContent = 'All';

  allBtn.onclick = () => {
    currentFilter = 'All';
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    allBtn.classList.add('active');
    renderGames(allGames);
  };

  filters.appendChild(allBtn);

  allGames.forEach(game => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = game.name;

    btn.onclick = () => {
      currentFilter = game.name;
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      renderGames(allGames.filter(g => g.name === game.name));
    };

    filters.appendChild(btn);
  });
}

function formatDate(dateString) {
  if (!dateString) {
    return 'Unknown Expiry';
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return 'Unknown Expiry';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
}

function renderGames(games) {
  const container = document.getElementById('gamesContainer');
  container.innerHTML = '';

  games.forEach(game => {
    const section = document.createElement('section');
    section.className = 'game-section';

    const cards = game.codes.map(code => {
      let expired = false;
      const hasExpiry = code.expiry && !isNaN(new Date(code.expiry).getTime());
      
      if (hasExpiry) {
        expired = new Date(code.expiry) < new Date();
      }

      return `
      <div class="card">
        <div class="badge ${expired ? 'expired-badge' : 'active-badge'}">
          ${expired ? 'Expired' : 'Active'}
        </div>
        <h3>${code.title}</h3>
        <p class="reward">${code.reward}</p>
        <div class="code-box">
          <span class="code">${code.code}</span>
          <button class="copy-btn" data-code="${code.code}">Copy</button>
        </div>
        <div class="meta">
          <span>${code.region}</span>
          <span>${formatDate(code.expiry)}</span>
        </div>
      </div>
      `;
    }).join('');

    section.innerHTML = `
      <div class="game-header">
        <img class="game-banner" src="${game.banner}" alt="${game.name}">
        <div class="game-info">
          <h2>${game.name}</h2>
          <p>${game.description}</p>
        </div>
      </div>
      <div class="cards">
        ${cards}
      </div>
    `;
    container.appendChild(section);
  });
}

function setupCopyButtons() {
  document.addEventListener('click', function(e) {
    const button = e.target.closest('.copy-btn');
    if (!button) return;
    
    e.preventDefault();
    const code = button.getAttribute('data-code');
    copyCode(code, button);
  });
}

function copyCode(code, buttonElement) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code).then(function() {
      showToast(code + ' copied');
      animateButton(buttonElement);
    }).catch(function() {
      fallbackCopy(code, buttonElement);
    });
  } else {
    fallbackCopy(code, buttonElement);
  }
}

function fallbackCopy(code, buttonElement) {
  const textArea = document.createElement('textarea');
  textArea.value = code;
  
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast(code + ' copied');
      animateButton(buttonElement);
    } else {
      alert('Copy failed. Please manually copy: ' + code);
    }
  } catch (err) {
    alert('Copy failed. Please manually copy: ' + code);
  }

  document.body.removeChild(textArea);
}

function animateButton(button) {
  if (!button) return;
  const originalText = button.innerText;
  button.innerText = 'Copied!';
  button.style.backgroundColor = '#00ADB5';
  
  setTimeout(function() {
    button.innerText = originalText;
    button.style.backgroundColor = '';
  }, 2000);
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');
  toast.style.display = 'block';

  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

function updateStats(games) {
  let totalCodes = 0;
  let activeCodes = 0;
  let expiredCodes = 0;

  games.forEach(game => {
    totalCodes += game.codes.length;
    game.codes.forEach(code => {
      const hasExpiry = code.expiry && !isNaN(new Date(code.expiry).getTime());
      
      if (!hasExpiry) {
        activeCodes++;
      } else if (new Date(code.expiry) > new Date()) {
        activeCodes++;
      } else {
        expiredCodes++;
      }
    });
  });

  document.getElementById('totalGames').textContent = games.length;
  document.getElementById('totalCodes').textContent = totalCodes;
  document.getElementById('activeCodes').textContent = activeCodes;
  document.getElementById('expiredCodes').textContent = expiredCodes;
}

function initSearch() {
  const searchInput = document.getElementById('searchInput');

  const fuse = new Fuse(
    allGames.flatMap(game =>
      game.codes.map(code => ({
        game: game.name,
        banner: game.banner,
        description: game.description,
        ...code
      }))
    ),
    {
      keys: ['game', 'code', 'reward', 'title', 'region'],
      threshold: 0.3
    }
  );

  searchInput.addEventListener('input', e => {
    const value = e.target.value.trim();

    if (!value) {
      if (currentFilter === 'All') {
        renderGames(allGames);
      } else {
        renderGames(
          allGames.filter(g => g.name === currentFilter)
        );
      }
      return;
    }

    const results = fuse.search(value).map(r => r.item);
    const grouped = [];

    results.forEach(item => {
      let existing = grouped.find(g => g.name === item.game);
      if (!existing) {
        existing = {
          name: item.game,
          banner: item.banner,
          description: item.description,
          codes: []
        };
        grouped.push(existing);
      }
      existing.codes.push(item);
    });

    renderGames(grouped);
  });
}

async function loadSubs() {
  try {
    const res = await fetch(
      'https://mixerno.space/api/youtube-channel-counter/user/UC3HIZWxbnOnP9Pe2TKMRc_A'
    );
    const data = await res.json();
    const subs = data?.counts?.[0]?.count;

    document.getElementById('subCount').innerText =
      subs
        ? `${subs.toLocaleString()} Subscribers`
        : 'MR VG GAMES';
  } catch {
    document.getElementById('subCount').innerText = 'MR VG GAMES';
  }
}

async function loadLiveStream() {
  document.getElementById('liveFrame').src =
    'https://www.youtube.com/embed/live_stream?channel=UC3HIZWxbnOnP9Pe2TKMRc_A';
}

loadSubs();
loadLiveStream();
loadData();