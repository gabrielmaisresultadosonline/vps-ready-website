-- No Silva Drinks — esquema PostgreSQL (idempotente: pode rodar várias vezes)
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, image TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY, category_id INT REFERENCES categories(id),
  name TEXT NOT NULL, description TEXT, image TEXT, unit TEXT DEFAULT 'un',
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0, promo_price NUMERIC(12,2),
  current_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','indisponivel','rascunho')),
  featured BOOLEAN NOT NULL DEFAULT FALSE, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS neighborhoods (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_minutes INT, active BOOLEAN NOT NULL DEFAULT TRUE, notes TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL,
  neighborhood_id INT REFERENCES neighborhoods(id), street TEXT, number TEXT,
  complement TEXT, reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), first_order_at TIMESTAMPTZ, last_order_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY, order_number SERIAL, customer_id INT REFERENCES customers(id),
  customer_name TEXT, customer_phone TEXT, neighborhood_name TEXT, address TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando',
  payment_method TEXT, payment_status TEXT NOT NULL DEFAULT 'pendente',
  source TEXT NOT NULL DEFAULT 'site', notes TEXT,
  stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id), product_name_snapshot TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL,
  unit_cost_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY, product_id INT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL, -- entrada | saida | venda | estorno | ajuste
  quantity INT NOT NULL, unit_cost NUMERIC(12,2), supplier TEXT, notes TEXT,
  order_id INT REFERENCES orders(id), reverted_movement_id INT REFERENCES stock_movements(id),
  reverted BOOLEAN NOT NULL DEFAULT FALSE,
  user_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS finance_entries (
  id SERIAL PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  category TEXT NOT NULL, description TEXT, amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT, notes TEXT, order_id INT REFERENCES orders(id),
  stock_movement_id INT REFERENCES stock_movements(id),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY, user_name TEXT, action TEXT, details TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dados iniciais
INSERT INTO categories (id, name, sort_order) VALUES
 (1,'ALCOÓLICOS',1),(2,'NÃO ALCOÓLICOS',2),(3,'ITENS VARIADOS',3) ON CONFLICT (id) DO NOTHING;
SELECT setval('categories_id_seq', GREATEST((SELECT MAX(id) FROM categories),1));

INSERT INTO settings (key,value) VALUES
 ('store_name','No Silva Drinks'),
 ('tagline','Você da Campina, São Leopoldo'),
 ('whatsapp','5551999999999'),
 ('hero_title','SUA BEBIDA FAVORITA CHEGA ATÉ VOCÊ!'),
 ('hero_subtitle','Escolha, peça e receba sem sair de casa.'),
 ('hero_image',''),('logo',''),('favicon',''),
 ('open_time','10:00'),('close_time','23:59'),('store_open','auto'),
 ('min_order','0'),('free_delivery_above','0'),('show_sold_out','1'),
 ('payment_methods','Pix,Dinheiro,Cartão')
ON CONFLICT (key) DO NOTHING;

-- Entrega: localização e horários (seguro rodar várias vezes)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
INSERT INTO settings (key,value) VALUES ('store_address',''),('store_city','São Leopoldo, RS'),('store_lat',''),('store_lng',''),('auto_deliver_minutes','40')
ON CONFLICT (key) DO NOTHING;

-- Troco para pagamento em dinheiro
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_for NUMERIC(12,2);

-- Exclusão segura de produtos (nunca apaga histórico)
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
