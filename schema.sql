CREATE TABLE IF NOT EXISTS daily_picks (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  company_name TEXT NOT NULL,
  price REAL NOT NULL,
  score REAL NOT NULL,
  stop_loss REAL NOT NULL,
  tp1 REAL NOT NULL,
  tp2 REAL NOT NULL,
  tp3 REAL NOT NULL,
  tp4 REAL NOT NULL,
  highest_price REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_picks (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  company_name TEXT NOT NULL,
  price REAL NOT NULL,
  score REAL NOT NULL,
  stop_loss REAL NOT NULL,
  tp1 REAL NOT NULL,
  tp2 REAL NOT NULL,
  tp3 REAL NOT NULL,
  tp4 REAL NOT NULL,
  highest_price REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS us_custom_picks (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  company_name TEXT NOT NULL,
  price REAL NOT NULL,
  score REAL NOT NULL,
  highest_price REAL NOT NULL,
  static_sl REAL NOT NULL,
  static_sl_color TEXT NOT NULL,
  static_tp1 REAL NOT NULL,
  static_tp1_color TEXT NOT NULL,
  static_tp2 REAL NOT NULL,
  static_tp2_color TEXT NOT NULL,
  static_tp3 REAL NOT NULL,
  static_tp3_color TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS us_watchlist_sync (
  id TEXT PRIMARY KEY,
  tickers_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
