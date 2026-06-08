const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Seed roles
    const roles = [
      { name: 'admin', description: 'System Administrator', permissions: ['*'] },
      { name: 'evaluator', description: 'Bid Evaluator', permissions: ['read:projects', 'write:evaluations', 'read:bidders'] },
      { name: 'viewer', description: 'Read-only access', permissions: ['read:projects', 'read:bidders'] },
    ];

    const roleIds = {};
    for (const role of roles) {
      const res = await client.query(
        `INSERT INTO roles (name, description, permissions) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description=$2 RETURNING id`,
        [role.name, role.description, JSON.stringify(role.permissions)]
      );
      roleIds[role.name] = res.rows[0].id;
    }

    // Seed admin user
    const hashedPassword = await bcrypt.hash('Admin@1234', 12);
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, department, designation)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@bes.gov.lk', hashedPassword, 'System', 'Administrator', roleIds['admin'], 
       'IT Division', 'System Administrator']
    );

    // Seed sample evaluator
    const evalPassword = await bcrypt.hash('Eval@1234', 12);
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, department, designation)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      ['evaluator@bes.gov.lk', evalPassword, 'Dr. Rajitha', 'Udawalpola', roleIds['evaluator'],
       'Faculty of Engineering', 'Head/Senior Lecturer']
    );

    await client.query('COMMIT');
    console.log('✅ Seed completed successfully');
    console.log('👤 Admin: admin@bes.gov.lk / Admin@1234');
    console.log('👤 Evaluator: evaluator@bes.gov.lk / Eval@1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

seed();
