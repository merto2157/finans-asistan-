const API_KEY = 'd8hi17hr01qrn5ec6ipgd8hi17hr01qrn5ec6iq0';
const BASE_URL = 'https://finnhub.io/api/v1';

class FinanceAPI {
    /**
     * Get real-time quote data for a symbol
     * @param {string} symbol - Stock symbol (e.g. AAPL)
     */
    static async getQuote(symbol) {
        try {
            const response = await fetch(`${BASE_URL}/quote?symbol=${symbol}&token=${API_KEY}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching quote for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get general market news
     */
    static async getGeneralNews() {
        try {
            const response = await fetch(`${BASE_URL}/news?category=general&token=${API_KEY}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching news:', error);
            return [];
        }
    }

    /**
     * Get profile info (optional, for company names)
     */
    static async getProfile(symbol) {
        try {
            const response = await fetch(`${BASE_URL}/stock/profile2?symbol=${symbol}&token=${API_KEY}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching profile for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get detailed metrics for AI scoring
     */
    static async getMetrics(symbol) {
        try {
            const response = await fetch(`${BASE_URL}/stock/metric?symbol=${symbol}&metric=all&token=${API_KEY}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.metric || null;
        } catch (error) {
            console.error(`Error fetching metrics for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Search for a symbol by company name or ticker
     */
    static async searchSymbol(query) {
        try {
            const response = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${API_KEY}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error searching for ${query}:`, error);
            return null;
        }
    }

    /**
     * Get historical daily candles for a symbol
     * @param {string} symbol - Stock symbol
     * @param {number} days - Number of days back
     */
    static async getCandles(symbol, days = 90) {
        try {
            const to = Math.floor(Date.now() / 1000);
            const from = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
            const response = await fetch(`${BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching candles for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get historical earnings (EPS) surprises
     */
    static async getEarnings(symbol) {
        try {
            const response = await fetch(`${BASE_URL}/stock/earnings?symbol=${symbol}&token=${API_KEY}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching earnings for ${symbol}:`, error);
            return [];
        }
    }

    /**
     * Get Live Rates for Forex and Metals Dashboard
     * Fetches USD/TRY and Gold(PAXG/USDT) to calculate TL prices.
     */
    static async getLiveRates() {
        try {
            // Fetch USD/TRY
            const usdTryRes = await fetch(`${BASE_URL}/quote?symbol=BINANCE:USDTTRY&token=${API_KEY}`);
            const usdTryData = await usdTryRes.json();
            
            // Fetch Gold (PAXG/USDT)
            const goldRes = await fetch(`${BASE_URL}/quote?symbol=BINANCE:PAXGUSDT&token=${API_KEY}`);
            const goldData = await goldRes.json();

            return {
                usdTry: usdTryData,
                gold: goldData
            };
        } catch (error) {
            console.error('Error fetching live rates:', error);
            return null;
        }
    }

    // --- BINANCE API METHODS FOR CRYPTO ---

    static async getSmartQuote(symbol) {
        if (!symbol) return null;
        
        const now = Date.now();
        if (this._smartQuoteCache[symbol] && (now - this._smartQuoteCache[symbol].time < 60000)) {
            return this._smartQuoteCache[symbol].data;
        }

        let result = await this._getSmartQuoteInternal(symbol);
        if (result) {
            this._smartQuoteCache[symbol] = { data: result, time: now };
        }
        return result;
    }

    static async _getSmartQuoteInternal(symbol) {
        if (symbol.startsWith('METAL:')) {
            const name = symbol.replace('METAL:', '');
            const normalize = (str) => str.toLowerCase()
                .replace(/ı/g, 'i').replace(/i̇/g, 'i')
                .replace(/ö/g, 'o').replace(/ü/g, 'u')
                .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c');
            const goldData = await this.getCollectApiGold();
            let item = goldData ? goldData.find(g => {
                if (!g || !g.name || !name) return false;
                const n1 = g.name;
                const n2 = name;
                return n1 === n2 || normalize(n1) === normalize(n2) || n1.replace(/\s+/g,'').toLowerCase() === n2.replace(/\s+/g,'').toLowerCase();
            }) : null;
            if (!item && goldData) {
                item = goldData.find(g => g && g.name && name && g.name.toLowerCase().includes(name.toLowerCase()));
            }
            if (item) {
                return { c: parseFloat(item.selling), dp: parseFloat(item.rate), isMetal: true, isCrypto: false, name: item.name };
            }
            return null;
        }
        
        if (symbol.startsWith('FOREX:')) {
            const code = symbol.replace('FOREX:', '');
            const normalize = (str) => str.toLowerCase()
                .replace(/ı/g, 'i').replace(/i̇/g, 'i')
                .replace(/ö/g, 'o').replace(/ü/g, 'u')
                .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c');
            const forexData = await this.getCollectApiForex();
            const item = forexData ? forexData.find(f => {
                if (!f || !f.code || !code) return false;
                return f.code.toUpperCase() === code.toUpperCase() || (f.name && normalize(f.name) === normalize(code));
            }) : null;
            if (item) {
                return { c: parseFloat(item.selling), dp: parseFloat(item.rate), isForex: true, isCrypto: false, name: item.name };
            }
            return null;
        }

        let normalized = symbol.toUpperCase().replace(/[^A-Z]/g, '');
        
        if (!normalized.endsWith('USDT')) {
            let cryptoAttempt = await this.getCryptoQuote(normalized + 'USDT');
            if (cryptoAttempt && cryptoAttempt.c !== undefined && cryptoAttempt.c !== null) {
                cryptoAttempt.isCrypto = true;
                return cryptoAttempt;
            }
        } else {
            let cryptoAttempt = await this.getCryptoQuote(normalized);
            if (cryptoAttempt && cryptoAttempt.c !== undefined && cryptoAttempt.c !== null) {
                cryptoAttempt.isCrypto = true;
                return cryptoAttempt;
            }
        }
        
        let stockAttempt = await this.getQuote(symbol);
        if (stockAttempt) stockAttempt.isCrypto = false;
        return stockAttempt;
    }

    static async searchCrypto(query) {
        let normalized = query.toUpperCase().replace(/USDT$/i, '').replace(/[^A-Z]/g, '');
        if (!normalized) return null;
        let symbol = normalized + 'USDT';

        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
            if (!response.ok) return null;
            const data = await response.json();
            if (data.symbol) {
                return {
                    id: data.symbol,
                    name: normalized + ' (Binance)',
                    symbol: normalized
                };
            }
            return null;
        } catch (error) {
            console.error(`Error searching crypto for ${query}:`, error);
            return null;
        }
    }

    static async getCryptoQuote(id) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.lastPrice) {
                return {
                    c: parseFloat(data.lastPrice),
                    dp: parseFloat(data.priceChangePercent)
                };
            }
            return null;
        } catch (error) {
            console.error(`Error fetching crypto quote for ${id}:`, error);
            return null;
        }
    }

    static async getCryptoCandles(id, days = 90) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${id}&interval=1d&limit=${days}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            // Format to match Finnhub candle format { t: [], c: [] }
            if (data && data.length > 0) {
                const t = [];
                const c = [];
                data.forEach(candle => {
                    t.push(Math.floor(candle[0] / 1000)); // Open time
                    c.push(parseFloat(candle[4])); // Close price
                });
                return { t, c, s: "ok" };
            }
            return null;
        } catch (error) {
            console.error(`Error fetching crypto candles for ${id}:`, error);
            return null;
        }
    }

    // --- COLLECTAPI METHODS FOR METALS & FOREX ---
    static getCollectApiKey() {
        return '7AOxLHjlgLXZydkcdjwZ0S:7leJOKXliLowZK4IWKYmVp';
    }

    static setCollectApiKey(key) {
        localStorage.setItem('finans_collectapi_key', key);
    }

    static _goldCache = null;
    static _goldCacheTime = 0;
    static _forexCache = null;
    static _forexCacheTime = 0;
    static _smartQuoteCache = {};

    static async getCollectApiGold() {
        const key = this.getCollectApiKey();
        if (!key) return null;
        
        if (this._goldCache && (Date.now() - this._goldCacheTime < 180000)) {
            return this._goldCache; // Cache for 3 minutes
        }

        try {
            const response = await fetch('https://api.collectapi.com/economy/goldPrice', {
                headers: { 'authorization': `apikey ${key}`, 'content-type': 'application/json' }
            });
            const data = await response.json();
            if (data.success) {
                this._goldCache = data.result;
                this._goldCacheTime = Date.now();
                return data.result;
            }
            return this._goldCache; // fallback to stale cache if limit hit
        } catch (e) {
            console.error('CollectAPI Gold Error:', e);
            return this._goldCache;
        }
    }

    static async getCollectApiForex() {
        const key = this.getCollectApiKey();
        if (!key) return null;

        if (this._forexCache && (Date.now() - this._forexCacheTime < 180000)) {
            return this._forexCache; // Cache for 3 minutes
        }

        try {
            const response = await fetch('https://api.collectapi.com/economy/allCurrency', {
                headers: { 'authorization': `apikey ${key}`, 'content-type': 'application/json' }
            });
            const data = await response.json();
            if (data.success) {
                this._forexCache = data.result;
                this._forexCacheTime = Date.now();
                return data.result;
            }
            return this._forexCache; // fallback to stale cache
        } catch (e) {
            console.error('CollectAPI Forex Error:', e);
            return this._forexCache;
        }
    }

    static async searchMetals(query) {
        const normalize = (str) => str.toLowerCase()
            .replace(/i̇/g, 'i').replace(/ı/g, 'i')
            .replace(/ö/g, 'o').replace(/ü/g, 'u')
            .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c');
            
        const lowerQ = normalize(query.trim());
        if (!lowerQ) return null;
        
        const [goldData, forexData] = await Promise.all([
            this.getCollectApiGold(),
            this.getCollectApiForex()
        ]);
        
        if (goldData) {
            for (let g of goldData) {
                if (normalize(g.name).includes(lowerQ)) {
                    return { id: 'METAL:' + g.name, name: g.name, symbol: g.name, type: 'metal' };
                }
            }
        }
        if (forexData) {
            for (let f of forexData) {
                if (normalize(f.code).includes(lowerQ) || normalize(f.name).includes(lowerQ)) {
                    return { id: 'FOREX:' + f.code, name: f.name, symbol: f.code, type: 'forex' };
                }
            }
        }
        return null;
    }

    static async getCollectApiGold() {
        const key = this.getCollectApiKey();
        if (!key) return null;
        try {
            const response = await fetch('https://api.collectapi.com/economy/goldPrice', {
                headers: { 'authorization': `apikey ${key}`, 'content-type': 'application/json' }
            });
            const data = await response.json();
            return data.success ? data.result : null;
        } catch (e) {
            console.error('CollectAPI Gold Error:', e);
            return null;
        }
    }

    static async getCollectApiForex() {
        const key = this.getCollectApiKey();
        if (!key) return null;
        try {
            const response = await fetch('https://api.collectapi.com/economy/allCurrency', {
                headers: { 'authorization': `apikey ${key}`, 'content-type': 'application/json' }
            });
            const data = await response.json();
            return data.success ? data.result : null;
        } catch (e) {
            console.error('CollectAPI Forex Error:', e);
            return null;
        }
    }

    // --- GEMINI API METHODS FOR CHAT ---
    static async getGeminiResponse(apiKey, userMessage, systemInstruction, chatHistory = []) {
        if (!apiKey) return null;

        // 1. Fetch the list of available models to avoid 404 errors
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        let chosenModelName = null;
        try {
            const modelsRes = await fetch(modelsUrl);
            if (!modelsRes.ok) {
                const errData = await modelsRes.json();
                throw new Error("Model listesi alınamadı: " + (errData.error?.message || modelsRes.status));
            }
            const modelsData = await modelsRes.json();
            
            if (modelsData.models && modelsData.models.length > 0) {
                const availableModels = modelsData.models.filter(m => 
                    m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent") && m.name.includes("gemini")
                );
                
                if (availableModels.length === 0) {
                    throw new Error("API Anahtarınızın mesaj üretebilen bir Gemini modeline erişimi yok.");
                }

                // Prefer any flash model (fastest and free tier enabled)
                let chosenModel = availableModels.find(m => m.name.includes("flash"));
                if (!chosenModel) chosenModel = availableModels.find(m => m.name.includes("pro"));
                if (!chosenModel) chosenModel = availableModels[0];

                chosenModelName = chosenModel.name; // e.g., "models/gemini-3.1-flash"
            }
        } catch (err) {
            console.error("Model list fetch error:", err);
            // Fallback if the list API fails for some reason
            chosenModelName = "models/gemini-1.5-flash";
        }

        if (!chosenModelName) {
            throw new Error("Kullanılabilir bir model bulunamadı.");
        }

        // Combine system instruction into the first message to support older models
        const contents = [];
        let firstMessageText = "Sistem Bağlamı:\n" + systemInstruction + "\n\n---\n\n";

        // Gemini MUST start with 'user' role
        if (chatHistory.length > 0 && chatHistory[0].role === 'bot') {
            contents.push({
                role: 'user',
                parts: [{ text: firstMessageText + "Kullanıcı Oturuma Başladı." }]
            });
            firstMessageText = ""; 
        }

        // Add history alternating correctly
        for (let i = 0; i < chatHistory.length; i++) {
            const msg = chatHistory[i];
            const msgRole = msg.role === 'bot' ? 'model' : 'user';
            
            let text = msg.text;
            if (i === 0 && firstMessageText !== "") {
                text = firstMessageText + text;
                firstMessageText = ""; 
            }
            
            // If the role matches the previous one, append to it instead of pushing a new object
            if (contents.length > 0 && contents[contents.length - 1].role === msgRole) {
                contents[contents.length - 1].parts[0].text += "\n\n" + text;
            } else {
                contents.push({
                    role: msgRole,
                    parts: [{ text: text }]
                });
            }
        }
        
        let currentText = userMessage;
        if (firstMessageText !== "") {
            currentText = firstMessageText + currentText;
        }

        if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents[contents.length - 1].parts[0].text += "\n\n" + currentText;
        } else {
            contents.push({
                role: 'user',
                parts: [{ text: currentText }]
            });
        }

        const body = {
            contents: contents,
            generationConfig: {
                temperature: 0.7
            }
        };

        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${chosenModelName}:generateContent?key=${apiKey}`;
        
        let lastErrorMsg = "Bilinmeyen Hata";
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(generateUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    const errMsg = errorData.error?.message || `HTTP Error ${response.status}`;
                    
                    // If high demand or rate limit, retry up to 3 times
                    if (response.status === 503 || response.status === 429 || errMsg.includes("high demand")) {
                        lastErrorMsg = errMsg;
                        if (attempt < 3) {
                            console.warn(`Attempt ${attempt} failed with high demand. Retrying in 2 seconds...`);
                            await new Promise(r => setTimeout(r, 2000));
                            continue;
                        }
                    }
                    throw new Error(errMsg);
                }

                const data = await response.json();
                if (data.candidates && data.candidates.length > 0) {
                    let fullText = "";
                    for (const part of data.candidates[0].content.parts) {
                        if (part.text) fullText += part.text;
                    }
                    return fullText;
                }
                return null;
            } catch (err) {
                if (attempt === 3 || (!err.message.includes("high demand") && !err.message.includes("503") && !err.message.includes("429"))) {
                    throw err;
                }
                lastErrorMsg = err.message;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        throw new Error(lastErrorMsg);
    }
}
