INSERT INTO businesses (id, name, address, lat, lng, radius_m, qr_token, balance)
VALUES
  (1, 'Hyatt Regency Tashkent', '47 Amir Temur Avenue, Tashkent', 41.3258, 69.2817, 150, 'HYATT2026', 100000),
  (2, 'Amir Timur Museum', 'Shaykhantakhur District, Tashkent', 41.3066, 69.2800, 120, 'AMIRTIMUR2026', 80000),
  (3, 'Plov Center', 'Mustakillik Maydoni, Tashkent', 41.3116, 69.2797, 120, 'PLOVCENTER2026', 70000);

INSERT INTO campaigns (id, business_id, reward_amount, max_visits, visits_count, active, ends_at)
VALUES
  (1, 1, 10000, 500, 0, true, NOW() + INTERVAL '30 days'),
  (2, 2, 10000, 500, 0, true, NOW() + INTERVAL '30 days'),
  (3, 3, 10000, 500, 0, true, NOW() + INTERVAL '30 days');

INSERT INTO users (id, telegram_id, username, phone, balance)
VALUES
  (1, 1234567890, 'testuser', '+998901234567', 50000);
