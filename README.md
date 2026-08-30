# 📊 FinQorp — Modern Financial Analysis Platform

**FinQorp** is a full-stack financial analysis platform with a **React frontend** and **Python FastAPI backend** that provides:

- 📈 Real-time stock data and market indices
- 🔮 90-day price forecasting with Monte Carlo simulations
- 📊 Technical analysis (RSI, MACD, Bollinger Bands)
- 💬 AI-powered sentiment analysis
- 🎯 Stock recommendations with accuracy metrics
- 🔄 Peer company comparison
- 🎨 Beautiful glassmorphism UI with dark theme

---

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom glassmorphism design
- **Charts**: Recharts for interactive visualizations
- **Routing**: React Router v6
- **API Client**: Axios with typed responses

### Backend (Python FastAPI)
- **Framework**: FastAPI with async support
- **Data Sources**: Yahoo Finance (yfinance)
- **Analysis**: pandas, numpy, matplotlib, scikit-learn
- **AI**: Google Gemini API for insights
- **Technical Indicators**: pandas_ta

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.11+
- **Google Gemini API Key** (for AI insights)

### 1. Install Backend Dependencies

```bash
cd /Users/adnanquraishee/Downloads/finqorp
source .venv/bin/activate  # or create: python -m venv .venv
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Configure Environment

Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:6150
```

Set your Google Gemini API key (for AI insights):
```bash
export GOOGLE_API_KEY="your-gemini-api-key"
```

### 4. Start Backend Server

```bash
# From project root
source .venv/bin/activate
uvicorn api:app --reload --port 6150
```

The API will be available at **http://localhost:6150**

API Docs: http://localhost:6150/docs

### 5. Start Frontend Dev Server

```bash
# In a new terminal
cd frontend
npm run dev
```

The app will be available at **http://localhost:6100**

---

## 📁 Project Structure

```
finqorp/
├── api.py                    # FastAPI server
├── app.py                    # Original Streamlit app (legacy)
├── modules/                  # Python analysis modules
│   ├── data_fetch.py        # Stock data fetching
│   ├── forecast.py          # Monte Carlo forecasting
│   ├── sentiment.py         # Sentiment analysis
│   ├── technicals.py        # Technical indicators
│   ├── recommendation.py    # AI recommendations
│   ├── accuracy.py          # Backtest & accuracy
│   ├── compare.py           # Company comparison
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   │   ├── MarketOverview.tsx
│   │   │   ├── StockAnalysis.tsx
│   │   │   ├── Technical.tsx
│   │   │   ├── Forecast.tsx
│   │   │   └── Compare.tsx
│   │   ├── components/      # Reusable components
│   │   │   ├── layout/      # Sidebar, SearchBar
│   │   │   ├── ui/          # Card, Button, Badge, etc.
│   │   │   ├── charts/      # Chart components
│   │   │   └── features/    # Feature components
│   │   ├── lib/
│   │   │   ├── api.ts       # API client
│   │   │   ├── types.ts     # TypeScript types
│   │   │   └── utils.ts     # Utility functions
│   │   ├── App.tsx          # Main app
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   └── tailwind.config.js
└── requirements.txt
```

---

## 🎯 Features

### 1. Market Overview
- Display global market indices (NIFTY, SENSEX, S&P 500, NASDAQ, Gold, Oil, Currencies)
- Real-time data with price changes
- Quick stock search with auto-complete

### 2. Stock Analysis
- Comprehensive stock fundamentals
- Interactive price charts with moving averages (MA50, MA200)
- Volume analysis
- Company profile and description
- Financial metrics grid
- Historical trend charts

### 3. Technical Analysis
- **Bollinger Bands** (20-day)
- **MACD** indicator with histogram
- **RSI** (14-day) with overbought/oversold levels
- Interactive charts with tooltips

### 4. Forecast & Ratings
- **90-day price forecast** using Monte Carlo simulation (200 iterations)
- **AI-powered recommendation** with buy/hold/sell rating
- **Accuracy metrics**:
  - RMSE, MAE, MAPE
  - Directional accuracy
  - Overall accuracy score (0-100)
- **Backtest visualization** comparing predicted vs actual prices

### 5. Peer Comparison
- Compare up to 5 stocks
- Comparative financial ratios
- Performance charts
- AI-generated comparative insights

---

## 🎨 Design System

### Colors
- **Primary**: `#dc4600` (Orange)
- **Secondary**: `#4361ee` (Electric Blue)
- **Success**: `#00ff9d` (Neon Green)
- **Danger**: `#ff4757` (Red)
- **Dark Background**: `#0a0e17`

### Components
- **Glassmorphism Cards**: Frosted glass effect with backdrop blur
- **Smooth Animations**: Hover effects and transitions
- **Gradient Buttons**: Eye-catching call-to-actions
- **Typography**: Inter font family
- **Responsive**: Works on desktop, tablet, and mobile

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search?query=` | GET | Search stocks by name/ticker |
| `/api/stock/{symbol}` | GET | Get stock fundamentals |
| `/api/stock/{symbol}/chart` | GET | Historical price data |
| `/api/stock/{symbol}/technicals` | GET | Technical indicators |
| `/api/stock/{symbol}/forecast` | GET | Forecast & recommendation |
| `/api/stock/{symbol}/sentiment` | GET | Sentiment analysis |
| `/api/stock/{symbol}/insights` | GET | AI insights |
| `/api/market/indices` | GET | Market overview |
| `/api/compare` | POST | Compare stocks |

Full API documentation available at: `http://localhost:6150/docs`

---

## 🧪 Testing

### Backend
```bash
# Test API endpoints
curl http://localhost:6150/api/search?query=Apple
curl http://localhost:6150/api/stock/AAPL
curl http://localhost:6150/api/market/indices
```

### Frontend
```bash
cd frontend
npm run build  # Production build
npm run preview  # Preview production build
```

---

## 🚀 Deployment

### Backend (Python API)
Deploy to **Railway**, **Render**, or **DigitalOcean**:

```bash
# Example for Railway
railway login
railway init
railway up
```

### Frontend (React)
Deploy to **Vercel** or **Netlify**:

```bash
# Vercel
cd frontend
vercel --prod

# Netlify
npm run build
netlify deploy --prod --dir=dist
```

**Environment Variables** (Vercel/Netlify):
- `VITE_API_URL`: Your deployed backend URL

### Alternative: Single Deployment
Serve React build from FastAPI:

```python
# In api.py, add:
from fastapi.staticfiles import StaticFiles

app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

Then deploy as a single Python app.

---

## 📝 Future Enhancements

- [ ] User authentication and accounts
- [ ] Portfolio tracking and management
- [ ] Price alerts and notifications
- [ ] Real-time WebSocket price updates
- [ ] Stock screener
- [ ] Options chain analysis
- [ ] Backtesting engine
- [ ] Social sentiment tracking (Reddit, Twitter)
- [ ] Economic calendar

---

## 🔒 Disclaimer

**This application is for educational and informational purposes only. It is NOT intended as financial advice. Always consult with a qualified financial advisor before making investment decisions.**

---

## 📄 License

MIT License - feel free to use and modify for your projects!

---

## 👨‍💻 Author

**Adnan Quraishee**

Built with ❤️ using React, TypeScript, Python, FastAPI, and AI

---

## 🙏 Acknowledgments

- **Yahoo Finance** for stock data
- **Google Gemini** for AI insights
- **Recharts** for beautiful charts
- **Tailwind CSS** for styling system
