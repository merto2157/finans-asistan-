// Configuration
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'TSLA', 'SPY', 'QQQ', 'NVDA'];
const DEFAULT_NAMES = {
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corp.',
    'TSLA': 'Tesla Inc.',
    'SPY': 'S&P 500 ETF',
    'QQQ': 'Nasdaq 100 ETF',
    'NVDA': 'NVIDIA Corp.'
};

let currentMarketMode = 'stock'; // 'stock', 'crypto', or 'metals'
let priceChartInstance = null; // Global chart instance

class PortfolioManager {
    static getPortfolio() {
        return JSON.parse(localStorage.getItem('finans_portfolio')) || [];
    }

    static savePortfolio(portfolio) {
        localStorage.setItem('finans_portfolio', JSON.stringify(portfolio));
    }

    static addOrUpdate(symbol, qty, price, customDate = '') {
        let p = this.getPortfolio();
        let item = p.find(i => i.symbol === symbol);

        const addedQty = parseFloat(qty) || 0;
        const addedPrice = parseFloat(price) || 0;
        
        let txDateStr = '';
        if (customDate) {
            const d = new Date(customDate);
            txDateStr = d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else {
            txDateStr = new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        if (item) {
            const oldQty = parseFloat(item.qty) || 0;
            const oldPrice = parseFloat(item.price) || 0;

            if (!item.transactions) {
                item.transactions = [];
                if (oldQty > 0) {
                    item.transactions.push({ date: 'Geçmişten Devreden', qty: oldQty, price: oldPrice });
                }
            }

            const newQty = oldQty + addedQty;
            let newPrice = oldPrice;

            if (newQty > 0 && addedQty > 0) {
                newPrice = ((oldQty * oldPrice) + (addedQty * addedPrice)) / newQty;
            } else if (oldQty === 0 && addedQty > 0) {
                newPrice = addedPrice;
            }

            item.qty = newQty;
            item.price = newPrice;

            if (addedQty > 0) {
                item.transactions.push({ date: txDateStr, qty: addedQty, price: addedPrice });
            }
        } else {
            p.push({ 
                symbol, 
                qty: addedQty, 
                price: addedPrice,
                transactions: addedQty > 0 ? [{ date: txDateStr, qty: addedQty, price: addedPrice }] : []
            });
        }
        this.savePortfolio(p);
    }

    static remove(symbol) {
        let p = this.getPortfolio();
        p = p.filter(i => i.symbol !== symbol);
        this.savePortfolio(p);
    }
}

let currentAnalysisSymbol = null;

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initPortfolioUI();
    initChatAssistant();
    renderRightWatchlist();
});

function initChatAssistant() {
    const toggleBtn = document.getElementById('chat-toggle-btn');
    const closeBtn = document.getElementById('chat-close-btn');
    const settingsBtn = document.getElementById('chat-settings-btn');
    const chatWindow = document.getElementById('chat-window');
    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    
    const setupScreen = document.getElementById('chat-setup');
    const apiKeyInput = document.getElementById('gemini-api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const inputArea = document.querySelector('.chat-input-area');
    const expandBtn = document.getElementById('chat-expand-btn');

    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            chatWindow.classList.toggle('expanded');
        });
    }

    if(!toggleBtn) return;

    let chatSessions = [];
    let currentSessionId = null;
    let chatHistory = [];

    try {
        const savedSessions = localStorage.getItem('gemini_chat_sessions');
        if (savedSessions) {
            chatSessions = JSON.parse(savedSessions);
            if (chatSessions.length > 0) {
                currentSessionId = chatSessions[0].id;
                chatHistory = [...chatSessions[0].messages];
            }
        } else {
            const savedHistory = localStorage.getItem('gemini_chat_history');
            if (savedHistory) {
                const historyArr = JSON.parse(savedHistory);
                if (historyArr.length > 0) {
                    currentSessionId = Date.now().toString();
                    chatHistory = historyArr;
                    chatSessions = [{
                        id: currentSessionId,
                        title: 'Eski Sohbetiniz',
                        date: new Date().toLocaleString('tr-TR'),
                        messages: historyArr
                    }];
                    localStorage.setItem('gemini_chat_sessions', JSON.stringify(chatSessions));
                }
            }
        }
    } catch(e) {}

    window.deleteSession = function(e, id) {
        e.stopPropagation();
        if(confirm("Bu sohbeti silmek istediğinize emin misiniz?")) {
            chatSessions = chatSessions.filter(s => s.id !== id);
            localStorage.setItem('gemini_chat_sessions', JSON.stringify(chatSessions));
            if(currentSessionId === id) {
                startNewSession();
            }
            renderSessionsList();
        }
    };

    window.editSessionTitle = function(e, id) {
        e.stopPropagation();
        const session = chatSessions.find(s => s.id === id);
        if(!session) return;
        const newTitle = prompt("Sohbet başlığını düzenleyin:", session.title);
        if(newTitle && newTitle.trim() !== '') {
            session.title = newTitle.trim();
            localStorage.setItem('gemini_chat_sessions', JSON.stringify(chatSessions));
            renderSessionsList();
        }
    };

    function renderSessionsList() {
        const list = document.getElementById('chat-sessions-list');
        if (!list) return;
        list.innerHTML = '';
        if (chatSessions.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding: 1rem; color: rgba(255,255,255,0.5); font-size: 0.9rem;">Henüz kayıtlı sohbet yok.</div>';
            return;
        }
        chatSessions.forEach(session => {
            const el = document.createElement('div');
            el.className = 'chat-session-item' + (session.id === currentSessionId ? ' active' : '');
            el.style.flexDirection = 'row';
            el.style.justifyContent = 'space-between';
            el.style.alignItems = 'center';
            el.innerHTML = `
                <div style="flex: 1; overflow: hidden; margin-right: 0.5rem;">
                    <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${session.title}</div>
                    <div class="chat-session-date">${session.date}</div>
                </div>
                <div style="display: flex; gap: 0.3rem;">
                    <button onclick="editSessionTitle(event, '${session.id}')" style="background:none; border:none; color:rgba(255,255,255,0.7); cursor:pointer; font-size:1.1rem; padding:0 3px;" title="Yeniden Adlandır" onmouseover="this.style.color='#fbbf24'" onmouseout="this.style.color='rgba(255,255,255,0.7)'">✏️</button>
                    <button onclick="deleteSession(event, '${session.id}')" style="background:none; border:none; color:rgba(255,255,255,0.7); cursor:pointer; font-size:1.1rem; padding:0 3px;" title="Sohbeti Sil" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='rgba(255,255,255,0.7)'">🗑️</button>
                </div>
            `;
            el.addEventListener('click', () => loadSession(session.id));
            list.appendChild(el);
        });
    }

    function saveChatHistory() {
        if (!currentSessionId) {
            currentSessionId = Date.now().toString();
            let title = 'Yeni Sohbet';
            if (chatHistory.length > 1) {
                const firstUserMsg = chatHistory.find(m => m.role === 'user');
                if (firstUserMsg) {
                    title = firstUserMsg.text.split(' ').slice(0,4).join(' ') + '...';
                }
            }
            chatSessions.unshift({
                id: currentSessionId,
                title: title,
                date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                messages: chatHistory
            });
        } else {
            const session = chatSessions.find(s => s.id === currentSessionId);
            if (session) {
                session.messages = chatHistory;
                if (session.title === 'Yeni Sohbet' && chatHistory.length > 1) {
                    const firstUserMsg = chatHistory.find(m => m.role === 'user');
                    if (firstUserMsg) {
                        session.title = firstUserMsg.text.split(' ').slice(0,4).join(' ') + '...';
                    }
                }
            }
        }
        localStorage.setItem('gemini_chat_sessions', JSON.stringify(chatSessions));
        renderSessionsList();
    }

    function loadSession(id) {
        const session = chatSessions.find(s => s.id === id);
        if (session) {
            currentSessionId = id;
            chatHistory = [...session.messages];
            updateChatVisibility();
            document.getElementById('chat-sessions-view').style.display = 'none';
        }
    }

    function startNewSession() {
        currentSessionId = null;
        chatHistory = [];
        updateChatVisibility();
        document.getElementById('chat-sessions-view').style.display = 'none';
    }

    const newBtn = document.getElementById('chat-new-btn');
    const historyBtn = document.getElementById('chat-history-btn');
    
    if (newBtn) newBtn.addEventListener('click', startNewSession);
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            const view = document.getElementById('chat-sessions-view');
            if (view.style.display === 'none' || view.style.display === '') {
                view.style.display = 'flex';
                view.style.position = 'absolute';
                view.style.top = '60px'; 
                view.style.left = '0';
                view.style.right = '0';
                view.style.bottom = '60px'; 
                view.style.zIndex = '10';
                renderSessionsList();
            } else {
                view.style.display = 'none';
            }
        });
    }

    let geminiApiKey = localStorage.getItem('gemini_api_key') || '';

    function updateChatVisibility() {
        if (!geminiApiKey) {
            setupScreen.style.display = 'flex';
            messages.style.display = 'none';
            inputArea.style.display = 'none';
            settingsBtn.style.display = 'none';
            if(newBtn) newBtn.style.display = 'none';
            if(historyBtn) historyBtn.style.display = 'none';
        } else {
            setupScreen.style.display = 'none';
            messages.style.display = 'flex';
            inputArea.style.display = 'flex';
            settingsBtn.style.display = 'block';
            if(newBtn) newBtn.style.display = 'block';
            if(historyBtn) historyBtn.style.display = 'block';

            messages.innerHTML = ''; 

            if (chatHistory.length === 0) {
                const defaultMsg = 'Merhaba! Ben yapay zeka destekli Finans Asistanınız. Portföyünüzü inceleyebilir, bütçe yönetimi veya hisse senedi analizleri hakkında uzman tavsiyesi verebilirim. Size nasıl yardımcı olabilirim?';
                appendMessage(defaultMsg, 'bot', false);
                chatHistory.push({ role: 'bot', text: defaultMsg });
                saveChatHistory();
            } else {
                chatHistory.forEach(msg => {
                    appendMessage(msg.text, msg.role, msg.role === 'bot');
                });
            }
        }
    }

    toggleBtn.addEventListener('click', () => {
        chatWindow.style.display = 'flex';
        toggleBtn.style.display = 'none';
        updateChatVisibility();
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.style.display = 'none';
        toggleBtn.style.display = 'flex';
    });

    settingsBtn.addEventListener('click', () => {
        if(confirm("API Anahtarınızı ve Sohbet Geçmişinizi tamamen silmek istediğinize emin misiniz?")) {
            geminiApiKey = '';
            localStorage.removeItem('gemini_api_key');
            chatHistory = [];
            saveChatHistory();
            updateChatVisibility();
        }
    });

    saveApiKeyBtn.addEventListener('click', () => {
        const val = apiKeyInput.value.trim();
        if (val) {
            geminiApiKey = val;
            localStorage.setItem('gemini_api_key', val);
            updateChatVisibility();
        }
    });

    function appendMessage(text, type, isHtml = false) {
        const div = document.createElement('div');
        div.className = `chat-msg ${type}`;
        if (isHtml && typeof marked !== 'undefined') {
            div.innerHTML = marked.parse(text);
        } else {
            div.textContent = text;
        }
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return div;
    }

    async function processMessage() {
        const text = input.value.trim();
        if (!text || !geminiApiKey) return;

        appendMessage(text, 'user');
        input.value = '';
        
        const typingDiv = appendMessage('Asistan düşünüyor...', 'bot');
        typingDiv.style.opacity = '0.7';
        typingDiv.style.fontStyle = 'italic';

        const p = PortfolioManager.getPortfolio();
        let portfolioContext = "Kullanıcının güncel portföyü:\n";
        if (p.length === 0) {
            portfolioContext += "Şu an boş.\n";
        } else {
            p.forEach(i => {
                if(i.qty > 0) portfolioContext += `- ${i.symbol}: ${i.qty} adet, Maliyet: ${i.price}\n`;
                else portfolioContext += `- ${i.symbol}: (Sadece Takipte)\n`;
            });
        }

        const systemInstruction = `Sen uzman bir finansal danışman ve bütçe planlama asistanısın. Kullanıcıya yatırım tavsiyeleri, hisse analizleri ve bütçe yönetimi konusunda profesyonel, anlaşılır ve yardımcı yanıtlar vermelisin. Her zaman Markdown formatını kullanarak yanıt ver (kalın metinler, listeler vs.).\n\n${portfolioContext}\n\nKullanıcının sorularını bu portföye göre bağlamsallaştırabilirsin.`;

        try {
            const responseText = await FinanceAPI.getGeminiResponse(geminiApiKey, text, systemInstruction, chatHistory);
            
            messages.removeChild(typingDiv);
            
            if (responseText) {
                appendMessage(responseText, 'bot', true);
                chatHistory.push({ role: 'user', text: text });
                chatHistory.push({ role: 'bot', text: responseText });
                saveChatHistory();
            } else {
                appendMessage("Üzgünüm, API'den yanıt alınamadı. API Key'inizi kontrol edin veya limitlerinizi aşmadığınızdan emin olun.", 'bot');
            }
        } catch (err) {
            messages.removeChild(typingDiv);
            console.error("Chat Error:", err);
            if (err.message && err.message.includes("API_KEY_INVALID")) {
                appendMessage("Hata: API anahtarınız geçersiz. Lütfen ayarlar simgesine tıklayıp yeni bir anahtar girin.", 'bot');
            } else {
                appendMessage(`Bir hata oluştu: ${err.message}`, 'bot');
            }
        }
    }

    sendBtn.addEventListener('click', processMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processMessage();
    });
}

async function initDashboard() {
    initSearchEngine();
    await loadMarketOverview();
    await loadPortfolio();
    await loadNews();
}

window.switchMarketMode = async function(mode) {
    if (currentMarketMode === mode) return;
    currentMarketMode = mode;

    // Update tab styles
    document.querySelectorAll('.market-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${mode}`).classList.add('active');

    const scDash = document.getElementById('stock-crypto-dashboard');
    const mDash = document.getElementById('metals-dashboard');
    const searchInput = document.getElementById('searchInput');
    const marketIcon = document.getElementById('market-overview-icon');

    if (mode === 'metals') {
        scDash.style.display = 'none';
        mDash.style.display = 'block';
        searchInput.placeholder = "Emtia veya döviz ara (örn: Gram Altın, USD)...";
        await renderMetalsDashboard();
    } else {
        mDash.style.display = 'none';
        scDash.style.display = 'block';
        
        if (mode === 'crypto') {
            searchInput.placeholder = "Kripto ara (örn: BTC, Ethereum, Solana)...";
            if(marketIcon) marketIcon.textContent = '₿';
        } else {
            searchInput.placeholder = "Hisse ara ve analiz et (örn: AAPL, TSLA)...";
            if(marketIcon) marketIcon.textContent = '🌐';
        }
        await loadMarketOverview();
    }
};

async function renderMetalsDashboard() {
    const grid = document.getElementById('metals-grid');
    const loader = document.getElementById('metals-loader');
    if (!grid) return;

    loader.style.display = 'block';

    const apiKey = FinanceAPI.getCollectApiKey();
    if (!apiKey) {
        loader.style.display = 'none';
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding: 2rem; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                <h3 style="margin-bottom: 1rem; color: #f3ba2f;">CollectAPI Anahtarı Gerekli</h3>
                <p style="color: rgba(255,255,255,0.7); margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                    Türkiye piyasası altın ve döviz fiyatlarını canlı görebilmek için CollectAPI anahtarınızı girmeniz gerekmektedir. Ücretsiz hesabınızdan aldığınız anahtarı aşağıya yapıştırın.
                </p>
                <div style="display:flex; gap: 0.5rem; justify-content:center; max-width: 400px; margin: 0 auto;">
                    <input type="text" id="collectapi-key-input" placeholder="apikey ..." style="flex:1; padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white;">
                    <button class="btn-primary" onclick="saveCollectApiKey()" style="padding: 0.8rem 1.5rem;">Kaydet</button>
                </div>
            </div>
        `;
        if (!window.saveCollectApiKey) {
            window.saveCollectApiKey = async () => {
                const val = document.getElementById('collectapi-key-input').value.trim();
                if (val) {
                    FinanceAPI.setCollectApiKey(val);
                    await renderMetalsDashboard();
                }
            };
        }
        return;
    }

    const [goldData, forexData] = await Promise.all([
        FinanceAPI.getCollectApiGold(),
        FinanceAPI.getCollectApiForex()
    ]);
    
    loader.style.display = 'none';

    if (!goldData || !forexData) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding: 2rem;">
                <p style="color:var(--accent-red); margin-bottom: 1rem;">CollectAPI'den veri çekilemedi. API anahtarınız hatalı veya limitiniz dolmuş olabilir.</p>
                <button class="btn-primary" onclick="FinanceAPI.setCollectApiKey(''); renderMetalsDashboard();" style="padding: 0.5rem 1rem;">Anahtarı Sıfırla</button>
            </div>
        `;
        return;
    }

    const findGold = (name) => goldData.find(g => g.name.toLowerCase() === name.toLowerCase()) || { selling: 0, rate: 0 };
    const findForex = (code) => forexData.find(f => f.code.toUpperCase() === code.toUpperCase()) || { selling: 0, rate: 0 };

    const gramAltin = findGold('Gram Altın');
    const ceyrekAltin = findGold('Çeyrek Altın');
    const gumus = findGold('Gümüş');
    
    const usd = findForex('USD');
    const eur = findForex('EUR');
    const gbp = findForex('GBP');

    const createMetalCard = (id, title, priceTL, changePctStr, cls) => {
        let changePct = parseFloat(changePctStr) || 0;
        const color = changePct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        const sign = changePct >= 0 ? '+' : '';
        const arrow = changePct >= 0 ? '▲' : '▼';
        return `
            <div class="metal-card ${cls}">
                <div class="metal-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="metal-title">${title}</span>
                    <button onclick="analyzeMetal('${id}', '${title}', '${id}')" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background: rgba(59, 130, 246, 0.2); border:1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; cursor: pointer; color: white; transition: all 0.2s;">İncele & Ekle</button>
                </div>
                <div class="metal-price">₺${parseFloat(priceTL).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                <div class="metal-change" style="color: ${color}">
                    ${arrow} ${sign}${changePct.toFixed(2)}%
                </div>
            </div>
        `;
    };

    grid.innerHTML = `
        ${createMetalCard('METAL:Gram Altın', 'Gram Altın', gramAltin.selling, gramAltin.rate, '')}
        ${createMetalCard('METAL:Çeyrek Altın', 'Çeyrek Altın', ceyrekAltin.selling, ceyrekAltin.rate, '')}
        ${createMetalCard('METAL:Gümüş', 'Gram Gümüş', gumus.selling, gumus.rate, 'silver')}
        ${createMetalCard('FOREX:USD', 'Dolar / TL', usd.selling, usd.rate, 'currency')}
        ${createMetalCard('FOREX:EUR', 'Euro / TL', eur.selling, eur.rate, 'currency')}
        ${createMetalCard('FOREX:GBP', 'Sterlin / TL', gbp.selling, gbp.rate, 'currency')}
    `;
}

async function loadMarketOverview() {
    const grid = document.getElementById('market-overview-grid');
    if (!grid) return;

    let indices = [];
    if (currentMarketMode === 'stock') {
        indices = [
            { symbol: 'SPY', name: 'S&P 500' },
            { symbol: 'QQQ', name: 'Nasdaq 100' },
            { symbol: 'DIA', name: 'Dow Jones' }
        ];
    } else {
        indices = [
            { symbol: 'BTCUSDT', name: 'Bitcoin (BTC)' },
            { symbol: 'ETHUSDT', name: 'Ethereum (ETH)' },
            { symbol: 'SOLUSDT', name: 'Solana (SOL)' }
        ];
    }

    grid.innerHTML = '<div class="loader">Veriler yükleniyor...</div>';

    try {
        let html = '';
        for (let idx of indices) {
            let quote = null;
            if (currentMarketMode === 'crypto') {
                quote = await FinanceAPI.getCryptoQuote(idx.symbol);
            } else {
                quote = await FinanceAPI.getQuote(idx.symbol);
            }
            if (!quote || quote.c === undefined || quote.c === 0) continue;

            const price = quote.c.toFixed(2);
            const dp = quote.dp || 0;
            const sign = dp >= 0 ? '+' : '';
            const color = dp >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            const arrow = dp >= 0 ? '▲' : '▼';

            html += `
                <div class="market-card">
                    <div class="market-title">${idx.name}</div>
                    <div class="market-price">$${price}</div>
                    <div class="market-change" style="color: ${color}">
                        ${arrow} ${sign}${dp.toFixed(2)}%
                    </div>
                </div>
            `;
        }
        
        if (html === '') {
            grid.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">Piyasa verisi çekilemedi.</p>';
        } else {
            grid.innerHTML = html;
        }

    } catch (e) {
        grid.innerHTML = '<p style="color: var(--accent-red); font-size: 0.9rem;">Hata oluştu.</p>';
    }
}

async function loadPortfolio() {
    const portfolio = PortfolioManager.getPortfolio();
    const grid = document.getElementById('portfolio-grid');
    if (portfolio.length === 0) {
        grid.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">Henüz portföyünüzüze veri eklemediniz.</p>';
        return;
    }
    grid.innerHTML = '<div class="loader">Portföy verileri çekiliyor...</div>';

    let html = '';
    for (let item of portfolio) {
        try {
            const quote = await FinanceAPI.getSmartQuote(item.symbol);
            if (!quote || quote.c === undefined || quote.c === 0) continue;

            const currentPrice = quote.c;
            let plString = '';
            let colorClass = '';

            let typeTagHtml = '';
            if (quote.isMetal || quote.isForex) {
                const tagText = quote.isMetal ? 'Emtia' : 'Döviz';
                typeTagHtml = `<span style="font-size: 0.65rem; background: rgba(156, 163, 175, 0.15); color: #9ca3af; padding: 2px 4px; border-radius: 4px; margin-left: 6px; vertical-align: middle;">${tagText}</span>`;
            } else if (quote.isCrypto) {
                typeTagHtml = `<span style="font-size: 0.65rem; background: rgba(243, 186, 47, 0.15); color: #f3ba2f; padding: 2px 4px; border-radius: 4px; margin-left: 6px; vertical-align: middle;">Kripto</span>`;
            } else {
                typeTagHtml = `<span style="font-size: 0.65rem; background: rgba(59, 130, 246, 0.15); color: #3b82f6; padding: 2px 4px; border-radius: 4px; margin-left: 6px; vertical-align: middle;">Hisse</span>`;
            }

            const curSymbol = (quote.isMetal || quote.isForex) ? '₺' : '$';
            const curName = (quote.isMetal || quote.isForex) ? 'TL' : 'USD';

            if (item.qty > 0 && item.price > 0) {
                const cost = item.qty * item.price;
                const currentVal = item.qty * currentPrice;
                const profit = currentVal - cost;
                const profitPct = (profit / cost) * 100;
                const sign = profit >= 0 ? '+' : '';
                colorClass = profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                const bgClass = profit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                
                plString = `<div class="port-pl" style="color:${colorClass}; background:${bgClass};">
                    ${sign}${profit.toFixed(2)} ${curName} (${sign}${profitPct.toFixed(2)}%)
                </div>
                <div class="port-qty">${item.qty} Adet • Maliyet: ${curSymbol}${item.price}</div>`;
            } else {
                // Sadece favori (takip listesi)
                const dp = quote.dp || 0;
                const sign = dp >= 0 ? '+' : '';
                colorClass = dp >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                const bgClass = dp >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                
                plString = `<div class="port-pl" style="color:${colorClass}; background:${bgClass};">
                    Günlük: ${sign}${dp.toFixed(2)}%
                </div>
                <div class="port-qty">Favorilerimde (Adet girilmedi)</div>`;
            }

            html += `
                <div class="portfolio-item">
                    <button class="port-remove-btn" onclick="removeFromPortfolio('${item.symbol}')">&times;</button>
                    <div class="port-symbol" style="display:flex; align-items:center;">${item.symbol.replace(/^(METAL:|FOREX:)/i, '')} ${typeTagHtml}</div>
                    <div class="port-price">${curSymbol}${currentPrice.toFixed(2)}</div>
                    ${plString}
                </div>
            `;
        } catch(err) {
            console.error("loadPortfolio Error on item:", item, err);
        }
    }

    if(html === '') {
        grid.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">Geçerli bir hisse bulunamadı.</p>';
    } else {
        grid.innerHTML = html;
    }
}

window.removeFromPortfolio = async function(symbol) {
    if(confirm(`"${symbol}" portföyden silinecek. Emin misiniz?`)) {
        PortfolioManager.remove(symbol);
        await loadPortfolio();
    }
};

function initPortfolioUI() {
    const modal = document.getElementById('portfolio-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const addBtn = document.getElementById('add-portfolio-btn');
    const addFavBtn = document.getElementById('add-favorite-btn');
    const saveBtn = document.getElementById('save-portfolio-btn');

    const openDpBtn = document.getElementById('open-detailed-portfolio-btn');
    const closeDpBtn = document.getElementById('close-detailed-portfolio-btn');
    const dpOverlay = document.getElementById('detailed-portfolio-overlay');
    const dpCurrencyToggle = document.getElementById('dp-currency-toggle');

    if (openDpBtn && dpOverlay) {
        openDpBtn.onclick = () => {
            dpOverlay.style.display = 'flex';
            loadDetailedPortfolio();
        };
    }
    if (dpCurrencyToggle) {
        dpCurrencyToggle.addEventListener('change', () => {
            loadDetailedPortfolio();
        });
    }
    if (closeDpBtn && dpOverlay) {
        closeDpBtn.onclick = () => {
            dpOverlay.style.display = 'none';
        };
    }

    addBtn.onclick = () => {
        if (!currentAnalysisSymbol) return;
        
        const p = PortfolioManager.getPortfolio();
        const existing = p.find(i => i.symbol === currentAnalysisSymbol);
        
        document.getElementById('port-qty').value = existing ? existing.qty : '';
        document.getElementById('port-price').value = existing ? existing.price : '';
        
        modal.style.display = 'block';
    };

    if (addFavBtn) {
        addFavBtn.onclick = async () => {
            if (!currentAnalysisSymbol) return;
            const existing = PortfolioManager.getPortfolio().find(i => i.symbol === currentAnalysisSymbol);
            if (!existing) {
                const type = currentAnalysisSymbol.startsWith('METAL:') ? 'metal' : (currentAnalysisSymbol.startsWith('FOREX:') ? 'forex' : (currentAnalysisSymbol.includes('USDT') ? 'crypto' : 'stock'));
                PortfolioManager.addOrUpdate(currentAnalysisSymbol, 0, 0);
                alert("Takip listenize eklendi!");
            } else if (existing.qty === 0) {
                PortfolioManager.remove(currentAnalysisSymbol);
                alert("Takip listesinden çıkarıldı!");
            } else {
                alert("Bu varlık zaten portföyünüzde mevcut, takip listesine eklenemez.");
            }
            renderRightWatchlist();
            loadPortfolio();
            // Re-render button logic by re-running renderAnalysis display setup
            const p2 = PortfolioManager.getPortfolio();
            const existingNow = p2.find(i => i.symbol === currentAnalysisSymbol);
            if(existingNow && existingNow.qty > 0) {
                addBtn.textContent = '💼 Düzenle';
                addFavBtn.style.display = 'none';
            } else {
                addBtn.textContent = '💼 Portföye Ekle';
                addFavBtn.style.display = 'inline-block';
                if (existingNow && existingNow.qty === 0) {
                    addFavBtn.textContent = '⭐ Takipten Çıkar';
                    addFavBtn.style.background = 'rgba(255,255,255,0.1)';
                    addFavBtn.style.color = '#fff';
                    addFavBtn.style.fontWeight = 'normal';
                } else {
                    addFavBtn.textContent = '⭐ Takibe Al';
                    addFavBtn.style.background = 'var(--accent-orange)';
                    addFavBtn.style.color = '#111';
                    addFavBtn.style.fontWeight = '600';
                }
            }
        };
    }

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = (e) => {
        if (e.target == modal) {
            modal.style.display = 'none';
        }
    };

    saveBtn.onclick = async () => {
        const qty = parseFloat(document.getElementById('port-qty').value) || 0;
        const price = parseFloat(document.getElementById('port-price').value) || 0;
        const portDateEl = document.getElementById('port-date');
        const customDate = portDateEl ? portDateEl.value : '';

        PortfolioManager.addOrUpdate(currentAnalysisSymbol, qty, price, customDate);
        modal.style.display = 'none';
        await loadPortfolio();
        renderRightWatchlist();
        
        // If detailed view is open, refresh it
        if (document.getElementById('detailed-portfolio-overlay').style.display === 'flex') {
            await loadDetailedPortfolio();
        }
    };
}

async function loadDetailedPortfolio() {
    const p = PortfolioManager.getPortfolio();
    const loader = document.getElementById('dp-loader');
    const container = document.getElementById('dp-data-container');
    const ownedList = document.getElementById('dp-owned-list');
    const watchList = document.getElementById('dp-watch-list');

    loader.style.display = 'block';
    container.style.display = 'none';
    ownedList.innerHTML = '';
    watchList.innerHTML = '';

    if (p.length === 0) {
        loader.textContent = "Portföyünüz boş.";
        return;
    } else {
        loader.textContent = "Portföy verileri detaylı analiz ediliyor...";
    }

    let totalCostUSD = 0;
    let totalValueUSD = 0;
    let totalCostTL = 0;
    let totalValueTL = 0;

    let ownedHtml = '';
    let watchHtml = '';

    const quotePromises = p.map(item => FinanceAPI.getSmartQuote(item.symbol));
    const quotes = await Promise.all(quotePromises);

    let usdRate = 1;
    try {
        const usdQuote = await FinanceAPI.getSmartQuote('FOREX:USD');
        if (usdQuote && usdQuote.c) {
            usdRate = usdQuote.c;
        }
    } catch (e) {
        console.error('USD rate fetch error', e);
    }

    const toggleElement = document.getElementById('dp-currency-toggle');
    const currencyMode = toggleElement ? toggleElement.value : 'split';

    p.forEach((item, index) => {
        try {
            const quote = quotes[index];
            if (!quote || quote.c === undefined || quote.c === 0) return;

            const currentPrice = quote.c;
            const changePct = quote.dp;
            const color = changePct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            const sign = changePct >= 0 ? '+' : '';

            let typeTag = '';
            if (quote.isMetal || quote.isForex) {
                const tagText = quote.isMetal ? 'Emtia' : 'Döviz';
                typeTag = `<span style="font-size: 0.7rem; background: rgba(156, 163, 175, 0.15); color: #9ca3af; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">${tagText}</span>`;
            } else if (quote.isCrypto) {
                typeTag = `<span style="font-size: 0.7rem; background: rgba(243, 186, 47, 0.15); color: #f3ba2f; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">Kripto</span>`;
            } else {
                typeTag = `<span style="font-size: 0.7rem; background: rgba(59, 130, 246, 0.15); color: #3b82f6; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">Hisse</span>`;
            }

            const curSymbol = (quote.isMetal || quote.isForex) ? '₺' : '$';

            let rowCurrentPrice = currentPrice;
            let rowCurSymbol = curSymbol;
            let rowItemPrice = item.price;
            let rowCostAmount = item.qty * item.price;
            let rowValueAmount = item.qty * currentPrice;

            if (currencyMode === 'usd' && curSymbol === '₺') {
                rowCurrentPrice = currentPrice / usdRate;
                rowCurSymbol = '$';
                rowItemPrice = item.price / usdRate;
                rowCostAmount = rowCostAmount / usdRate;
                rowValueAmount = rowValueAmount / usdRate;
            } else if (currencyMode === 'tl' && curSymbol === '$') {
                rowCurrentPrice = currentPrice * usdRate;
                rowCurSymbol = '₺';
                rowItemPrice = item.price * usdRate;
                rowCostAmount = rowCostAmount * usdRate;
                rowValueAmount = rowValueAmount * usdRate;
            }

            if (item.qty > 0) {
                const plAmount = rowValueAmount - rowCostAmount;
                const plPct = rowCostAmount > 0 ? (plAmount / rowCostAmount) * 100 : 0;
                
                // Add to overall totals using ORIGINAL currency amounts
                const origCostAmount = item.qty * item.price;
                const origValueAmount = item.qty * currentPrice;
                if (quote.isMetal || quote.isForex) {
                    totalCostTL += origCostAmount;
                    totalValueTL += origValueAmount;
                } else {
                    totalCostUSD += origCostAmount;
                    totalValueUSD += origValueAmount;
                }

                const plColor = plAmount >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                const plSign = plAmount >= 0 ? '+' : '';

                ownedHtml += `
                    <div class="dp-list-item">
                        <div style="display: flex; align-items: center;">
                            <span class="dp-symbol">${item.symbol.replace(/^(METAL:|FOREX:)/i, '')}</span>
                            ${typeTag}
                        </div>
                        <div>
                            <span style="font-weight:600">${item.qty} adet</span>
                            <span class="dp-sub-text">Maliyet: ${rowCurSymbol}${rowItemPrice.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style="font-weight:600">${rowCurSymbol}${rowCurrentPrice.toFixed(2)}</span>
                            <span class="dp-sub-text" style="color:${color}">${sign}${changePct.toFixed(2)}%</span>
                        </div>
                        <div>
                            <span style="color:${plColor}; font-weight:700;">${plSign}${rowCurSymbol}${Math.abs(plAmount).toFixed(2)}</span>
                            <span class="dp-sub-text" style="color:${plColor}">${plSign}${Math.abs(plPct).toFixed(2)}%</span>
                        </div>
                        <div>
                            <span style="font-weight:700">${rowCurSymbol}${rowValueAmount.toFixed(2)}</span>
                        </div>
                        <div style="text-align:right; display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
                            <button class="dp-action-btn" onclick="toggleTxHistory('${item.symbol}')" title="İşlem Geçmişi" style="font-size:1.1rem; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:2px 6px;">📋</button>
                            <button class="dp-action-btn" onclick="removeDpItem('${item.symbol}')" title="Portföyden Çıkar">&times;</button>
                        </div>
                    </div>
                    <div id="tx-history-${item.symbol.replace(/[^a-zA-Z0-9]/g, '')}" class="tx-history-container" style="display:none; grid-column: 1 / -1; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; margin-top: 0.5rem; border-left: 3px solid var(--accent-blue);">
                        <!-- TX history injected here -->
                    </div>
                `;
            } else {
                watchHtml += `
                    <div class="dp-list-item watchlist-item">
                        <div style="display: flex; align-items: center;">
                            <span class="dp-symbol">${item.symbol.replace(/^(METAL:|FOREX:)/i, '')}</span>
                            ${typeTag}
                        </div>
                        <div>
                            <span style="font-weight:600">${rowCurSymbol}${rowCurrentPrice.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style="color:${color}; font-weight:600;">${sign}${changePct.toFixed(2)}%</span>
                        </div>
                        <div style="text-align:right; display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
                            <button class="dp-action-btn" onclick="toggleTxHistory('${item.symbol}')" title="İşlem Geçmişi" style="font-size:1.1rem; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:2px 6px;">📋</button>
                            <button class="dp-action-btn" onclick="removeDpItem('${item.symbol}')" title="Portföyden Çıkar">&times;</button>
                        </div>
                    </div>
                    <div id="tx-history-${item.symbol.replace(/[^a-zA-Z0-9]/g, '')}" class="tx-history-container" style="display:none; grid-column: 1 / -1; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; margin-top: 0.5rem; border-left: 3px solid var(--accent-blue);">
                        <!-- TX history injected here -->
                    </div>
                `;
            }
        } catch (err) {
            console.error("Detailed Portfolio Error on item:", item, err);
        }
    });

    let finalCostUSD = totalCostUSD;
    let finalValueUSD = totalValueUSD;
    let finalCostTL = totalCostTL;
    let finalValueTL = totalValueTL;

    if (currencyMode === 'usd') {
        finalCostUSD += (totalCostTL / usdRate);
        finalValueUSD += (totalValueTL / usdRate);
    } else if (currencyMode === 'tl') {
        finalCostTL += (totalCostUSD * usdRate);
        finalValueTL += (totalValueUSD * usdRate);
    }

    const plAmountEl = document.getElementById('dp-total-pl-amount');
    const plPctEl = document.getElementById('dp-total-pl-pct');

    if (currencyMode === 'split') {
        document.getElementById('dp-total-cost').innerHTML = `$${totalCostUSD.toFixed(2)} <span style="font-size:0.8rem; color:#888;">+ ₺${totalCostTL.toFixed(2)}</span>`;
        document.getElementById('dp-total-value').innerHTML = `$${totalValueUSD.toFixed(2)} <span style="font-size:0.8rem; color:#888;">+ ₺${totalValueTL.toFixed(2)}</span>`;
        
        const totalPlUSD = totalValueUSD - totalCostUSD;
        const totalPlPctUSD = totalCostUSD > 0 ? (totalPlUSD / totalCostUSD) * 100 : 0;
        
        const plColor = totalPlUSD >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        const plSign = totalPlUSD >= 0 ? '+' : '';
        
        plAmountEl.textContent = `${plSign}$${Math.abs(totalPlUSD).toFixed(2)}`;
        plAmountEl.style.color = plColor;
        
        plPctEl.textContent = `${plSign}${Math.abs(totalPlPctUSD).toFixed(2)}% (Sadece USD)`;
        plPctEl.className = 'badge'; 
        plPctEl.style.backgroundColor = totalPlUSD >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        plPctEl.style.color = plColor;
    } else if (currencyMode === 'usd') {
        document.getElementById('dp-total-cost').innerHTML = `$${finalCostUSD.toFixed(2)}`;
        document.getElementById('dp-total-value').innerHTML = `$${finalValueUSD.toFixed(2)}`;
        
        const totalPlUSD = finalValueUSD - finalCostUSD;
        const totalPlPctUSD = finalCostUSD > 0 ? (totalPlUSD / finalCostUSD) * 100 : 0;
        
        const plColor = totalPlUSD >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        const plSign = totalPlUSD >= 0 ? '+' : '';
        
        plAmountEl.textContent = `${plSign}$${Math.abs(totalPlUSD).toFixed(2)}`;
        plAmountEl.style.color = plColor;
        
        plPctEl.textContent = `${plSign}${Math.abs(totalPlPctUSD).toFixed(2)}%`;
        plPctEl.className = 'badge'; 
        plPctEl.style.backgroundColor = totalPlUSD >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        plPctEl.style.color = plColor;
    } else if (currencyMode === 'tl') {
        document.getElementById('dp-total-cost').innerHTML = `₺${finalCostTL.toFixed(2)}`;
        document.getElementById('dp-total-value').innerHTML = `₺${finalValueTL.toFixed(2)}`;
        
        const totalPlTL = finalValueTL - finalCostTL;
        const totalPlPctTL = finalCostTL > 0 ? (totalPlTL / finalCostTL) * 100 : 0;
        
        const plColor = totalPlTL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        const plSign = totalPlTL >= 0 ? '+' : '';
        
        plAmountEl.textContent = `${plSign}₺${Math.abs(totalPlTL).toFixed(2)}`;
        plAmountEl.style.color = plColor;
        
        plPctEl.textContent = `${plSign}${Math.abs(totalPlPctTL).toFixed(2)}%`;
        plPctEl.className = 'badge'; 
        plPctEl.style.backgroundColor = totalPlTL >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        plPctEl.style.color = plColor;
    }

    if (ownedHtml === '') ownedList.innerHTML = '<div style="padding:1rem; color:rgba(255,255,255,0.5);">Yatırımınız bulunmuyor.</div>';
    else ownedList.innerHTML = ownedHtml;

    if (watchHtml === '') watchList.innerHTML = '<div style="padding:1rem; color:rgba(255,255,255,0.5);">Takip ettiğiniz hisse bulunmuyor.</div>';
    else watchList.innerHTML = watchHtml;

    loader.style.display = 'none';
    container.style.display = 'block';
}

window.removeDpItem = async function(symbol) {
    if(confirm(`"${symbol}" silinecek. Emin misiniz?`)) {
        PortfolioManager.remove(symbol);
        await loadPortfolio();
        await loadDetailedPortfolio();
    }
};

async function loadNews() {
    const newsContainer = document.getElementById('news-feed');
    try {
        const news = await FinanceAPI.getGeneralNews();
        if (!news || news.length === 0) {
            newsContainer.innerHTML = '<div class="loader">Haber bulunamadı.</div>';
            return;
        }

        const topNews = news.slice(0, 15);
        newsContainer.innerHTML = '';

        topNews.forEach(item => {
            const date = new Date(item.datetime * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            const imageHtml = item.image ? `<img src="${item.image}" alt="News" class="news-image" onerror="this.style.display='none'">` : '<div class="news-image" style="display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:#666">No Image</div>';
            
            const a = document.createElement('a');
            a.href = item.url;
            a.target = '_blank';
            a.className = 'news-card-horizontal';
            a.innerHTML = `
                ${imageHtml}
                <div class="news-content">
                    <h3 class="news-title">${item.headline}</h3>
                    <div class="news-meta">
                        <span class="news-source">${item.source}</span>
                        <span class="news-time">${date}</span>
                    </div>
                </div>
            `;
            newsContainer.appendChild(a);
        });

    } catch (error) {
        newsContainer.innerHTML = '<div class="loader" style="color:var(--accent-red)">Haberler yüklenirken hata oluştu.</div>';
    }
}

function initSearchEngine() {
    const chipsContainer = document.getElementById('quickChips');
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const analysisSection = document.getElementById('detailed-analysis');

    if (!chipsContainer || !searchBtn || !searchInput) return;

    const handleSearch = async (val) => {
        if (!val) return;
        
        searchBtn.textContent = 'Aranıyor...';
        searchBtn.disabled = true;

        analysisSection.style.display = 'block';
        document.getElementById('analysis-loader').style.display = 'block';
        document.getElementById('analysis-content').style.display = 'none';

        if (currentMarketMode === 'metals') {
            const searchResult = await FinanceAPI.searchMetals(val);
            if (searchResult) {
                searchBtn.textContent = 'Analiz Et';
                searchBtn.disabled = false;
                await analyzeMetal(searchResult.id, searchResult.name, searchResult.symbol.toUpperCase());
            } else {
                alert('Aradığınız emtia veya döviz bulunamadı. Lütfen "Gram Altın" veya "USD" gibi geçerli bir terim girin.');
                analysisSection.style.display = 'none';
                searchBtn.textContent = 'Analiz Et';
                searchBtn.disabled = false;
            }
        } else if (currentMarketMode === 'crypto') {
            let query = val.replace(/^BINANCE:/i, '').replace(/USDT$/i, '');
            const searchResult = await FinanceAPI.searchCrypto(query);
            if (searchResult) {
                searchBtn.textContent = 'Analiz Et';
                searchBtn.disabled = false;
                await analyzeCrypto(searchResult.id, searchResult.name, searchResult.symbol.toUpperCase());
            } else {
                alert('Aradığınız kripto para bulunamadı.');
                analysisSection.style.display = 'none';
                searchBtn.textContent = 'Analiz Et';
                searchBtn.disabled = false;
            }
        } else {
            const searchResult = await FinanceAPI.searchSymbol(val);
            if (searchResult && searchResult.result && searchResult.result.length > 0) {
                const bestMatch = searchResult.result.find(r => r.type === 'Common Stock' && !r.symbol.includes('.')) || searchResult.result[0];
                val = bestMatch.symbol;
            } else {
                val = val.toUpperCase();
            }

            searchBtn.textContent = 'Analiz Et';
            searchBtn.disabled = false;
            
            await analyzeStock(val);
        }
    };

    searchBtn.addEventListener('click', () => {
        handleSearch(searchInput.value.trim());
        searchInput.value = '';
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch(searchInput.value.trim());
            searchInput.value = '';
        }
    });

    const popularStocks = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'META'];
    
    popularStocks.forEach(sym => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = sym;
        chip.addEventListener('click', () => {
            handleSearch(sym);
        });
        chipsContainer.appendChild(chip);
    });
}

async function analyzeStock(symbol) {
    const analysisSection = document.getElementById('detailed-analysis');
    const loader = document.getElementById('analysis-loader');
    const content = document.getElementById('analysis-content');
    
    analysisSection.style.display = 'block';
    loader.style.display = 'block';
    content.style.display = 'none';

    try {
        currentAnalysisSymbol = symbol;
        let [quote, profile, metrics, candles, earnings] = await Promise.all([
            FinanceAPI.getQuote(symbol),
            FinanceAPI.getProfile(symbol),
            FinanceAPI.getMetrics(symbol),
            FinanceAPI.getCandles(symbol, 90), 
            FinanceAPI.getEarnings(symbol) 
        ]);

        if (!quote || (quote.c === 0 && quote.pc === 0) || quote.c === undefined || quote.c === null) {
            alert('Aradığınız kriterlere uygun geçerli bir borsa verisi bulunamadı.');
            analysisSection.style.display = 'none';
            return;
        }

        if (!candles || candles.s !== 'ok') {
            candles = generateSimulatedCandles(quote.c);
        }

        renderAnalysis(symbol, quote, profile, metrics, candles, earnings);
        
    } catch (e) {
        console.error('Analyze Error:', e);
        alert('Analiz sırasında bir hata oluştu: ' + e.message);
        analysisSection.style.display = 'none';
    }
}

async function analyzeCrypto(id, name, symbol) {
    const analysisSection = document.getElementById('detailed-analysis');
    const loader = document.getElementById('analysis-loader');
    const content = document.getElementById('analysis-content');
    
    analysisSection.style.display = 'block';
    loader.style.display = 'block';
    content.style.display = 'none';

    try {
        currentAnalysisSymbol = symbol;
        let [quote, candles] = await Promise.all([
            FinanceAPI.getCryptoQuote(id),
            FinanceAPI.getCryptoCandles(id, 90)
        ]);

        if (!quote || quote.c === undefined || quote.c === null) {
            alert('Aradığınız kritere uygun geçerli bir kripto verisi bulunamadı.');
            analysisSection.style.display = 'none';
            return;
        }

        if (!candles || candles.s !== 'ok') {
            candles = generateSimulatedCandles(quote.c);
        }

        const profile = { name: name };
        const metrics = null; 
        const earnings = [];

        renderAnalysis(symbol, quote, profile, metrics, candles, earnings);
        
    } catch (e) {
        console.error('Analyze Crypto Error:', e);
        alert('Analiz sırasında bir hata oluştu: ' + e.message);
        analysisSection.style.display = 'none';
    }
}

async function analyzeMetal(id, name, symbol) {
    const analysisSection = document.getElementById('detailed-analysis');
    const loader = document.getElementById('analysis-loader');
    const content = document.getElementById('analysis-content');
    
    analysisSection.style.display = 'block';
    loader.style.display = 'block';
    content.style.display = 'none';

    try {
        currentAnalysisSymbol = id;
        let quote = await FinanceAPI.getSmartQuote(id);

        if (!quote) {
            alert('Aradığınız kritere uygun geçerli veri bulunamadı.');
            analysisSection.style.display = 'none';
            return;
        }

        let candles = generateSimulatedCandles(quote.c);
        const profile = { name: name };
        
        renderAnalysis(id, quote, profile, null, candles, []);
        
    } catch (e) {
        console.error('Analyze Metal Error:', e);
        alert('Analiz sırasında bir hata oluştu: ' + e.message);
        analysisSection.style.display = 'none';
    }
}

function renderAnalysis(symbol, quote, profile, metrics, candles, earnings) {
    document.getElementById('analysis-loader').style.display = 'none';
    document.getElementById('analysis-content').style.display = 'block';

    const fundamentalsSection = document.querySelector('.fundamentals-section');
    const earningsSection = document.querySelector('.earnings-section');

    if (currentMarketMode === 'crypto' || currentMarketMode === 'metals') {
        if(fundamentalsSection) fundamentalsSection.style.display = 'none';
        if(earningsSection) earningsSection.style.display = 'none';
    } else {
        if(fundamentalsSection) fundamentalsSection.style.display = 'grid';
        if(earningsSection) earningsSection.style.display = 'block';
    }

    const nameToDisplay = profile && profile.name ? profile.name : symbol;
    document.getElementById('det-name').textContent = nameToDisplay;
    document.getElementById('det-symbol').textContent = symbol.replace(/^(METAL:|FOREX:)/i, '');
    
    const curName = (quote.isMetal || quote.isForex) ? 'TL' : 'USD';
    const addBtn = document.getElementById('add-portfolio-btn');
    const addFavBtn = document.getElementById('add-favorite-btn');
    document.getElementById('det-price').textContent = `${quote.c.toFixed(2)} ${curName}`;
    addBtn.style.display = 'inline-block';
    
    const existingItem = PortfolioManager.getPortfolio().find(i => i.symbol === symbol);
    if(existingItem && existingItem.qty > 0) {
        addBtn.textContent = '💼 Düzenle';
        addBtn.style.background = 'rgba(255,255,255,0.1)';
        addBtn.style.color = '#fff';
        if(addFavBtn) {
            addFavBtn.style.display = 'inline-block';
            addFavBtn.textContent = '⭐ Portföyde Mevcut';
            addFavBtn.style.background = 'rgba(255,255,255,0.05)';
            addFavBtn.style.color = 'rgba(255,255,255,0.3)';
            addFavBtn.style.cursor = 'not-allowed';
            addFavBtn.style.border = '1px solid rgba(255,255,255,0.1)';
        }
    } else {
        addBtn.textContent = '💼 Portföye Ekle';
        addBtn.style.background = 'var(--accent-blue)';
        if(addFavBtn) {
            addFavBtn.style.display = 'inline-block';
            if (existingItem && existingItem.qty === 0) {
                addFavBtn.textContent = '⭐ Takipten Çıkar';
                addFavBtn.style.background = 'rgba(255,255,255,0.1)';
                addFavBtn.style.color = '#fff';
                addFavBtn.style.cursor = 'pointer';
                addFavBtn.style.border = 'none';
                addFavBtn.style.fontWeight = 'normal';
            } else {
                addFavBtn.textContent = '⭐ Takibe Al';
                addFavBtn.style.background = 'var(--accent-orange)';
                addFavBtn.style.color = '#111';
                addFavBtn.style.cursor = 'pointer';
                addFavBtn.style.border = 'none';
                addFavBtn.style.fontWeight = '600';
            }
        }
    }

    const dp = quote.dp || 0;
    const d = quote.d || 0;
    
    const changeStr = dp >= 0 ? `+${dp.toFixed(2)}%` : `${dp.toFixed(2)}%`;
    const changeEl = document.getElementById('det-change');
    changeEl.textContent = `${d.toFixed(2)} (${changeStr})`;
    changeEl.style.color = dp >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    changeEl.style.background = dp >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    // Parse metrics
    const pe = metrics && metrics.peTTM ? metrics.peTTM : 0;
    const pb = metrics && metrics.pbAnnual ? metrics.pbAnnual : 0;
    const roe = metrics && metrics.roeTTM ? metrics.roeTTM : 0;
    const netMargin = metrics && metrics.netProfitMarginTTM ? metrics.netProfitMarginTTM : 0;
    
    const high52 = metrics && metrics['52WeekHigh'] ? metrics['52WeekHigh'] : ((quote.h || quote.c) * 1.2);
    const low52 = metrics && metrics['52WeekLow'] ? metrics['52WeekLow'] : ((quote.l || quote.c) * 0.8);

    // Scoring Algorithm (0-100)
    let scoreDeg = 50; // Değerleme (PE, PB)
    if (pe > 0 && pe < 15) scoreDeg += 30;
    else if (pe >= 15 && pe < 25) scoreDeg += 10;
    else if (pe >= 25) scoreDeg -= 20;

    if (pb > 0 && pb < 3) scoreDeg += 20;
    else if (pb >= 3 && pb < 10) scoreDeg += 0;
    else if (pb >= 10) scoreDeg -= 20;
    scoreDeg = Math.min(100, Math.max(0, scoreDeg));

    let scoreKar = 50; // Karlılık (ROE, Net Margin)
    if (roe > 15) scoreKar += 30;
    else if (roe > 5) scoreKar += 10;
    else if (roe < 0) scoreKar -= 30;

    if (netMargin > 15) scoreKar += 20;
    else if (netMargin > 5) scoreKar += 10;
    else if (netMargin < 0) scoreKar -= 20;
    scoreKar = Math.min(100, Math.max(0, scoreKar));

    let scoreBuy = 60; // Büyüme & Sağlık (Default average)
    if (metrics && metrics.epsGrowth3Y > 10) scoreBuy += 20;
    if (metrics && metrics.revenueGrowth3Y > 10) scoreBuy += 20;
    scoreBuy = Math.min(100, Math.max(0, scoreBuy));

    // Total Score
    const totalScore = Math.round((scoreDeg * 0.3) + (scoreKar * 0.3) + (scoreBuy * 0.4));
    
    // Render Circular Score
    document.getElementById('det-score').textContent = totalScore;
    const circlePath = document.getElementById('score-circle-path');
    circlePath.style.strokeDasharray = `${totalScore}, 100`;
    
    let aiRec = '';
    let recColor = '';
    let aiSummary = '';
    if (totalScore >= 75) {
        aiRec = 'GÜÇLÜ AL'; recColor = 'var(--accent-green)'; circlePath.style.stroke = 'var(--accent-green)';
        aiSummary = 'Yapay zeka analizine göre şirket temel çarpanlar ve karlılık açısından oldukça cazip seviyelerde. Uzun vadeli portföyler için değerlendirilebilir.';
    } else if (totalScore >= 60) {
        aiRec = 'AL'; recColor = 'var(--accent-green)'; circlePath.style.stroke = 'var(--accent-green)';
        aiSummary = 'Şirket finansalları genel olarak pozitif. Kademeli alım stratejileri uygulanabilir.';
    } else if (totalScore >= 45) {
        aiRec = 'TUT'; recColor = '#eab308'; circlePath.style.stroke = '#eab308';
        aiSummary = 'Mevcut veriler nötr bir görünüm sunuyor. Hali hazırda pozisyonu olanlar tutabilir, yeni alım için ek gelişmeler beklenebilir.';
    } else {
        aiRec = 'SAT / RİSKLİ'; recColor = 'var(--accent-red)'; circlePath.style.stroke = 'var(--accent-red)';
        aiSummary = 'Şirketin değerleme veya karlılık rasyoları sektör ortalamalarının altında veya aşırı primli. Dikkatli olunmalı.';
    }

    const recEl = document.getElementById('ai-rec');
    recEl.textContent = aiRec;
    recEl.style.backgroundColor = `${recColor}33`;
    recEl.style.color = recColor;
    document.getElementById('ai-summary').textContent = aiSummary;

    // Render Price Chart
    if (candles && candles.s === 'ok') {
        renderPriceChart(candles);
    } else {
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
    }

    // Progress bars
    document.getElementById('dim-val-deg').textContent = `${Math.round(scoreDeg)} / 100`;
    document.getElementById('prog-deg').style.width = `${scoreDeg}%`;
    document.getElementById('prog-deg').style.backgroundColor = getDimColor(scoreDeg);

    document.getElementById('dim-val-kar').textContent = `${Math.round(scoreKar)} / 100`;
    document.getElementById('prog-kar').style.width = `${scoreKar}%`;
    document.getElementById('prog-kar').style.backgroundColor = getDimColor(scoreKar);

    document.getElementById('dim-val-buy').textContent = `${Math.round(scoreBuy)} / 100`;
    document.getElementById('prog-buy').style.width = `${scoreBuy}%`;
    document.getElementById('prog-buy').style.backgroundColor = getDimColor(scoreBuy);

    // SWOT
    const strengths = [];
    const weaknesses = [];

    if (pe > 0 && pe < 15) strengths.push(`Düşük F/K Oranı (${pe.toFixed(1)}) hissenin ucuz fiyatlandığını gösteriyor.`);
    if (pe > 30) weaknesses.push(`Yüksek F/K Oranı (${pe.toFixed(1)}) aşırı değerlemeye işaret edebilir.`);
    
    if (roe > 15) strengths.push(`Yüksek Özkaynak Karlılığı (ROE: ${roe.toFixed(1)}%) şirketin verimli yönetildiğini kanıtlıyor.`);
    if (roe > 0 && roe < 5) weaknesses.push(`Düşük ROE (${roe.toFixed(1)}%) sermaye verimliliğinin zayıf olduğunu gösterir.`);
    if (roe < 0) weaknesses.push(`Negatif ROE şirketin zarar ettiğini gösterir.`);

    if (netMargin > 15) strengths.push(`Güçlü Net Kar Marjı (${netMargin.toFixed(1)}%) rekabet avantajını gösterir.`);
    if (netMargin < 0) weaknesses.push(`Negatif Kar Marjı operasyonel risk barındırıyor.`);

    if (dp > 5) strengths.push(`Kısa vadeli güçlü pozitif momentum.`);
    if (dp < -5) weaknesses.push(`Kısa vadeli satış baskısı devam ediyor.`);

    if (strengths.length === 0) strengths.push('Belirgin bir temel güçlü yön tespit edilemedi.');
    if (weaknesses.length === 0) weaknesses.push('Temel rasyolarda belirgin bir risk görülmedi.');

    document.getElementById('swot-strengths').innerHTML = strengths.map(s => `<li>${s}</li>`).join('');
    document.getElementById('swot-weaknesses').innerHTML = weaknesses.map(w => `<li>${w}</li>`).join('');

    // Fundamentals Grid
    setFundItem('pe', pe, true);
    setFundItem('pb', pb, true);
    setFundItem('ps', metrics && metrics.psTTM ? metrics.psTTM : 0, true);
    setFundItem('roe', roe, false);
    setFundItem('net', netMargin, false);
    setFundItem('gross', metrics && metrics.grossMarginTTM ? metrics.grossMarginTTM : 0, false);

    // 52 Week Band
    document.getElementById('band-low').textContent = `Dip: $${low52.toFixed(2)}`;
    document.getElementById('band-high').textContent = `Zirve: $${high52.toFixed(2)}`;
    
    const range = high52 - low52;
    let percentPos = 50;
    if (range > 0) {
        percentPos = ((quote.c - low52) / range) * 100;
        percentPos = Math.max(0, Math.min(100, percentPos));
    }
    document.getElementById('band-indicator').style.left = `calc(${percentPos}% - 2px)`;

    // Render Earnings
    const earnGrid = document.getElementById('earnings-grid');
    if (earnings && earnings.length > 0) {
        let earnHtml = '';
        const recent = earnings.slice(0, 4); // Son 4 çeyrek
        recent.forEach(e => {
            if(e.actual === null || e.estimate === null) return;
            const isSurprise = e.surprise >= 0;
            const surColor = isSurprise ? 'var(--accent-green)' : 'var(--accent-red)';
            const surBg = isSurprise ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const sign = isSurprise ? '+' : '';
            const percent = e.surprisePercent ? e.surprisePercent.toFixed(1) : ((e.surprise / Math.abs(e.estimate)) * 100).toFixed(1);

            earnHtml += `
                <div class="earnings-card">
                    <div class="earnings-period">${e.period} <span style="font-size:0.75rem; color:#888;">(Q${e.quarter})</span></div>
                    <div class="earnings-stats">
                        <div class="earnings-stat">
                            <span class="earnings-stat-label">Beklenti</span>
                            <span class="earnings-stat-val" style="color:rgba(255,255,255,0.6)">$${e.estimate.toFixed(2)}</span>
                        </div>
                        <div class="earnings-stat">
                            <span class="earnings-stat-label">Açıklanan</span>
                            <span class="earnings-stat-val">$${e.actual.toFixed(2)}</span>
                        </div>
                        <div class="earnings-stat">
                            <span class="earnings-stat-label">Sürpriz</span>
                            <span class="earnings-surprise" style="color:${surColor}; background:${surBg};">${sign}${percent}%</span>
                        </div>
                    </div>
                </div>
            `;
        });
        if(earnHtml === '') earnHtml = '<p style="color:rgba(255,255,255,0.5); font-size:0.9rem;">Yeterli bilanço verisi bulunamadı.</p>';
        earnGrid.innerHTML = earnHtml;
    } else {
        earnGrid.innerHTML = '<p style="color:rgba(255,255,255,0.5); font-size:0.9rem;">Bilanço verisi bulunamadı.</p>';
    }
}

function getDimColor(score) {
    if (score >= 70) return 'var(--accent-green)';
    if (score >= 40) return '#eab308';
    return 'var(--accent-red)';
}

function setFundItem(id, val, lowerIsBetter) {
    const valEl = document.getElementById(`fund-${id}`);
    const badgeEl = document.getElementById(`badge-${id}`);
    
    if (!val || val === 0) {
        valEl.textContent = '-';
        badgeEl.style.display = 'none';
        return;
    }
    
    valEl.textContent = val.toFixed(2);
    badgeEl.style.display = 'inline-block';
    
    let isGood = false;
    let isNeutral = false;
    
    if (lowerIsBetter) {
        if (val < 15) isGood = true;
        else if (val < 25) isNeutral = true;
    } else {
        if (val > 15) isGood = true;
        else if (val > 5) isNeutral = true;
    }
    
    badgeEl.className = 'badge';
    if (isGood) {
        badgeEl.textContent = 'İYİ';
        badgeEl.classList.add('iyi');
    } else if (isNeutral) {
        badgeEl.textContent = 'ORTA';
        badgeEl.classList.add('orta');
    } else {
        badgeEl.textContent = 'ZAYIF';
        badgeEl.classList.add('zayif');
    }
}

function generateSimulatedCandles(currentPrice) {
    const days = 90;
    const t = [];
    const c = [];
    
    // Gerçekçi bir trend simülasyonu
    let price = currentPrice * (0.85 + Math.random() * 0.3); 
    const volatility = currentPrice * 0.025;
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = days; i >= 0; i--) {
        t.push(now - (i * 24 * 60 * 60));
        price = price + (Math.random() - 0.45) * volatility;
        if (price < 0) price = 1;
        c.push(price);
    }
    
    // Son fiyatın güncel fiyata tam oturması için
    c[c.length - 1] = currentPrice;

    return { s: 'ok', t, c };
}

function renderPriceChart(candles) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    if (priceChartInstance) {
        priceChartInstance.destroy();
    }

    const dates = candles.t.map(ts => {
        const d = new Date(ts * 1000);
        return `${d.getDate()}/${d.getMonth()+1}`;
    });

    const prices = candles.c;
    const isPositive = prices[prices.length - 1] >= prices[0];
    const color = isPositive ? '#10b981' : '#ef4444';

    priceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Kapanış (USD)',
                data: prices,
                borderColor: color,
                backgroundColor: color + '22',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.5)' }
                }
            }
        }
    });
}

window.renderRightWatchlist = async function() {
    const grid = document.getElementById('right-watchlist-grid');
    if (!grid) return;
    
    const portfolio = PortfolioManager.getPortfolio();
    if (portfolio.length === 0) {
        grid.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.9rem; padding: 1rem;">Henüz portföyünüzde veya takip listenizde varlık yok.</p>';
        return;
    }
    
    grid.innerHTML = '<div class="loader">Veriler çekiliyor...</div>';
    let html = '';
    
    for (let item of portfolio) {
        try {
            const quote = await FinanceAPI.getSmartQuote(item.symbol);
            if (!quote || quote.c === undefined || quote.c === 0) continue;
            
            const price = quote.c;
            const dp = quote.dp || 0;
            const color = dp >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            const sign = dp >= 0 ? '+' : '';
            const nameToDisplay = item.symbol.replace(/^(METAL:|FOREX:)/i, '');
            const curName = (quote.isMetal || quote.isForex) ? 'TL' : 'USD';
            const icon = quote.isCrypto ? '🪙' : (quote.isMetal ? '🥇' : (quote.isForex ? '💵' : '🏢'));
            
            const bagIcon = item.qty > 0 ? `<span style="font-size:0.7rem; background:rgba(255,255,255,0.1); padding: 2px 4px; border-radius:4px; margin-left: 4px;">💼</span>` : `<span style="font-size:0.7rem; background:rgba(255,165,0,0.1); color:orange; padding: 2px 4px; border-radius:4px; margin-left: 4px;">⭐</span>`;
            
            html += `
                <div class="watchlist-item" onclick="document.getElementById('searchInput').value='${nameToDisplay}'; document.getElementById('searchBtn').click();">
                    <div class="watchlist-item-left">
                        <span style="font-weight: 600; font-size: 0.9rem;">${icon} ${nameToDisplay} ${bagIcon}</span>
                    </div>
                    <div class="watchlist-item-right">
                        <span style="font-weight: 700; font-size: 0.95rem;">${price.toFixed(2)} ${curName}</span>
                        <span style="font-size: 0.8rem; color: ${color};">Günlük: ${sign}${dp.toFixed(2)}%</span>
                    </div>
                </div>
            `;
        } catch(err) {
            console.error("Right Watchlist Error on item:", item, err);
        }
    }
    grid.innerHTML = html;
};

window.toggleTxHistory = function(symbol) {
    const safeSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '');
    const el = document.getElementById('tx-history-' + safeSymbol);
    if (!el) return;
    
    if (el.style.display === 'block') {
        el.style.display = 'none';
        return;
    }
    
    // Render the transaction history
    let p = PortfolioManager.getPortfolio();
    let item = p.find(i => i.symbol === symbol);
    if (!item || !item.transactions || item.transactions.length === 0) {
        el.innerHTML = '<div style="font-size:0.85rem; color:rgba(255,255,255,0.6);">İşlem geçmişi bulunamadı.</div>';
    } else {
        let html = '<div style="font-size:0.9rem; font-weight:600; margin-bottom:0.5rem; color:var(--accent-blue);">İşlem Geçmişi</div>';
        html += '<table style="width:100%; text-align:left; font-size:0.85rem; border-collapse:collapse;">';
        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.1);"> <th style="padding:4px;">Tarih</th> <th style="padding:4px;">Adet</th> <th style="padding:4px;">Fiyat</th> </tr>';
        item.transactions.forEach(tx => {
            html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:4px;">${tx.date}</td>
                <td style="padding:4px;">${tx.qty}</td>
                <td style="padding:4px;">${tx.price.toFixed(2)}</td>
            </tr>`;
        });
        html += '</table>';
        el.innerHTML = html;
    }
    
    el.style.display = 'block';
};
