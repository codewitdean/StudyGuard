CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

-- Insert dummy data
INSERT INTO users (name) VALUES 
  ('John Doe'),
  ('Jane Smith'),
  ('Bob Johnson'),
  ('Alice Williams'),
  ('Charlie Brown');

-- View the data
SELECT * FROM users;
